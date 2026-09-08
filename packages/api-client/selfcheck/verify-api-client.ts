// ══════════════════════════════════════════════════════════════════
// @usrp/api-client selfcheck
//
//   pnpm --filter @usrp/api-client selfcheck
//
// Asserts the pure logic the socket-level edge proof cannot reach: error
// normalisation over the REAL discriminated bodies, the retry policy's refusals,
// and the invalidation map. Every fixture body below is transcribed from a
// backend controller, so a normaliser that "works" against invented shapes
// cannot pass.
// ══════════════════════════════════════════════════════════════════

import { ApiError, describeError, normaliseErrorBody, G2G_UNAVAILABLE_CODES } from '../src/errors.js';
import { backoffDelayMs, shouldRetry, withRetry, type RetryPolicy } from '../src/retry.js';
import { INVALIDATION_MAP, applicationKeys, applicantKeys, resolveInvalidation, sessionKeys } from '../src/keys.js';

let passed = 0;
const failures: string[] = [];

function ok(label: string, condition: boolean, detail?: string): void {
  if (condition) { passed += 1; return; }
  failures.push(detail === undefined ? label : `${label} — ${detail}`);
}
function eq<T>(label: string, actual: T, expected: T): void {
  ok(label, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function deepEq(label: string, actual: unknown, expected: unknown): void {
  ok(label, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ══ Error normalisation over REAL bodies ═══════════════════════

// withAuth 401 — iam-service officer login and every authed route.
const unauth = normaliseErrorBody(401, { error: 'UNAUTHENTICATED', detail: 'A bearer token is required.' });
eq('401 UNAUTHENTICATED normalises to unauthenticated', unauth.kind, 'unauthenticated');
// identity-service uses a DIFFERENT code at the same status for the session kind.
const badSession = normaliseErrorBody(401, { error: 'INVALID_SESSION', detail: 'A valid session token is required.' });
eq('401 INVALID_SESSION also normalises to unauthenticated', badSession.kind, 'unauthenticated');
ok('…and the distinct code survives for logging', badSession.kind === 'unauthenticated' && badSession.code === 'INVALID_SESSION');

// THREE incompatible 403 bodies exist platform-wide. All three must normalise.
const forbidA = normaliseErrorBody(403, { error: 'FORBIDDEN', detail: 'Officer principal required.' });
const forbidB = normaliseErrorBody(403, { error: 'FORBIDDEN' });
const forbidC = normaliseErrorBody(403, { status: 'AGENCY_MISMATCH' });
eq('403 from withAuth normalises', forbidA.kind, 'forbidden');
eq('403 from an outcome branch normalises', forbidB.kind, 'forbidden');
eq('403 from biometric-service (status-keyed) normalises', forbidC.kind, 'forbidden');
ok('…and the status-keyed 403 keeps its code', forbidC.kind === 'forbidden' && forbidC.code === 'AGENCY_MISMATCH');

// The bare 404 is an anti-enumeration device and must stay bare.
const notFoundRead = normaliseErrorBody(404, { error: 'NOT_FOUND' });
const notFoundWrite = normaliseErrorBody(404, { status: 'NOT_FOUND' });
eq('the read-shaped 404 normalises', notFoundRead.kind, 'notFound');
eq('the write-shaped 404 normalises identically', notFoundWrite.kind, 'notFound');
deepEq('a normalised 404 carries NO detail (no cross-agency existence oracle)', notFoundRead, { kind: 'notFound', status: 404 });
deepEq('…and the two shapes are indistinguishable afterwards', notFoundRead, notFoundWrite);

// ADR-014: the outcome and its payload must both survive.
const locked = normaliseErrorBody(409, { status: 'CROSS_AGENCY_LOCKED', lockedByAgency: 'RNP' });
eq('409 CROSS_AGENCY_LOCKED is a conflict', locked.kind, 'conflict');
ok('…keeping the outcome name', locked.kind === 'conflict' && locked.outcome === 'CROSS_AGENCY_LOCKED');
ok('…and the locking agency the UI must show', locked.kind === 'conflict' && locked.data['lockedByAgency'] === 'RNP');

// ADR-012: AGE_PENDING is the officer's retry, and carries the current status.
const agePending = normaliseErrorBody(409, { status: 'AGE_PENDING', currentStatus: 'WALK_IN_REGISTERED' });
eq('409 AGE_PENDING is a conflict, not an outage', agePending.kind, 'conflict');
ok('…with currentStatus preserved', agePending.kind === 'conflict' && agePending.data['currentStatus'] === 'WALK_IN_REGISTERED');
ok('…and is NOT retryable by the client', !new ApiError(agePending, 'x').isRetryable);

// ADR-013: the agency-mode mismatch.
const wrongMode = normaliseErrorBody(422, { status: 'INVALID_MEDICAL_INPUT', reason: 'AGENCY_USES_CERTIFICATE' });
eq('422 INVALID_MEDICAL_INPUT is unprocessable', wrongMode.kind, 'unprocessable');
ok('…with the reason that names the agency mode', wrongMode.kind === 'unprocessable' && wrongMode.data['reason'] === 'AGENCY_USES_CERTIFICATE');

// 501 is a permanent answer, not a fault: hide the control, do not offer a retry.
const unsupported = normaliseErrorBody(501, { status: 'UNSUPPORTED_AGENCY', agency: 'RNP' });
eq('501 UNSUPPORTED_AGENCY has its own kind', unsupported.kind, 'unsupportedAgency');
ok('…naming the agency', unsupported.kind === 'unsupportedAgency' && unsupported.agency === 'RNP');
ok('…and is not retryable', !new ApiError(unsupported, 'x').isRetryable);

// 400 detail IS safe to show (expose = status < 500).
const badRequest = normaliseErrorBody(400, { error: 'INVALID_APPLICATION_ID', detail: 'Field "applicationId" must be a UUID.' });
eq('400 normalises to badRequest', badRequest.kind, 'badRequest');
ok('…and keeps the caller-facing detail', badRequest.kind === 'badRequest' && badRequest.detail?.includes('UUID') === true);

// walk-in.controller.ts builds codes by upper-casing field names, producing
// MISSING_APPLICANTID where every sibling emits MISSING_APPLICANT_ID.
const misspelled = normaliseErrorBody(400, { error: 'MISSING_APPLICANTID', detail: 'Field "applicantId" is required.' });
ok('the walk-in controller\'s odd MISSING_APPLICANTID spelling still normalises',
  misspelled.kind === 'badRequest' && misspelled.code === 'MISSING_APPLICANTID');

// 5xx detail is discarded upstream; we must not invent one.
const serverError = normaliseErrorBody(500, { error: 'APPLICATION_PERSISTENCE_ERROR' });
eq('500 normalises to serverError', serverError.kind, 'serverError');
const upstreamDown = normaliseErrorBody(502, { error: 'UPSTREAM_UNREACHABLE' });
eq('502 is a serverError, NOT a retryable G2G fault', upstreamDown.kind, 'serverError');
ok('…and is explicitly not retryable (a refused socket may have half-written)',
  !new ApiError(upstreamDown, 'x').isRetryable);

// ══ G2G: the ONLY retryable class ══════════════════════════════
for (const code of G2G_UNAVAILABLE_CODES) {
  const fault = normaliseErrorBody(503, { error: code });
  ok(`503 ${code} is a named G2G outage`, fault.kind === 'g2gUnavailable');
  ok(`…and names the authority (${code})`, fault.kind === 'g2gUnavailable' && fault.authority === code);
  ok(`…and is retryable (${code})`, new ApiError(fault, 'x').isRetryable);
}
const unknown503 = normaliseErrorBody(503, { error: 'SOMETHING_ELSE_UNAVAILABLE' });
eq('an UNRECOGNISED 503 is NOT treated as a transient G2G fault', unknown503.kind, 'serverError');
ok('…so an unknown outage cannot become a thundering herd', !new ApiError(unknown503, 'x').isRetryable);
const empty = normaliseErrorBody(503, null);
eq('a 503 with no body is not retryable either', empty.kind, 'serverError');

eq('describeError never emits a body', describeError(locked), '409 CROSS_AGENCY_LOCKED');
eq('describeError on a bare 404 says only 404', describeError(notFoundRead), '404');

// ══ Retry policy ═══════════════════════════════════════════════
const g2g = new ApiError(normaliseErrorBody(503, { error: 'NIDA_UNAVAILABLE' }), 'x');
const conflict = new ApiError(locked, 'x');
ok('a G2G fault on a retryable operation retries', shouldRetry(g2g, true));
ok('the SAME fault on a NON-retryable operation does NOT retry', !shouldRetry(g2g, false));
ok('a conflict never retries, even on a retryable operation', !shouldRetry(conflict, true));
ok('a plain Error never retries', !shouldRetry(new Error('boom'), true));

const policy: RetryPolicy = { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 1_000, random: () => 1, sleep: async () => {} };
eq('backoff attempt 0', backoffDelayMs(0, policy), 100);
eq('backoff attempt 1 doubles', backoffDelayMs(1, policy), 200);
eq('backoff attempt 4 is capped', backoffDelayMs(4, policy), 1_000);
eq('full jitter can floor to zero', backoffDelayMs(3, { ...policy, random: () => 0 }), 0);

let readAttempts = 0;
const readResult = await withRetry(async () => {
  readAttempts += 1;
  if (readAttempts < 3) throw g2g;
  return 'ok';
}, true, policy);
eq('a retryable read succeeds on the third attempt', readResult, 'ok');
eq('…having made exactly three attempts', readAttempts, 3);

let writeAttempts = 0;
try {
  await withRetry(async () => { writeAttempts += 1; throw g2g; }, false, policy);
} catch { /* expected */ }
eq('a WRITE facing the same G2G fault is attempted exactly ONCE', writeAttempts, 1);

let exhausted = 0;
try {
  await withRetry(async () => { exhausted += 1; throw g2g; }, true, policy);
  ok('an exhausted retry must throw', false);
} catch (err) {
  ok('an exhausted retry throws the original ApiError', err instanceof ApiError);
  ok('…preserving the authority for the message', err instanceof ApiError && err.normalised.kind === 'g2gUnavailable');
}
eq('…after maxRetries + 1 attempts', exhausted, 3);

let conflictAttempts = 0;
try {
  await withRetry(async () => { conflictAttempts += 1; throw conflict; }, true, policy);
} catch { /* expected */ }
eq('a 409 is never retried', conflictAttempts, 1);

// ══ Query keys and the invalidation map ════════════════════════
deepEq('the officer list is keyed by agency', applicationKeys.list('RDF'), ['applications', 'list', 'RDF']);
ok('two agencies do not share a cache slot',
  JSON.stringify(applicationKeys.list('RDF')) !== JSON.stringify(applicationKeys.list('RNP')));
deepEq('citizen applications are NOT agency-keyed (a citizen is cross-agency)', applicantKeys.myApplications(), ['applicant', 'applications']);

const transitions = ['recordMedicalReview', 'recordFinalDecision', 'acceptApplication', 'adjudicateApplication'];
for (const name of transitions) {
  const targets = INVALIDATION_MAP[name] ?? [];
  ok(`${name} invalidates the list`, targets.includes('applications:list'));
  ok(`${name} invalidates the row`, targets.includes('applications:detail'));
  ok(`${name} invalidates the status history (append-only, so it always grew)`, targets.includes('applications:status-history'));
}
ok('medical-review invalidates the AMBER QUEUE (an adverse verdict routes there)',
  (INVALIDATION_MAP['recordMedicalReview'] ?? []).includes('applications:amber-queue'));
ok('adjudicate invalidates the amber queue (it is how a row leaves)',
  (INVALIDATION_MAP['adjudicateApplication'] ?? []).includes('applications:amber-queue'));
ok('accept reaches into CITIZEN caches (ADR-017 auto-withdrawal)',
  (INVALIDATION_MAP['acceptApplication'] ?? []).includes('applicant:applications'));
deepEq('verifyIdentity invalidates NOTHING, and says so explicitly', INVALIDATION_MAP['verifyIdentity'], []);
ok('erasure invalidates the session too (ADR-015 terminates it)',
  (INVALIDATION_MAP['eraseIdentity'] ?? []).includes('session:current'));
ok('every transition appears in the map', transitions.every((name) => INVALIDATION_MAP[name] !== undefined));
ok('registerWalkIn invalidates the list but has no row yet',
  JSON.stringify(INVALIDATION_MAP['registerWalkIn']) === JSON.stringify(['applications:list']));

const resolved = resolveInvalidation(INVALIDATION_MAP['acceptApplication'] ?? [], { agency: 'RDF', applicationId: 'app-1' });
eq('accept resolves to five concrete key families', resolved.length, 5);
deepEq('…including the agency-scoped list', resolved[0], applicationKeys.list('RDF'));
deepEq('…and the citizen cache last (ADR-017 auto-withdrawal)', resolved[4], applicantKeys.myApplications());
deepEq('the session key resolves on its own target', resolveInvalidation(['session:current'], {})[0], sessionKeys.current());
const withoutContext = resolveInvalidation(['applications:detail'], {});
eq('a detail target with no applicationId resolves to nothing (never a broad nuke)', withoutContext.length, 0);

const total = passed + failures.length;
if (failures.length > 0) {
  process.stderr.write(`\n  ✗ api-client selfcheck FAILED — ${failures.length} of ${total} assertions\n\n`);
  for (const failure of failures) process.stderr.write(`    ✗ ${failure}\n`);
  process.stderr.write('\n');
  process.exit(1);
}
process.stdout.write(`\n  ✓ api-client selfcheck GREEN — ${passed} assertions\n\n`);
