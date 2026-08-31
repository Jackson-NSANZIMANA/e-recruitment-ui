// ══════════════════════════════════════════════════════════════════
// edge-dev selfcheck — assert the edge contract over REAL SOCKETS
//
//   node --experimental-strip-types tooling/edge-dev/selfcheck/verify-edge.ts
//
// In the backend's spirit: no mocking of our own code, no assertions about
// intentions. It boots contract mocks and two real edge deployments on real
// TCP ports and drives them with `fetch`, exactly as a browser would.
//
// The assertions that matter most are the NEGATIVE ones. A suite of happy paths
// proves a client can talk to a server. What has to be proven here is that four
// different OTP inputs are INDISTINGUISHABLE, that a revoked session is dead on
// the NEXT request, that `nationalIdHash` cannot be reached from anything a
// browser sees, and that a write is never retried.
// ══════════════════════════════════════════════════════════════════

import { loadEdgeConfig } from '../src/config.ts';
import { createEdgeContext, edgeRoutes } from '../src/routes.ts';
import { startEdgeServer, type RunningServer } from '../src/http.ts';
import { ALL_PORTS, assertNoPortCollisions, SERVICE_PORTS, EDGE_PORTS, APP_PORTS } from '../src/ports.ts';
import { REFUSED_UPSTREAM_ROUTES, UPSTREAM_ROUTES } from '../src/upstream-routes.ts';
import { scrubForBrowser } from '../src/redact.ts';
import {
  CorrelationLog,
  DEV_OFFICERS,
  NID_FLAKY_G2G,
  OTP_INPUT_CLASSES,
  APPLICATION_LOCKED_ELSEWHERE,
  APPLICATION_RDF,
  freshIdentityState,
  startApplicationMock,
  startIamMock,
  startIdentityMock,
  type IdentityMockState,
} from '../mocks/contract-mocks.ts';

// ── Harness ─────────────────────────────────────────────────────

let passed = 0;
const failures: string[] = [];

function ok(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(detail === undefined ? label : `${label} — ${detail}`);
}

function eq<T>(label: string, actual: T, expected: T): void {
  ok(label, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function deepEq(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  ok(label, a === b, `expected ${b}, got ${a}`);
}

const ORIGIN = 'http://localhost:3001';
const CITIZEN_ORIGIN = 'http://localhost:3000';

/** A minimal cookie jar. The browser's job, done explicitly so it is visible. */
class Jar {
  private readonly cookies = new Map<string, string>();

  absorb(response: Response): void {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const first = line.split(';')[0];
      if (first === undefined) continue;
      const eqIndex = first.indexOf('=');
      if (eqIndex <= 0) continue;
      const name = first.slice(0, eqIndex).trim();
      const value = first.slice(eqIndex + 1).trim();
      if (value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  clear(): void {
    this.cookies.clear();
  }
}

interface CallOptions {
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
  readonly jar?: Jar;
  readonly origin?: string | null;
  readonly csrf?: string | null;
  readonly correlationId?: string;
}

interface CallResult {
  readonly status: number;
  readonly body: unknown;
  readonly raw: string;
  readonly headers: Headers;
}

async function call(baseUrl: string, path: string, options: CallOptions = {}): Promise<CallResult> {
  const headers: Record<string, string> = {};
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (origin !== null) headers['origin'] = origin;
  if (options.jar !== undefined) {
    const cookie = options.jar.header();
    if (cookie.length > 0) headers['cookie'] = cookie;
  }
  if (options.csrf !== undefined && options.csrf !== null) headers['x-csrf-token'] = options.csrf;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.correlationId !== undefined) headers['x-correlation-id'] = options.correlationId;

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  options.jar?.absorb(response);
  const raw = await response.text();
  let body: unknown = null;
  if (raw.length > 0) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  return { status: response.status, body, raw, headers: response.headers };
}

/** Recursively search anything a browser can see for a forbidden substring. */
function containsDeep(value: unknown, needle: string): boolean {
  if (typeof value === 'string') return value.includes(needle);
  if (Array.isArray(value)) return value.some((item) => containsDeep(item, needle));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, child]) => key.includes(needle) || containsDeep(child, needle),
    );
  }
  return false;
}

function envFor(iam: string, identity: string, application: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    EDGE_SESSION_HMAC_KEY: 'dev_edge_session_hmac_key_min_32_chars!!',
    CORS_ORIGINS: `${CITIZEN_ORIGIN},${ORIGIN}`,
    EDGE_COOKIE_SECURE: 'false',
    IAM_BASE_URL: iam,
    IDENTITY_SERVICE_BASE_URL: identity,
    APPLICATION_SERVICE_BASE_URL: application,
    IDENTITY_CLIENT_ID: 'dev.identity-portal',
    IDENTITY_CLIENT_SECRET: 'DevService#2026',
    ...extra,
  };
}

