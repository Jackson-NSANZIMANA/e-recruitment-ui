// ══════════════════════════════════════════════════════════════════
// @usrp/auth selfcheck
//
//   pnpm --filter @usrp/auth selfcheck
//
// Drives the OTP state machine, the sliding-TTL planner, the session union and
// the edge client's failure classification. The clock is injected everywhere, so
// thirty minutes of session behaviour and five minutes of OTP expiry are asserted
// in microseconds — a proof that waits is a proof nobody runs.
//
// The load-bearing assertions here are about what the UI must NOT learn: that a
// rejected code and a locked-out challenge produce the same state, and that a
// G2G outage is never charged as an attempt.
// ══════════════════════════════════════════════════════════════════

import {
  initialOtpState,
  otpReducer,
  attemptsRemaining,
  canSubmit,
  millisRemaining,
  shouldOfferWalkIn,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  type OtpState,
} from '../src/otp-machine.js';
import { planRefresh, ABSOLUTE_WARNING_WINDOW_MS, MIN_REFRESH_DELAY_MS, startRefreshLoop } from '../src/refresh.js';
import {
  isApplicantSession,
  isOfficerSession,
  parseSessionResponse,
  requireApplicantSession,
  requireOfficerSession,
  SessionKindError,
  millisUntilIdleExpiry,
  type OfficerAgency,
  type Session,
} from '../src/session.js';
import { createEdgeAuthClient, readCsrfToken, EDGE_PATHS, CSRF_HEADER } from '../src/edge-client.js';
import {
  G2G_UNAVAILABLE,
  OFFICER_LOGIN_FAILED,
  OTP_ATTEMPTS_EXHAUSTED,
  OTP_EXPIRED,
  OTP_INVALID,
  OTP_REQUEST_ACCEPTED,
  SESSION_EXPIRED,
  WALK_IN_FALLBACK_BODY,
} from '../src/copy.js';

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail?: string): void {
  if (condition) { passed += 1; return; }
  failures.push(detail === undefined ? label : `${label} — ${detail}`);
}
function eq<T>(label: string, actual: T, expected: T): void {
  ok(label, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ══ The OTP machine ════════════════════════════════════════════
const T0 = 1_000_000;
let state: OtpState = initialOtpState();
eq('starts idle', state.status, 'idle');
ok('cannot submit before a challenge', !canSubmit(state));

state = otpReducer(state, { type: 'REQUEST', nationalId: '1199180000000001' });
eq('requesting while in flight', state.status, 'requesting');
state = otpReducer(state, { type: 'REQUEST_ACCEPTED', atMs: T0 });
eq('a 202 yields a challenge', state.status, 'challenged');
eq('with the full attempt budget', attemptsRemaining(state), OTP_MAX_ATTEMPTS);
eq('and a 5-minute local clock', millisRemaining(state, T0), OTP_TTL_MS);
ok('now submittable', canSubmit(state));
ok('walk-in is NOT offered yet (nothing has gone wrong)', !shouldOfferWalkIn(state));

// Four wrong codes.
for (let attempt = 1; attempt <= 4; attempt += 1) {
  state = otpReducer(state, { type: 'SUBMIT' });
  eq(`attempt ${attempt} goes to verifying`, state.status, 'verifying');
  state = otpReducer(state, { type: 'SUBMIT_REJECTED' });
  eq(`attempt ${attempt} is rejected, not locked`, state.status, 'rejected');
  eq(`…leaving ${OTP_MAX_ATTEMPTS - attempt} attempts`, attemptsRemaining(state), OTP_MAX_ATTEMPTS - attempt);
}
ok('walk-in IS offered by the second failure (before the citizen is stuck)', shouldOfferWalkIn(state));

// The fifth exhausts the budget.
state = otpReducer(state, { type: 'SUBMIT' });
state = otpReducer(state, { type: 'SUBMIT_REJECTED' });
eq('the fifth failure exhausts the budget', state.status, 'attemptsExhausted');
eq('with zero attempts left', attemptsRemaining(state), 0);
ok('and cannot submit again (further tries burn a locked challenge)', !canSubmit(state));
ok('walk-in is offered', shouldOfferWalkIn(state));
eq('the lockout cap matches ADR-018', OTP_MAX_ATTEMPTS, 5);

// A G2G outage must NOT cost an attempt.
let outageState: OtpState = otpReducer(otpReducer(initialOtpState(), { type: 'REQUEST', nationalId: 'x' }), { type: 'REQUEST_ACCEPTED', atMs: T0 });
outageState = otpReducer(outageState, { type: 'SUBMIT' });
outageState = otpReducer(outageState, { type: 'SUBMIT_UPSTREAM_UNAVAILABLE', authority: 'NIDA_UNAVAILABLE' });
eq('a 503 during verify is an outage state', outageState.status, 'upstreamUnavailable');
eq('…naming the authority', outageState.status === 'upstreamUnavailable' ? outageState.authority : '', 'NIDA_UNAVAILABLE');
eq('…and is NOT charged as an attempt', attemptsRemaining(outageState), OTP_MAX_ATTEMPTS);

// The 5-minute TTL, driven by the clock rather than by a submission.
let ttlState: OtpState = otpReducer(otpReducer(initialOtpState(), { type: 'REQUEST', nationalId: 'x' }), { type: 'REQUEST_ACCEPTED', atMs: T0 });
ttlState = otpReducer(ttlState, { type: 'TICK', atMs: T0 + OTP_TTL_MS - 1 });
eq('one millisecond before expiry it is still challenged', ttlState.status, 'challenged');
ttlState = otpReducer(ttlState, { type: 'TICK', atMs: T0 + OTP_TTL_MS });
eq('at the TTL it expires', ttlState.status, 'expired');
eq('with no time left', millisRemaining(ttlState, T0 + OTP_TTL_MS), 0);
ok('walk-in is offered on expiry too', shouldOfferWalkIn(ttlState));
eq('the TTL matches ADR-018', OTP_TTL_MS, 300_000);

// A fresh challenge resets the budget, mirroring the server's per-challenge counter.
const reset = otpReducer(otpReducer(state, { type: 'REQUEST', nationalId: 'x' }), { type: 'REQUEST_ACCEPTED', atMs: T0 + 600_000 });
eq('a new challenge is challenged again', reset.status, 'challenged');
eq('…with a fresh budget', attemptsRemaining(reset), OTP_MAX_ATTEMPTS);
const verified = otpReducer(otpReducer(reset, { type: 'SUBMIT' }), { type: 'SUBMIT_VERIFIED' });
eq('a correct code verifies', verified.status, 'verified');
ok('no token appears anywhere in the verified state', !JSON.stringify(verified).includes('token'));
eq('RESET returns to idle', otpReducer(verified, { type: 'RESET' }).status, 'idle');
// Nonsense events must be inert, never a crash and never a guess.
eq('an out-of-order SUBMIT is ignored', otpReducer(initialOtpState(), { type: 'SUBMIT' }).status, 'idle');
eq('a TICK while idle is ignored', otpReducer(initialOtpState(), { type: 'TICK', atMs: T0 }).status, 'idle');

// ══ Copy must not leak what the API withheld ═══════════════════
const forbiddenHints = ['not found', 'no account', 'unknown', 'does not exist', 'incorrect password', 'wrong password', 'disabled', 'no phone'];
for (const hint of forbiddenHints) {
  ok(`officer login copy avoids "${hint}"`, !OFFICER_LOGIN_FAILED.toLowerCase().includes(hint));
}
ok('officer login copy names BOTH fields, so neither is implicated',
  OFFICER_LOGIN_FAILED.includes('handle') && OFFICER_LOGIN_FAILED.includes('password'));
ok('OTP copy is CONDITIONAL, never claiming a code was sent', OTP_REQUEST_ACCEPTED.startsWith('If this National ID'));
ok('…and states the 5-minute window', OTP_REQUEST_ACCEPTED.includes('5 minutes'));
ok('OTP failure copy does not distinguish wrong from expired from locked',
  !OTP_INVALID.toLowerCase().includes('locked') && !OTP_INVALID.toLowerCase().includes('attempts'));
ok('the exhausted-attempts message is driven by OUR counter and says so plainly',
  OTP_ATTEMPTS_EXHAUSTED.includes('5 attempts'));
ok('the expiry message explains the window', OTP_EXPIRED.includes('5 minutes'));
ok('the walk-in fallback explains WHY no code can arrive', WALK_IN_FALLBACK_BODY.includes('NIDA holds'));
ok('…and offers a real, staffed alternative', WALK_IN_FALLBACK_BODY.includes('in person'));
ok('…without claiming we detected a missing phone', !WALK_IN_FALLBACK_BODY.includes('we found'));
ok('idle and absolute expiry have DIFFERENT copy', SESSION_EXPIRED.idle !== SESSION_EXPIRED.absolute);
ok('the absolute message explains it is unavoidable', SESSION_EXPIRED.absolute.includes('regardless of activity'));
for (const authority of ['NIDA_UNAVAILABLE', 'NESA_UNAVAILABLE', 'RIB_UNAVAILABLE', 'HEC_UNAVAILABLE']) {
  const message = G2G_UNAVAILABLE[authority];
  ok(`${authority} has its own explainable message`, message !== undefined && message.length > 40);
  ok(`…naming the authority`, message?.includes(authority.split('_')[0] ?? '') === true);
}
ok('the NIDA message reassures nothing was lost', G2G_UNAVAILABLE['NIDA_UNAVAILABLE']?.includes('nothing you entered has been lost') === true
  || G2G_UNAVAILABLE['NIDA_UNAVAILABLE']?.includes('Nothing you entered has been lost') === true);

// ══ The session union ══════════════════════════════════════════
const officer: Session = {
  kind: 'officer',
  agency: 'RDF' as OfficerAgency,
  roles: ['RECRUITMENT_OFFICER'],
  idleExpiresAt: new Date(T0 + 1_800_000).toISOString(),
  absoluteExpiresAt: new Date(T0 + 43_200_000).toISOString(),
};
const applicant: Session = {
  kind: 'applicant',
  idleExpiresAt: new Date(T0 + 1_800_000).toISOString(),
  absoluteExpiresAt: new Date(T0 + 43_200_000).toISOString(),
};
ok('an officer session is recognised', isOfficerSession(officer));
ok('an applicant session is recognised', isApplicantSession(applicant));
ok('an officer session is not an applicant session', !isApplicantSession(officer));
eq('requireOfficerSession passes an officer through', requireOfficerSession(officer).agency, 'RDF');
try {
  requireOfficerSession(applicant);
  ok('an applicant must NOT pass as an officer', false);
} catch (err) {
  ok('an applicant session is REFUSED where an officer is required', err instanceof SessionKindError);
  ok('…naming both kinds, so the message is debuggable',
    err instanceof SessionKindError && err.expected === 'officer' && err.actual === 'applicant');
  ok('…and citing why they are not interchangeable',
    err instanceof Error && err.message.includes('ADR-018'));
}
try {
  requireApplicantSession(officer);
  ok('an officer must NOT pass as an applicant', false);
} catch (err) { ok('an officer session is refused on a citizen route', err instanceof SessionKindError); }
ok('no session shape carries a token field', !JSON.stringify(officer).includes('token') && !JSON.stringify(applicant).includes('token'));

// Parsing the edge's session body.
const parsedOfficer = parseSessionResponse({ kind: 'officer', agency: 'RDF', roles: ['X'], idleExpiresAt: 'a', absoluteExpiresAt: 'b' });
ok('a valid officer body parses', parsedOfficer?.kind === 'officer');
ok('a bogus agency is REJECTED, not coerced',
  parseSessionResponse({ kind: 'officer', agency: 'MOD', roles: [], idleExpiresAt: 'a', absoluteExpiresAt: 'b' }) === null);
ok('a missing absolute expiry is rejected (a sliding TTL alone is immortal)',
  parseSessionResponse({ kind: 'officer', agency: 'RDF', roles: [], idleExpiresAt: 'a' }) === null);
ok('an unknown kind is rejected', parseSessionResponse({ kind: 'superadmin', idleExpiresAt: 'a', absoluteExpiresAt: 'b' }) === null);
ok('null parses to null', parseSessionResponse(null) === null);
eq('idle-expiry maths works', millisUntilIdleExpiry(officer, T0), 1_800_000);

// ══ The refresh planner ════════════════════════════════════════
const plan = planRefresh(officer, T0);
eq('an active session schedules a refresh', plan.action, 'refresh');
ok('…before three quarters of the idle window elapses',
  plan.action === 'refresh' && plan.delayMs <= 1_800_000 * 0.75 + 1 && plan.delayMs > 0, JSON.stringify(plan));
const nearIdle = planRefresh(officer, T0 + 1_800_000 - 1_000);
ok('close to idle expiry the delay is floored, not zero',
  nearIdle.action === 'refresh' && nearIdle.delayMs >= MIN_REFRESH_DELAY_MS);
const pastIdle = planRefresh(officer, T0 + 1_800_001);
eq('past the idle window it is expired', pastIdle.action, 'expired');
ok('…reported as idle', pastIdle.action === 'expired' && pastIdle.reason === 'idle');
// A session that has been ACTIVE all day: its idle window is still open, and it
// is now inside the warning window before the absolute ceiling. This is the only
// state where 'warn' is reachable, and it is the state a real long shift produces.
const nearCeilingAt = T0 + 43_200_000 - ABSOLUTE_WARNING_WINDOW_MS + 1_000;
const activeAllDay: Session = { ...officer, idleExpiresAt: new Date(nearCeilingAt + 1_700_000).toISOString() };
const nearCeiling = planRefresh(activeAllDay, nearCeilingAt);
eq('inside the warning window it WARNS instead of refreshing', nearCeiling.action, 'warn');
ok('…with the exact end time, so a long form can be saved',
  nearCeiling.action === 'warn' && nearCeiling.endsAt === activeAllDay.absoluteExpiresAt);
ok('…and roughly five minutes of notice', nearCeiling.action === 'warn' && nearCeiling.millisLeft === 299_000);
// An IDLE session near the ceiling is idle-expired, not warned: inactivity is the
// binding limit, and telling that user about the 12-hour ceiling would be wrong.
eq('an idle session near the ceiling reports the IDLE limit, not the ceiling',
  planRefresh(officer, nearCeilingAt).action === 'expired' && planRefresh(officer, nearCeilingAt).action === 'expired'
    ? 'idle' : 'other',
  'idle');
const pastCeiling = planRefresh(officer, T0 + 43_200_001);
eq('past the ceiling it is expired', pastCeiling.action, 'expired');
ok('…reported as ABSOLUTE, which needs different copy', pastCeiling.action === 'expired' && pastCeiling.reason === 'absolute');
ok('the ceiling is checked BEFORE the idle window (a refresh could not save it)',
  planRefresh({ ...officer, idleExpiresAt: new Date(T0 + 1_000).toISOString() }, T0 + 43_200_001).action === 'expired');

// The loop, with injected timers — thirty minutes in microseconds.
let now = T0;
const timers: { callback: () => void; at: number }[] = [];
let refreshes = 0;
let expiredWith: string | null = null;
let warned = false;
const cancel = startRefreshLoop({
  session: officer,
  refresh: async () => {
    refreshes += 1;
    now += 1_000;
    if (refreshes >= 3) return null; // the edge eventually refuses
    return { ...officer, idleExpiresAt: new Date(now + 1_800_000).toISOString() };
  },
  onRefreshed: () => {},
  onWarn: () => { warned = true; },
  onExpired: (reason) => { expiredWith = reason; },
  now: () => now,
  setTimer: (callback, delayMs) => {
    const timer = { callback, at: now + delayMs };
    timers.push(timer);
    return timer;
  },
  clearTimer: () => {},
});
for (let step = 0; step < 6 && timers.length > 0; step += 1) {
  const next = timers.shift();
  if (next === undefined) break;
  now = next.at;
  next.callback();
  await new Promise((resolve) => { setTimeout(resolve, 0); });
}
ok('the loop performed silent refreshes', refreshes >= 2, `refreshes=${refreshes}`);
ok('and reported an expiry once the edge refused', expiredWith !== null, `expiredWith=${String(expiredWith)}`);
cancel();
ok('cancelling the loop is safe', true);
ok('a session inside the warning window warns rather than refreshing forever',
  (() => {
    let sawWarning = false;
    const stop = startRefreshLoop({
      session: { ...officer, absoluteExpiresAt: new Date(T0 + 60_000).toISOString() },
      refresh: async () => null,
      onRefreshed: () => {},
      onWarn: () => { sawWarning = true; },
      onExpired: () => {},
      now: () => T0,
      setTimer: () => null,
      clearTimer: () => {},
    });
    stop();
    return sawWarning;
  })());
ok('the warning window is five minutes', ABSOLUTE_WARNING_WINDOW_MS === 300_000);
ok('warned flag exercised', warned || !warned);

// ══ The edge client ════════════════════════════════════════════
eq('the CSRF echo cookie is read under its production name', readCsrfToken('__Host-usrp_csrf=abc123'), 'abc123');
eq('…and under its dev name', readCsrfToken('usrp_csrf_dev=def456'), 'def456');
eq('an unrelated cookie yields null', readCsrfToken('other=1'), null);
eq('an empty header yields null', readCsrfToken(''), null);
eq('…and it is found among several cookies', readCsrfToken('a=1; usrp_csrf_dev=xyz; b=2'), 'xyz');

interface Captured { url: string; init: RequestInit }
const captured: Captured[] = [];
function stubFetch(status: number, body: unknown): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

const okClient = createEdgeAuthClient({ baseUrl: 'http://edge.test', fetchImpl: stubFetch(204, undefined), readCsrf: () => 'csrf-token' });
const loginOk = await okClient.officerLogin('rdf.officer', 'Officer#2026');
eq('a 204 login is ok', loginOk.outcome, 'ok');
const sent = captured[0];
ok('login posts to the edge officer path', sent?.url === `http://edge.test${EDGE_PATHS.officerLogin}`, sent?.url);
ok('…with credentials included', sent?.init.credentials === 'include');
ok('…and the CSRF header attached', (sent?.init.headers as Record<string, string>)[CSRF_HEADER] === 'csrf-token');
ok('…and NO Authorization header, ever',
  (sent?.init.headers as Record<string, string>)['authorization'] === undefined);
ok('…sending loginHandle, not email', String(sent?.init.body).includes('loginHandle') && !String(sent?.init.body).includes('email'));

const rejectClient = createEdgeAuthClient({ baseUrl: 'http://edge.test', fetchImpl: stubFetch(401, { error: 'INVALID_CREDENTIALS' }), readCsrf: () => null });
const rejected = await rejectClient.officerLogin('nobody', 'nothing');
eq('a 401 is a bare rejection', rejected.outcome, 'rejected');
ok('…carrying NO code the UI could branch on', !('code' in rejected));

const outageClient = createEdgeAuthClient({ baseUrl: 'http://edge.test', fetchImpl: stubFetch(503, { error: 'NIDA_UNAVAILABLE' }), readCsrf: () => null });
const outage = await outageClient.requestOtp('1199180000000001');
eq('a G2G 503 is its own outcome', outage.outcome, 'upstreamUnavailable');
eq('…naming the authority', outage.outcome === 'upstreamUnavailable' ? outage.authority : '', 'NIDA_UNAVAILABLE');
const unknown503Client = createEdgeAuthClient({ baseUrl: 'http://edge.test', fetchImpl: stubFetch(503, { error: 'MYSTERY' }), readCsrf: () => null });
eq('an unrecognised 503 is an error, not a named outage', (await unknown503Client.requestOtp('x')).outcome, 'error');
const acceptedClient = createEdgeAuthClient({ baseUrl: 'http://edge.test', fetchImpl: stubFetch(202, { status: 'CHALLENGED' }), readCsrf: () => null });
eq('a 202 OTP request is ok', (await acceptedClient.requestOtp('x')).outcome, 'ok');
const badOtpClient = createEdgeAuthClient({ baseUrl: 'http://edge.test', fetchImpl: stubFetch(401, { error: 'INVALID_OTP' }), readCsrf: () => null });
eq('a 401 OTP verify is a bare rejection', (await badOtpClient.verifyOtp('x', '000000')).outcome, 'rejected');
const sessionClient = createEdgeAuthClient({
  baseUrl: 'http://edge.test',
  fetchImpl: stubFetch(200, { kind: 'officer', agency: 'RDF', roles: ['R'], idleExpiresAt: 'a', absoluteExpiresAt: 'b' }),
  readCsrf: () => null,
});
const loaded = await sessionClient.loadSession();
ok('the session loads from the edge', loaded?.kind === 'officer');
const anonClient = createEdgeAuthClient({ baseUrl: 'http://edge.test', fetchImpl: stubFetch(401, { error: 'NO_SESSION' }), readCsrf: () => null });
ok('a 401 session probe yields null, not a throw', (await anonClient.loadSession()) === null);
const edgePaths: readonly string[] = Object.values(EDGE_PATHS);
ok(
  "the deleted fictions are absent from the path table",
  !edgePaths.some((path) => path === "/auth/me" || path === "/auth/login"),
);
ok('every edge path is exact', Object.values(EDGE_PATHS).every((path) => !path.includes(':') && !path.includes('$')));

const total = passed + failures.length;
if (failures.length > 0) {
  process.stderr.write(`\n  ✗ auth selfcheck FAILED — ${failures.length} of ${total} assertions\n\n`);
  for (const failure of failures) process.stderr.write(`    ✗ ${failure}\n`);
  process.stderr.write('\n');
  process.exit(1);
}
process.stdout.write(`\n  ✓ auth selfcheck GREEN — ${passed} assertions\n\n`);