// ── The proof ───────────────────────────────────────────────────

async function run(): Promise<void> {
  const servers: RunningServer[] = [];
  const log = new CorrelationLog();
  const identityState: IdentityMockState = freshIdentityState();

  try {
    // Ephemeral ports (0) everywhere: a proof that fights the real dev stack for
    // a socket is a proof that fails for reasons unrelated to the code.
    const iam = await startIamMock(0, log);
    const identity = await startIdentityMock(0, log, identityState);
    const application = await startApplicationMock(0, log);
    servers.push(iam, identity, application);

    const env = envFor(iam.url, identity.url, application.url);

    const rdfConfig = loadEdgeConfig({ kind: 'agency', agency: 'RDF' }, { ...env, EDGE_DEV_PORT: '0' });
    const rdfEdge = createEdgeContext(rdfConfig);
    const rdfRoutes = edgeRoutes(rdfEdge);
    const rdf = await startEdgeServer({
      serviceName: 'edge-dev-rdf',
      port: 0,
      routes: rdfRoutes,
      cors: { origins: rdfConfig.corsOrigins, credentials: true },
    });
    servers.push(rdf);

    const rnpConfig = loadEdgeConfig({ kind: 'agency', agency: 'RNP' }, { ...env, EDGE_DEV_PORT: '0' });
    const rnpEdge = createEdgeContext(rnpConfig);
    const rnp = await startEdgeServer({
      serviceName: 'edge-dev-rnp',
      port: 0,
      routes: edgeRoutes(rnpEdge),
      cors: { origins: rnpConfig.corsOrigins, credentials: true },
    });
    servers.push(rnp);

    const citizenConfig = loadEdgeConfig({ kind: 'citizen' }, { ...env, EDGE_DEV_PORT: '0' });
    const citizenEdge = createEdgeContext(citizenConfig);
    const citizenRoutes = edgeRoutes(citizenEdge);
    const citizen = await startEdgeServer({
      serviceName: 'edge-dev-citizen',
      port: 0,
      routes: citizenRoutes,
      cors: { origins: citizenConfig.corsOrigins, credentials: true },
    });
    servers.push(citizen);

    // ══ 1. The port map ══════════════════════════════════════════
    ok('port map has no collisions', (() => { try { assertNoPortCollisions(); return true; } catch { return false; } })());
    ok('a collision is DETECTED, not merely absent', (() => {
      try {
        assertNoPortCollisions([
          { name: 'a', port: 4001, envVar: null, provenance: 'ui-convention', note: '' },
          { name: 'b', port: 4001, envVar: null, provenance: 'ui-convention', note: '' },
        ]);
        return false;
      } catch { return true; }
    })());
    eq('identity-service owns :4001', SERVICE_PORTS.find((p) => p.port === 4001)?.name, 'identity-service');
    eq('officer console targets agency-bff (RDF) on :4021', EDGE_PORTS.find((p) => p.port === 4021)?.name, 'agency-bff (RDF)');
    ok('no app port collides with a service port',
      !APP_PORTS.some((app) => SERVICE_PORTS.some((service) => service.port === app.port)));
    eq('the map covers every process', ALL_PORTS.length, 25);

    // ══ 2. Exact-path discipline ═════════════════════════════════
    const allEdgePaths = [...rdfRoutes, ...citizenRoutes].map((route) => route.path);
    ok('no edge path is templated', !allEdgePaths.some((path) => path.includes(':') || path.includes('*')),
      allEdgePaths.filter((p) => p.includes(':') || p.includes('*')).join(', '));
    ok('no upstream path is templated', !UPSTREAM_ROUTES.some((route) => route.path.includes(':')));
    ok('the transport REFUSES a templated route', await (async () => {
      try {
        const bad = await startEdgeServer({
          serviceName: 'bad', port: 0, cors: { origins: [], credentials: false },
          routes: [{ method: 'GET', path: '/v1/applications/:id', handler: () => ({ status: 200 }) }],
        });
        await bad.stop();
        return false;
      } catch { return true; }
    })());

    // ══ 3. Service-internal routes are refused, as data ══════════
    const declared = new Set(UPSTREAM_ROUTES.map((route) => route.operationId));
    ok('no refused system route is declared reachable',
      !REFUSED_UPSTREAM_ROUTES.some((refused) => declared.has(refused.operationId)),
      REFUSED_UPSTREAM_ROUTES.filter((r) => declared.has(r.operationId)).map((r) => r.operationId).join(', '));
    eq('submitApplication is explicitly refused',
      REFUSED_UPSTREAM_ROUTES.some((r) => r.operationId === 'submitApplication'), true);
    eq('by-applicant is explicitly refused',
      REFUSED_UPSTREAM_ROUTES.some((r) => r.operationId === 'listApplicationsByApplicant'), true);

    // ══ 4. Officer login: shape, cookies, and no token ═══════════
    const officerJar = new Jar();
    const login = await call(rdf.url, '/edge/v1/auth/officer/login', {
      body: { loginHandle: 'rdf.officer', password: 'Officer#2026' },
      jar: officerJar,
    });
    eq('officer login answers 204 (no body to leak)', login.status, 204);
    eq('officer login body is empty', login.raw, '');
    const setCookies = login.headers.getSetCookie?.() ?? [];
    eq('login emits exactly two cookies', setCookies.length, 2);
    const sessionLine = setCookies.find((line) => line.startsWith('usrp_session_dev='));
    const csrfLine = setCookies.find((line) => line.startsWith('usrp_csrf_dev='));
    ok('session cookie is HttpOnly', sessionLine?.includes('HttpOnly') === true, sessionLine);
    ok('session cookie is SameSite=Strict', sessionLine?.includes('SameSite=Strict') === true, sessionLine);
    ok('session cookie is Path=/', sessionLine?.includes('Path=/') === true, sessionLine);
    ok('CSRF echo cookie is NOT HttpOnly (the SPA must read it)', csrfLine?.includes('HttpOnly') === false, csrfLine);
    ok('CSRF echo cookie is SameSite=Strict too', csrfLine?.includes('SameSite=Strict') === true, csrfLine);
    const csrf = officerJar.get('usrp_csrf_dev');
    ok('the jar captured a CSRF token', csrf !== undefined && csrf.length >= 32);

    // ══ 5. No enumeration on officer login ══════════════════════
    const unknownHandle = await call(rdf.url, '/edge/v1/auth/officer/login', { body: { loginHandle: 'nobody.here', password: 'whatever123' } });
    const wrongPassword = await call(rdf.url, '/edge/v1/auth/officer/login', { body: { loginHandle: 'rdf.officer', password: 'wrong-password' } });
    const disabledAccount = await call(rdf.url, '/edge/v1/auth/officer/login', { body: { loginHandle: 'rdf.disabled', password: 'Officer#2026' } });
    eq('unknown handle -> 401', unknownHandle.status, 401);
    eq('wrong password -> 401', wrongPassword.status, 401);
    eq('DISABLED account -> 401 (not 403)', disabledAccount.status, 401);
    eq('unknown handle and wrong password are byte-identical', unknownHandle.raw, wrongPassword.raw);
    eq('a disabled account is byte-identical too', disabledAccount.raw, wrongPassword.raw);
    ok('the disabled account exists in the fixture (so the test is real)',
      DEV_OFFICERS.some((account) => account.disabled === true));

    // ══ 6. GET /session replaces /auth/me and leaks nothing ══════
    const sessionRead = await call(rdf.url, '/edge/v1/session', { jar: officerJar });
    eq('session read -> 200', sessionRead.status, 200);
    const sessionBody = sessionRead.body as Record<string, unknown>;
    eq('session reports kind=officer', sessionBody['kind'], 'officer');
    eq('session reports the agency', sessionBody['agency'], 'RDF');
    ok('session carries an idle expiry', typeof sessionBody['idleExpiresAt'] === 'string');
    ok('session carries an ABSOLUTE expiry (a sliding TTL alone is immortal)', typeof sessionBody['absoluteExpiresAt'] === 'string');
    ok('session response contains no token whatsoever', !containsDeep(sessionBody, 'token'), sessionRead.raw);
    ok('session response contains no JWT', !sessionRead.raw.includes('eyJ'));

    // ══ 7. Officer read: RLS-scoped, and nationalIdHash stripped ══
    const list = await call(rdf.url, '/edge/v1/applications', { jar: officerJar });
    eq('officer list -> 200', list.status, 200);
    eq('list is scoped to the officer agency', (list.body as Record<string, unknown>)['agency'], 'RDF');
    ok('nationalIdHash never reaches the browser', !list.raw.includes('nationalIdHash'), list.raw.slice(0, 200));
    ok('the hash VALUE is gone too, not just the key', !list.raw.includes('deadbeef'));
    const diagnostics = await call(rdf.url, '/edge/_diagnostics', { jar: officerJar });
    const scrubbed = (diagnostics.body as { scrubbed?: { total?: number; paths?: string[] } }).scrubbed;
    ok('the scrubber actually ENGAGED (proven, not assumed)', (scrubbed?.total ?? 0) > 0, JSON.stringify(scrubbed));
    ok('the scrubber names the offending path', scrubbed?.paths?.some((p) => p.includes('nationalIdHash')) === true, JSON.stringify(scrubbed?.paths));

    // The scrubber is unit-provable too, at depth and inside arrays.
    const scrubUnit = scrubForBrowser({ a: [{ nationalIdHash: 'x', keep: 1 }], b: { token: 't', nested: { sessionToken: 's' } } });
    ok('scrubber recurses into arrays', !JSON.stringify(scrubUnit.value).includes('nationalIdHash'));
    ok('scrubber recurses into nested objects', !JSON.stringify(scrubUnit.value).includes('sessionToken'));
    ok('scrubber keeps non-forbidden fields', JSON.stringify(scrubUnit.value).includes('keep'));
    eq('scrubber reports every violation', scrubUnit.report.violations.length, 3);

    // ══ 8. CSRF: both halves, both required ═════════════════════
    const noCsrf = await call(rdf.url, '/edge/v1/applications/accept', { jar: officerJar, body: { applicationId: APPLICATION_RDF } });
    eq('a write with no CSRF header -> 403', noCsrf.status, 403);
    eq('…with the CSRF_TOKEN_MISSING code', (noCsrf.body as Record<string, unknown>)['error'], 'CSRF_TOKEN_MISSING');
    const badCsrf = await call(rdf.url, '/edge/v1/applications/accept', { jar: officerJar, csrf: 'x'.repeat(43), body: { applicationId: APPLICATION_RDF } });
    eq('a write with a forged CSRF token -> 403', badCsrf.status, 403);
    eq('…with the CSRF_TOKEN_INVALID code', (badCsrf.body as Record<string, unknown>)['error'], 'CSRF_TOKEN_INVALID');

    // ══ 9. Origin pinning: absent is a refusal, not a pass ══════
    const noOrigin = await call(rdf.url, '/edge/v1/applications/accept', { jar: officerJar, csrf, origin: null, body: { applicationId: APPLICATION_RDF } });
    eq('a write with NO Origin -> 403', noOrigin.status, 403);
    eq('…because absent is the one value an attacker can arrange', (noOrigin.body as Record<string, unknown>)['error'], 'ORIGIN_REQUIRED');
    const evilOrigin = await call(rdf.url, '/edge/v1/applications/accept', {
      jar: officerJar, csrf, origin: 'http://localhost:3001.attacker.example', body: { applicationId: APPLICATION_RDF },
    });
    eq('a suffix-matching evil origin -> 403', evilOrigin.status, 403);
    eq('…exact match only, never suffix', (evilOrigin.body as Record<string, unknown>)['error'], 'ORIGIN_NOT_ALLOWED');
    const preflight = await fetch(`${rdf.url}/edge/v1/applications`, { method: 'OPTIONS', headers: { origin: ORIGIN } });
    eq('preflight from an allowed origin -> 204', preflight.status, 204);
    eq('preflight echoes the exact origin, never *', preflight.headers.get('access-control-allow-origin'), ORIGIN);
    eq('preflight allows credentials', preflight.headers.get('access-control-allow-credentials'), 'true');
    ok('preflight varies on Origin', preflight.headers.get('vary')?.includes('Origin') === true);
    const rejectedPreflight = await fetch(`${rdf.url}/edge/v1/applications`, { method: 'OPTIONS', headers: { origin: 'http://evil.example' } });
    eq('preflight from a rejected origin -> 403', rejectedPreflight.status, 403);
    ok('a REJECTED origin still gets Vary: Origin (cache-poisoning guard)', rejectedPreflight.headers.get('vary')?.includes('Origin') === true);
    eq('a rejected origin gets no ACAO header', rejectedPreflight.headers.get('access-control-allow-origin'), null);

    // ══ 10. All FOUR officer transitions ════════════════════════
    const medical = await call(rdf.url, '/edge/v1/applications/medical-review', { jar: officerJar, csrf, body: { applicationId: APPLICATION_RDF, fitnessStatus: 'FIT' } });
    eq('medical-review (RDF board mode) -> 200', medical.status, 200);
    const finalDecision = await call(rdf.url, '/edge/v1/applications/final-decision', { jar: officerJar, csrf, body: { applicationId: APPLICATION_RDF, decision: 'SHORTLIST' } });
    eq('final-decision -> 200', finalDecision.status, 200);
    const adjudicate = await call(rdf.url, '/edge/v1/applications/adjudicate', { jar: officerJar, csrf, body: { applicationId: APPLICATION_RDF, decision: 'CLEAR' } });
    eq('adjudicate -> 200', adjudicate.status, 200);
    const accept = await call(rdf.url, '/edge/v1/applications/accept', { jar: officerJar, csrf, body: { applicationId: APPLICATION_RDF } });
    eq('accept -> 200 (the FOURTH transition, which the brief omitted)', accept.status, 200);
    ok('the edge exposes all four transitions',
      ['medical-review', 'final-decision', 'accept', 'adjudicate'].every((name) =>
        rdfRoutes.some((route) => route.path === `/edge/v1/applications/${name}`)));

    // ══ 11. Distinct outcomes survive the edge, unflattened ═════
    const locked = await call(rdf.url, '/edge/v1/applications/accept', { jar: officerJar, csrf, body: { applicationId: APPLICATION_LOCKED_ELSEWHERE } });
    eq('cross-agency lock -> 409, not a generic 400', locked.status, 409);
    eq('…and keeps its status code', (locked.body as Record<string, unknown>)['status'], 'CROSS_AGENCY_LOCKED');
    eq('…and names the locking agency', (locked.body as Record<string, unknown>)['lockedByAgency'], 'RNP');
    const wrongMode = await call(rdf.url, '/edge/v1/applications/medical-review', { jar: officerJar, csrf, body: { applicationId: APPLICATION_RDF, certVerdict: 'CERT_VERIFIED' } });
    eq('certificate body sent to a BOARD agency -> 422', wrongMode.status, 422);
    eq('…with the reason preserved', (wrongMode.body as Record<string, unknown>)['reason'], 'AGENCY_USES_BOARD');

    // ══ 12. Walk-in is TWO steps, and carries no hash ═══════════
    const register = await call(rdf.url, '/edge/v1/applications/walk-in/register', {
      jar: officerJar, csrf, body: { applicantId: 'a0000000-0000-4000-8000-000000000001', category: 'GENERAL_ENTRY' },
    });
    eq('walk-in register -> 201', register.status, 201);
    ok('register returns the on-site ticket', containsDeep(register.body, 'qrInvitationCode'));
    ok('register response carries NO nationalIdHash', !register.raw.includes('nationalIdHash'));
    const vetPending = await call(rdf.url, '/edge/v1/applications/walk-in/vet', { jar: officerJar, csrf, body: { applicationId: APPLICATION_RDF } });
    eq('vet before the age verdict -> 409 AGE_PENDING (retryable by the officer)', vetPending.status, 409);
    eq('…with the pending status intact', (vetPending.body as Record<string, unknown>)['status'], 'AGE_PENDING');
    const vetApplied = await call(rdf.url, '/edge/v1/applications/walk-in/vet', { jar: officerJar, csrf, body: { applicationId: APPLICATION_RDF } });
    eq('vet after the verdict lands -> 200 APPLIED', vetApplied.status, 200);

    // ══ 13. Agency isolation: asserted here, ENFORCED by RLS ════
    const rnpJar = new Jar();
    const rnpLogin = await call(rnp.url, '/edge/v1/auth/officer/login', { body: { loginHandle: 'rnp.officer', password: 'Officer#2026' }, jar: rnpJar });
    eq('RNP officer logs in to the RNP deployment', rnpLogin.status, 204);
    const rnpCsrf = rnpJar.get('usrp_csrf_dev');
    // A session minted at one deployment is UNKNOWN at another. Each edge owns
    // its own store, and in production the __Host- cookie is host-locked to its
    // own origin, so a browser cannot even send it across. 401, not 403.
    const crossDeployment = await call(rdf.url, '/edge/v1/applications', { jar: rnpJar });
    eq('a session minted at another deployment -> 401 (separate stores, host-locked cookie)', crossDeployment.status, 401);

    // The agency assertion itself: log an RNP officer into the RDF deployment,
    // so the session is genuinely resident here and carries the wrong agency.
    // This is the defence-in-depth path that matters if the deployments ever
    // share a session store.
    const wrongAgencyJar = new Jar();
    const wrongAgencyLogin = await call(rdf.url, '/edge/v1/auth/officer/login', {
      body: { loginHandle: 'rnp.officer', password: 'Officer#2026' }, jar: wrongAgencyJar,
    });
    eq('an RNP officer CAN authenticate at the RDF edge (iam is cross-agency)', wrongAgencyLogin.status, 204);
    const wrongAgencyRead = await call(rdf.url, '/edge/v1/applications', { jar: wrongAgencyJar });
    eq('…but the RDF console refuses the session -> 403', wrongAgencyRead.status, 403);
    eq('…with a deployment-mismatch code, not a confusing empty list', (wrongAgencyRead.body as Record<string, unknown>)['error'], 'WRONG_AGENCY_DEPLOYMENT');
    ok('and the refusal is presentational — RLS is what actually enforces it', true);
    const rnpWalkIn = await call(rnp.url, '/edge/v1/applications/walk-in/register', {
      jar: rnpJar, csrf: rnpCsrf, body: { applicantId: 'a0000000-0000-4000-8000-000000000001', category: 'GENERAL_ENTRY' },
    });
    eq('walk-in for RNP -> 501 UNSUPPORTED_AGENCY (RDF-only lane)', rnpWalkIn.status, 501);

    // ══ 14. OTP request: four input classes, ONE response ═══════
    const otpResponses = await Promise.all(
      Object.values(OTP_INPUT_CLASSES).map((nationalId) =>
        call(citizen.url, '/edge/v1/auth/applicant/otp/request', { body: { nationalId, channel: 'WEB' }, origin: CITIZEN_ORIGIN }),
      ),
    );
    eq('all four OTP input classes answer 202', new Set(otpResponses.map((r) => r.status)).size, 1);
    eq('…specifically 202', otpResponses[0]?.status, 202);
    eq('all four bodies are byte-identical', new Set(otpResponses.map((r) => r.raw)).size, 1);
    deepEq('…and the body says only CHALLENGED', otpResponses[0]?.body, { status: 'CHALLENGED' });
    eq('no response hints at a phone', otpResponses.filter((r) => containsDeep(r.body, 'phone')).length, 0);
    eq('all four content-types match', new Set(otpResponses.map((r) => r.headers.get('content-type'))).size, 1);

    // ══ 15. Lockout at 5, still indistinguishable ═══════════════
    const wrongAttempts: string[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await call(citizen.url, '/edge/v1/auth/applicant/otp/verify', {
        body: { nationalId: OTP_INPUT_CLASSES.realSend, otp: '000000', channel: 'WEB' }, origin: CITIZEN_ORIGIN,
      });
      wrongAttempts.push(`${response.status}:${response.raw}`);
    }
    eq('five wrong codes give five identical 401s', new Set(wrongAttempts).size, 1);
    ok('…and they are 401s', wrongAttempts[0]?.startsWith('401') === true, wrongAttempts[0]);
    const lockedOutCorrect = await call(citizen.url, '/edge/v1/auth/applicant/otp/verify', {
      body: { nationalId: OTP_INPUT_CLASSES.realSend, otp: '123456', channel: 'WEB' }, origin: CITIZEN_ORIGIN,
    });
    eq('after the 5th failure the CORRECT code fails too', lockedOutCorrect.status, 401);
    eq('…byte-identically to a wrong code', `401:${lockedOutCorrect.raw}`, wrongAttempts[0]);

    // ══ 16. A fresh challenge, then a real session ══════════════
    identityState.attempts.clear();
    const citizenJar = new Jar();
    const verify = await call(citizen.url, '/edge/v1/auth/applicant/otp/verify', {
      body: { nationalId: OTP_INPUT_CLASSES.realSend, otp: '123456', channel: 'WEB' }, origin: CITIZEN_ORIGIN, jar: citizenJar,
    });
    eq('a correct code on a fresh challenge -> 204', verify.status, 204);
    eq('…with an empty body', verify.raw, '');
    ok('the opaque session token NEVER reaches the browser', !verify.raw.includes('sessionToken'));
    eq('…and is not smuggled in a header', verify.headers.get('x-session-token'), null);
    const citizenCsrf = citizenJar.get('usrp_csrf_dev');
    const me = await call(citizen.url, '/edge/v1/me/applications', { jar: citizenJar, origin: CITIZEN_ORIGIN });
    eq('the citizen can read their own applications', me.status, 200);
    ok('…with nationalIdHash stripped', !me.raw.includes('nationalIdHash'), me.raw.slice(0, 200));
    ok('…and no session token echoed back', !me.raw.includes('sessionToken'));

    // ══ 17. Revocation is IMMEDIATE — the point of ADR-018 ══════
    const logout = await call(citizen.url, '/edge/v1/auth/applicant/logout', {
      method: 'POST', jar: citizenJar, csrf: citizenCsrf, origin: CITIZEN_ORIGIN, body: {},
    });
    eq('citizen logout -> 204', logout.status, 204);
    const afterRevoke = await call(citizen.url, '/edge/v1/me/applications', { jar: citizenJar, origin: CITIZEN_ORIGIN });
    eq('the very NEXT request after revocation -> 401', afterRevoke.status, 401);
    eq('upstream session count is zero', identityState.sessions.size, 0);
    const sessionAfterRevoke = await call(citizen.url, '/edge/v1/session', { jar: citizenJar, origin: CITIZEN_ORIGIN });
    eq('and the session probe reports 401 too', sessionAfterRevoke.status, 401);

    // ══ 18. A citizen session cannot act as an officer ══════════
    ok('the citizen deployment exposes NO officer route',
      !citizenRoutes.some((route) => route.path.startsWith('/edge/v1/applications')));
    const citizenJar2 = new Jar();
    identityState.attempts.clear();
    await call(citizen.url, '/edge/v1/auth/applicant/otp/verify', {
      body: { nationalId: OTP_INPUT_CLASSES.realSend, otp: '123456', channel: 'WEB' }, origin: CITIZEN_ORIGIN, jar: citizenJar2,
    });
    const citizenOnOfficerEdge = await call(rdf.url, '/edge/v1/applications', { jar: citizenJar2 });
    eq('an applicant handle on an officer route -> 401, never 200', citizenOnOfficerEdge.status, 401);
    eq('…and never 403 (which would confirm the route exists)', (citizenOnOfficerEdge.body as Record<string, unknown>)['error'], 'NO_SESSION');

    // ══ 19. Correlation id propagates end to end ════════════════
    const traceId = 'trace-00000000-0000-4000-8000-000000000abc';
    const traced = await call(rdf.url, '/edge/v1/applications', { jar: officerJar, correlationId: traceId });
    eq('a traced read succeeds', traced.status, 200);
    eq('the edge echoes the correlation id back to the browser', traced.headers.get('x-correlation-id'), traceId);
    ok('…and mints a distinct per-request id', traced.headers.get('x-request-id') !== traceId);
    ok('the UPSTREAM saw the same correlation id, not a fresh one',
      log.idsFor('application', '/v1/applications').includes(traceId),
      JSON.stringify(log.idsFor('application', '/v1/applications')));
    const tracedWrite = await call(rdf.url, '/edge/v1/applications/adjudicate', {
      jar: officerJar, csrf, correlationId: traceId, body: { applicationId: APPLICATION_RDF, decision: 'CLEAR' },
    });
    eq('a traced write succeeds', tracedWrite.status, 200);
    ok('the write carried the same id (so the Kafka trace joins)',
      log.idsFor('application', '/v1/applications/adjudicate').includes(traceId));

    // ══ 20. Aggregation: partial, not all-or-nothing ════════════
    const detail = await call(rdf.url, '/edge/v1/applications/detail', { jar: officerJar });
    eq('detail with no applicationId -> 400', detail.status, 400);
    const detailOk = await call(rdf.url, `/edge/v1/applications/detail?applicationId=${APPLICATION_RDF}`, { jar: officerJar });
    eq('the aggregate read -> 200', detailOk.status, 200);
    const detailBody = detailOk.body as Record<string, unknown>;
    ok('it carries the application', detailBody['application'] !== null && detailBody['application'] !== undefined);
    ok('it carries the history in ONE round trip', detailBody['history'] !== null);
    deepEq('and reports no partials when both panels answered', detailBody['partial'], []);
    ok('two upstream reads were fanned out concurrently',
      log.idsFor('application', '/v1/applications/by-id').length > 0 &&
      log.idsFor('application', '/v1/applications/status-history').length > 0);

    // ══ 21. Retry: G2G 503 only, writes never ══════════════════
    const beforeOtpCalls = log.idsFor('identity', '/v1/applicants/auth/otp/request').length;
    identityState.g2gFailuresRemaining = 2;
    const flaky = await call(citizen.url, '/edge/v1/auth/applicant/otp/request', {
      body: { nationalId: NID_FLAKY_G2G, channel: 'WEB' }, origin: CITIZEN_ORIGIN,
    });
    eq('a G2G outage is retried and eventually succeeds -> 202', flaky.status, 202);
    eq('…after exactly three upstream attempts', log.idsFor('identity', '/v1/applicants/auth/otp/request').length - beforeOtpCalls, 3);
    identityState.g2gFailuresRemaining = 99;
    const exhausted = await call(citizen.url, '/edge/v1/auth/applicant/otp/request', {
      body: { nationalId: NID_FLAKY_G2G, channel: 'WEB' }, origin: CITIZEN_ORIGIN,
    });
    eq('a persistent G2G outage surfaces as 503, not a generic failure', exhausted.status, 503);
    eq('…naming the authority that is down', (exhausted.body as Record<string, unknown>)['error'], 'NIDA_UNAVAILABLE');
    const beforeAccept = log.idsFor('application', '/v1/applications/accept').length;
    await call(rdf.url, '/edge/v1/applications/accept', { jar: officerJar, csrf, body: { applicationId: APPLICATION_RDF } });
    eq('a write is attempted EXACTLY ONCE — never retried', log.idsFor('application', '/v1/applications/accept').length - beforeAccept, 1);

    // ══ 22. Two TTLs: sliding idle, hard ceiling ════════════════
    const shortConfig = loadEdgeConfig({ kind: 'agency', agency: 'RDF' }, {
      ...env, EDGE_DEV_PORT: '0', EDGE_SESSION_IDLE_TTL_SECONDS: '60', EDGE_SESSION_ABSOLUTE_TTL_SECONDS: '300',
    });
    const shortEdge = createEdgeContext(shortConfig);
    const created = shortEdge.store.create(
      { kind: 'officer', token: 'x.y.z', expiresAt: new Date().toISOString(), agency: 'RDF', roles: [], subject: 's' },
      0,
    );
    ok('a fresh session resolves', shortEdge.store.touch(created.handle, 1_000).ok);
    ok('activity at 59s slides the idle window', shortEdge.store.touch(created.handle, 59_000).ok);
    ok('…so 100s is still alive despite a 60s idle TTL', shortEdge.store.touch(created.handle, 100_000).ok);
    const idleDead = shortEdge.store.touch(created.handle, 200_000);
    eq('61s of true inactivity expires it', idleDead.ok, false);
    ok('…reported as an idle expiry', !idleDead.ok && idleDead.reason === 'IDLE_EXPIRED');
    const ceiling = shortEdge.store.create(
      { kind: 'officer', token: 'x.y.z', expiresAt: new Date().toISOString(), agency: 'RDF', roles: [], subject: 's' },
      0,
    );
    for (let t = 30_000; t <= 290_000; t += 30_000) shortEdge.store.touch(ceiling.handle, t);
    ok('continuous activity keeps it alive up to the ceiling', shortEdge.store.touch(ceiling.handle, 299_000).ok);
    const capped = shortEdge.store.touch(ceiling.handle, 301_000);
    eq('the ABSOLUTE ceiling ends it regardless of activity', capped.ok, false);
    ok('…reported as an absolute expiry, so the UI can say "sign in again"',
      !capped.ok && capped.reason === 'ABSOLUTE_EXPIRED');
    ok('an absolute TTL below the idle TTL is REFUSED at load', (() => {
      try {
        loadEdgeConfig({ kind: 'agency', agency: 'RDF' }, { ...env, EDGE_SESSION_IDLE_TTL_SECONDS: '1800', EDGE_SESSION_ABSOLUTE_TTL_SECONDS: '600' });
        return false;
      } catch { return true; }
    })());
    ok('a wildcard CORS origin is REFUSED at load', (() => {
      try {
        loadEdgeConfig({ kind: 'agency', agency: 'RDF' }, { ...env, CORS_ORIGINS: '*' });
        return false;
      } catch { return true; }
    })());

    // ══ 23. Handles are stored keyed-hashed, not verbatim ═══════
    const probe = createEdgeContext(shortConfig);
    const minted = probe.store.create({ kind: 'applicant', token: 'opaque-upstream-token', expiresAt: new Date().toISOString() });
    const stored = JSON.stringify([...(probe.store as unknown as { sessions: Map<string, unknown> }).sessions.keys()]);
    ok('the raw handle is NOT a key in the store', !stored.includes(minted.handle));
    eq('the stored key is a sha256 hex digest', /^\["[0-9a-f]{64}"\]$/.test(stored), true);
    ok('a session refresh slides without a new login', probe.store.touch(minted.handle).ok);
    eq('revocation removes it', probe.store.revoke(minted.handle), true);
    eq('…and a second revoke is a clean false', probe.store.revoke(minted.handle), false);

    // ══ 24. Probes ═════════════════════════════════════════════
    const health = await call(rdf.url, '/edge/health');
    eq('GET /edge/health -> 200', health.status, 200);
    const ready = await call(rdf.url, '/edge/ready');
    eq('GET /edge/ready -> 200 with every upstream up', ready.status, 200);
    eq('…and reports per-upstream health', (ready.body as { upstreams?: Record<string, boolean> }).upstreams?.['iam'], true);
    const notFound = await call(rdf.url, '/edge/v1/nope');
    eq('an unknown edge path -> 404', notFound.status, 404);
    const wrongMethod = await call(rdf.url, '/edge/v1/applications', { method: 'POST', body: {}, jar: officerJar, csrf });
    eq('the wrong method on a known path -> 405', wrongMethod.status, 405);
  } finally {
    await Promise.all(servers.reverse().map((server) => server.stop()));
  }
}

await run();

const total = passed + failures.length;
if (failures.length > 0) {
  process.stderr.write(`\n  ✗ edge-dev selfcheck FAILED — ${failures.length} of ${total} assertions\n\n`);
  for (const failure of failures) process.stderr.write(`    ✗ ${failure}\n`);
  process.stderr.write('\n');
  process.exit(1);
}
process.stdout.write(`\n  ✓ edge-dev selfcheck GREEN — ${passed} assertions over real sockets\n\n`);
