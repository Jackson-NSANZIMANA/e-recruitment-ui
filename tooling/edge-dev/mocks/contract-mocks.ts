// ══════════════════════════════════════════════════════════════════
// edge-dev — contract mocks for iam / identity / application services
//
// These stand in for the real services when the Tier-1/Tier-2 stack is not
// available (no Postgres, no Kafka, no NIDA mock). They are CONTRACT mocks, not
// convenience stubs: every status code, error code and body shape below is
// transcribed from the real controllers in the backend repo at 47d9ad3, and the
// selfcheck asserts against them, so a mock that drifts from the controller is
// a mock that makes the proof lie.
//
// Deliberately faithful in the awkward places, because those are where the
// frontend breaks:
//   • officer login collapses unknown handle, wrong password AND disabled
//     account into ONE 401 INVALID_CREDENTIALS.
//   • otp/request answers a byte-identical 202 to all four input classes.
//   • otp/verify answers ONE 401 for wrong / expired / replayed / LOCKED.
//   • the lockout is real: after 5 failures the CORRECT code fails too.
//   • responses deliberately CARRY `nationalIdHash`, because a mock that never
//     emits it cannot prove the edge strips it.
//   • `x-correlation-id` is recorded per request so propagation is provable
//     rather than assumed.
// ══════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';
import { HttpError, startEdgeServer, type RequestContext, type Route, type RunningServer } from '../src/http.ts';

const NO_CORS = { origins: [] as readonly string[], credentials: false };

/** Correlation ids seen per (service, path), so propagation is assertable. */
export class CorrelationLog {
  private readonly seen: { service: string; path: string; correlationId: string }[] = [];

  record(service: string, path: string, correlationId: string): void {
    this.seen.push({ service, path, correlationId });
  }

  idsFor(service: string, path: string): readonly string[] {
    return this.seen.filter((e) => e.service === service && e.path === path).map((e) => e.correlationId);
  }

  all(): readonly { service: string; path: string; correlationId: string }[] {
    return [...this.seen];
  }
}

function bearer(ctx: RequestContext): string | null {
  const header = ctx.headers['authorization'];
  if (header === undefined || !header.startsWith('Bearer ') || header.length <= 7) return null;
  return header.slice(7);
}

/** A structurally-real unsigned JWT. The mock is not the trust anchor. */
function fakeOfficerJwt(agency: string, roles: readonly string[], subject: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: subject,
      kind: 'officer',
      agency,
      roles,
      iss: 'usrp',
      aud: 'usrp-services',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');
  return `${header}.${payload}.mock-signature-not-verified-here`;
}

const HEALTH: Route = { method: 'GET', path: '/health', handler: () => ({ status: 200, body: { status: 'ok' } }) };

// ── iam-service ─────────────────────────────────────────────────

export interface OfficerAccount {
  readonly loginHandle: string;
  readonly password: string;
  readonly agency: string;
  readonly roles: readonly string[];
  /** A disabled account must be indistinguishable from a wrong password. */
  readonly disabled?: boolean;
}

export const DEV_OFFICERS: readonly OfficerAccount[] = [
  { loginHandle: 'rdf.officer', password: 'Officer#2026', agency: 'RDF', roles: ['RECRUITMENT_OFFICER'] },
  { loginHandle: 'rnp.officer', password: 'Officer#2026', agency: 'RNP', roles: ['RECRUITMENT_OFFICER'] },
  { loginHandle: 'rdf.disabled', password: 'Officer#2026', agency: 'RDF', roles: ['RECRUITMENT_OFFICER'], disabled: true },
];

export function startIamMock(port: number, log: CorrelationLog): Promise<RunningServer> {
  const routes: Route[] = [
    HEALTH,
    {
      method: 'POST',
      path: '/v1/auth/officer/login',
      handler: async (ctx) => {
        log.record('iam', ctx.path, ctx.correlationId);
        const body = await ctx.json<{ loginHandle?: unknown; password?: unknown }>();
        if (typeof body.loginHandle !== 'string' || body.loginHandle.length === 0) {
          throw new HttpError(400, 'INVALID_REQUEST', 'Field "loginHandle" is required.');
        }
        if (typeof body.password !== 'string' || body.password.length === 0) {
          throw new HttpError(400, 'INVALID_REQUEST', 'Field "password" is required.');
        }
        const account = DEV_OFFICERS.find((candidate) => candidate.loginHandle === body.loginHandle);
        const ok = account !== undefined && account.disabled !== true && account.password === body.password;
        if (!ok || account === undefined) {
          // ONE body for all three failure modes. No enumeration.
          throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid handle or password.');
        }
        return {
          status: 200,
          body: {
            token: fakeOfficerJwt(account.agency, account.roles, randomUUID()),
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          },
        };
      },
    },
    {
      method: 'POST',
      path: '/v1/auth/service/token',
      handler: async (ctx) => {
        log.record('iam', ctx.path, ctx.correlationId);
        const body = await ctx.json<{ clientId?: unknown; clientSecret?: unknown }>();
        if (body.clientId !== 'dev.identity-portal' || body.clientSecret !== 'DevService#2026') {
          throw new HttpError(401, 'INVALID_CLIENT', 'Invalid client credentials.');
        }
        return {
          status: 200,
          body: { token: 'mock-system-token', expiresAt: new Date(Date.now() + 900_000).toISOString() },
        };
      },
    },
  ];
  return startEdgeServer({ serviceName: 'mock-iam-service', port, routes, cors: NO_CORS });
}

// ── identity-service ────────────────────────────────────────────

/** The four input classes otp/request must answer identically (ADR-018). */
export const OTP_INPUT_CLASSES = {
  /** Real, verified, NIDA record carries a phone. An SMS is actually sent. */
  realSend: '1199180000000001',
  /** No such NID in NIDA. */
  unknownNid: '1199180000000002',
  /** Exists in NIDA but the identity is not verified in our store. */
  unverified: '1199180000000003',
  /** Exists and verified, but the NIDA record has NO phone — walk-in lane. */
  phoneless: '1199180000000004',
} as const;

/** Triggers two 503 NIDA_UNAVAILABLE responses, then succeeds. Proves retry. */
export const NID_FLAKY_G2G = '1199180000000009';

const CORRECT_OTP = '123456';
const MAX_OTP_ATTEMPTS = 5;

export interface IdentityMockState {
  /** Failed verify attempts per NID. At 5 the correct code fails too. */
  readonly attempts: Map<string, number>;
  /** Live citizen sessions: token -> applicantId. Revocation deletes. */
  readonly sessions: Map<string, string>;
  /** Remaining forced G2G failures for NID_FLAKY_G2G. */
  g2gFailuresRemaining: number;
}

export function startIdentityMock(
  port: number,
  log: CorrelationLog,
  state: IdentityMockState,
): Promise<RunningServer> {
  const routes: Route[] = [
    HEALTH,
    {
      method: 'POST',
      path: '/v1/applicants/auth/otp/request',
      handler: async (ctx) => {
        log.record('identity', ctx.path, ctx.correlationId);
        const body = await ctx.json<{ nationalId?: unknown }>();
        if (typeof body.nationalId !== 'string' || body.nationalId.length === 0) {
          throw new HttpError(400, 'INVALID_REQUEST', 'Field "nationalId" is required.');
        }
        if (body.nationalId === NID_FLAKY_G2G && state.g2gFailuresRemaining > 0) {
          state.g2gFailuresRemaining -= 1;
          // A real, distinct, user-explainable outage — NOT an enumeration
          // signal, because it is independent of whether the NID exists.
          throw new HttpError(503, 'NIDA_UNAVAILABLE', 'Identity registry unavailable; try again shortly.');
        }
        // Byte-identical for every input class. This is the invariant.
        return { status: 202, body: { status: 'CHALLENGED' } };
      },
    },
    {
      method: 'POST',
      path: '/v1/applicants/auth/otp/verify',
      handler: async (ctx) => {
        log.record('identity', ctx.path, ctx.correlationId);
        const body = await ctx.json<{ nationalId?: unknown; otp?: unknown }>();
        if (typeof body.nationalId !== 'string' || typeof body.otp !== 'string') {
          throw new HttpError(400, 'INVALID_REQUEST', 'Fields "nationalId" and "otp" are required.');
        }
        const used = state.attempts.get(body.nationalId) ?? 0;
        const lockedOut = used >= MAX_OTP_ATTEMPTS;
        const correct = body.nationalId === OTP_INPUT_CLASSES.realSend && body.otp === CORRECT_OTP;

        if (lockedOut || !correct) {
          state.attempts.set(body.nationalId, used + 1);
          // ONE 401 for wrong / expired / replayed / locked. The client cannot
          // tell lockout from a wrong digit, on purpose.
          throw new HttpError(401, 'INVALID_OTP', 'Invalid or expired code.');
        }
        state.attempts.delete(body.nationalId);
        const sessionToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
        state.sessions.set(sessionToken, 'a0000000-0000-4000-8000-000000000001');
        return {
          status: 200,
          body: { sessionToken, expiresAt: new Date(Date.now() + 1_800_000).toISOString() },
        };
      },
    },
    {
      method: 'POST',
      path: '/v1/applicants/auth/logout',
      handler: (ctx) => {
        log.record('identity', ctx.path, ctx.correlationId);
        const token = bearer(ctx);
        if (token === null || !state.sessions.has(token)) {
          throw new HttpError(401, 'INVALID_SESSION', 'A valid session token is required.');
        }
        state.sessions.delete(token);
        return { status: 204 };
      },
    },
    {
      method: 'GET',
      path: '/v1/applicants/me/applications',
      handler: (ctx) => {
        log.record('identity', ctx.path, ctx.correlationId);
        const token = bearer(ctx);
        if (token === null || !state.sessions.has(token)) {
          throw new HttpError(401, 'INVALID_SESSION', 'A valid session token is required.');
        }
        return {
          status: 200,
          body: {
            applications: [
              {
                applicationId: 'b0000000-0000-4000-8000-000000000001',
                agency: 'RDF',
                status: 'MEDICAL_REVIEW',
                processingCode: 'RDF-2026-000001',
                submittedAt: '2026-08-01T09:00:00.000Z',
                // DELIBERATE LEAK. The real backend does not emit this here; the
                // mock does so the edge's stripping is proven, not assumed.
                nationalIdHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
              },
            ],
          },
        };
      },
    },
    {
      method: 'POST',
      path: '/v1/applicants/me/applications/withdraw',
      handler: async (ctx) => {
        log.record('identity', ctx.path, ctx.correlationId);
        const token = bearer(ctx);
        if (token === null || !state.sessions.has(token)) {
          throw new HttpError(401, 'INVALID_SESSION', 'A valid session token is required.');
        }
        const body = await ctx.json<{ applicationId?: unknown }>();
        if (typeof body.applicationId !== 'string') {
          throw new HttpError(400, 'INVALID_REQUEST', 'Field "applicationId" must be a UUID.');
        }
        return { status: 200, body: { status: 'WITHDRAWN', agency: 'RDF', fromStatus: 'MEDICAL_REVIEW' } };
      },
    },
    {
      method: 'POST',
      path: '/v1/identities/verify',
      handler: async (ctx) => {
        log.record('identity', ctx.path, ctx.correlationId);
        if (bearer(ctx) === null) throw new HttpError(401, 'UNAUTHENTICATED', 'A bearer token is required.');
        const body = await ctx.json<{ nationalId?: unknown }>();
        if (typeof body.nationalId !== 'string') {
          throw new HttpError(400, 'MISSING_NATIONAL_ID', 'Field "nationalId" is required.');
        }
        // Note what is NOT here: no name, no date of birth, no gender. The real
        // controller returns the opaque applicantId and a status, and nothing else.
        return { status: 201, body: { status: 'CREATED', applicantId: 'a0000000-0000-4000-8000-000000000001' } };
      },
    },
  ];
  return startEdgeServer({ serviceName: 'mock-identity-service', port, routes, cors: NO_CORS });
}

// ── application-service ─────────────────────────────────────────

/** Accepting this id answers 409 CROSS_AGENCY_LOCKED (ADR-014). */
export const APPLICATION_LOCKED_ELSEWHERE = 'c0000000-0000-4000-8000-00000000000f';
export const APPLICATION_RDF = 'b0000000-0000-4000-8000-000000000001';

function officerClaims(ctx: RequestContext): { agency: string; roles: readonly string[] } {
  const token = bearer(ctx);
  if (token === null) throw new HttpError(401, 'UNAUTHENTICATED', 'A bearer token is required.');
  const payload = token.split('.')[1];
  if (payload === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Malformed token.');
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (decoded['kind'] !== 'officer') throw new HttpError(403, 'FORBIDDEN', undefined);
    return {
      agency: typeof decoded['agency'] === 'string' ? decoded['agency'] : 'UNKNOWN',
      roles: Array.isArray(decoded['roles']) ? (decoded['roles'] as string[]) : [],
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, 'UNAUTHENTICATED', 'Malformed token.');
  }
}

export function startApplicationMock(port: number, log: CorrelationLog): Promise<RunningServer> {
  const vetted = new Set<string>();

  const transition = (path: string, respond: (body: Record<string, unknown>, agency: string) => unknown): Route => ({
    method: 'POST',
    path,
    handler: async (ctx) => {
      log.record('application', ctx.path, ctx.correlationId);
      const { agency } = officerClaims(ctx);
      const body = await ctx.json<Record<string, unknown>>();
      if (typeof body['applicationId'] !== 'string') {
        throw new HttpError(400, 'MISSING_APPLICATION_ID', 'Field "applicationId" is required.');
      }
      return respond(body, agency) as { status: number; body?: unknown };
    },
  });

  const routes: Route[] = [
    HEALTH,
    {
      method: 'GET',
      path: '/v1/applications',
      handler: (ctx) => {
        log.record('application', ctx.path, ctx.correlationId);
        const { agency } = officerClaims(ctx);
        return {
          status: 200,
          body: {
            agency,
            applications: [
              {
                id: APPLICATION_RDF,
                agency,
                status: agency === 'RDF' ? 'MEDICAL_REVIEW' : 'PHYSICAL_TEST_COMPLETE',
                processingCode: `${agency}-2026-000001`,
                category: 'GENERAL_ENTRY',
                // DELIBERATE LEAK — see the identity mock. Proves the strip.
                nationalIdHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
              },
            ],
          },
        };
      },
    },
    {
      method: 'GET',
      path: '/v1/applications/amber-queue',
      handler: (ctx) => {
        log.record('application', ctx.path, ctx.correlationId);
        const { agency } = officerClaims(ctx);
        return { status: 200, body: { agency, queue: [] } };
      },
    },
    {
      method: 'GET',
      path: '/v1/applications/by-id',
      handler: (ctx) => {
        log.record('application', ctx.path, ctx.correlationId);
        const { agency } = officerClaims(ctx);
        const applicationId = ctx.query.get('applicationId');
        if (applicationId !== APPLICATION_RDF) {
          // BARE 404. A sibling agency's real id and a nonexistent one are
          // byte-identical here, or the route becomes an existence oracle.
          return { status: 404, body: { error: 'NOT_FOUND' } };
        }
        return {
          status: 200,
          body: {
            agency,
            application: { id: applicationId, agency, status: 'MEDICAL_REVIEW', processingCode: `${agency}-2026-000001` },
          },
        };
      },
    },
    {
      method: 'GET',
      path: '/v1/applications/status-history',
      handler: (ctx) => {
        log.record('application', ctx.path, ctx.correlationId);
        const { agency } = officerClaims(ctx);
        const applicationId = ctx.query.get('applicationId');
        if (applicationId !== APPLICATION_RDF) return { status: 404, body: { error: 'NOT_FOUND' } };
        return {
          status: 200,
          body: {
            agency,
            applicationId,
            history: [
              { fromStatus: null, toStatus: 'SUBMITTED', actorKind: 'SYSTEM', actor: null, at: '2026-08-01T09:00:00.000Z', reason: null },
              { fromStatus: 'SUBMITTED', toStatus: 'MEDICAL_REVIEW', actorKind: 'OFFICER', actor: 'officer-1', at: '2026-08-02T09:00:00.000Z', reason: 'Cleared' },
            ],
          },
        };
      },
    },
    transition('/v1/applications/medical-review', (body, agency) => {
      const boardMode = agency === 'RDF';
      const sentBoard = typeof body['fitnessStatus'] === 'string';
      const sentCert = typeof body['certVerdict'] === 'string';
      if (!sentBoard && !sentCert) {
        throw new HttpError(400, 'MISSING_MEDICAL_VERDICT', 'Send "fitnessStatus" (RDF board) or "certVerdict" (RNP/RCS).');
      }
      if (boardMode !== sentBoard) {
        // ADR-013: the body must match the caller's AGENCY MODE.
        return { status: 422, body: { status: 'INVALID_MEDICAL_INPUT', reason: boardMode ? 'AGENCY_USES_BOARD' : 'AGENCY_USES_CERTIFICATE' } };
      }
      return { status: 200, body: { status: 'APPLIED', fromStatus: 'MEDICAL_REVIEW', toStatus: 'MEDICAL_CLEARED' } };
    }),
    transition('/v1/applications/final-decision', (body) => {
      if (body['decision'] !== 'SHORTLIST' && body['decision'] !== 'REJECT') {
        throw new HttpError(400, 'INVALID_DECISION', 'Field "decision" must be "SHORTLIST" or "REJECT".');
      }
      return { status: 200, body: { status: 'APPLIED', fromStatus: 'MEDICAL_CLEARED', toStatus: 'SHORTLISTED_FINAL' } };
    }),
    transition('/v1/applications/accept', (body) => {
      if (body['applicationId'] === APPLICATION_LOCKED_ELSEWHERE) {
        // ADR-014. One citizen, one acceptance, across all three agencies.
        return { status: 409, body: { status: 'CROSS_AGENCY_LOCKED', lockedByAgency: 'RNP' } };
      }
      return { status: 200, body: { status: 'APPLIED', fromStatus: 'SHORTLISTED_FINAL', toStatus: 'ACCEPTED' } };
    }),
    transition('/v1/applications/adjudicate', (body) => {
      if (body['decision'] !== 'CLEAR' && body['decision'] !== 'REJECT') {
        throw new HttpError(400, 'INVALID_DECISION', 'Field "decision" must be "CLEAR" or "REJECT".');
      }
      return { status: 200, body: { status: 'APPLIED', fromStatus: 'ADJUDICATION_REVIEW', toStatus: 'MEDICAL_REVIEW' } };
    }),
    {
      method: 'POST',
      path: '/v1/applications/walk-in/register',
      handler: async (ctx) => {
        log.record('application', ctx.path, ctx.correlationId);
        const { agency } = officerClaims(ctx);
        const body = await ctx.json<Record<string, unknown>>();
        if (typeof body['applicantId'] !== 'string') {
          throw new HttpError(400, 'MISSING_APPLICANTID', 'Field "applicantId" is required.');
        }
        if (agency !== 'RDF') {
          // RDF-only lane. An honest 501, not a raw DB enum error.
          return { status: 501, body: { status: 'UNSUPPORTED_AGENCY', agency } };
        }
        return {
          status: 201,
          body: {
            status: 'REGISTERED',
            applicationId: APPLICATION_RDF,
            processingCode: 'RDF-2026-000001',
            qrInvitationCode: 'QR-DEV-0001',
          },
        };
      },
    },
    {
      method: 'POST',
      path: '/v1/applications/walk-in/vet',
      handler: async (ctx) => {
        log.record('application', ctx.path, ctx.correlationId);
        const { agency } = officerClaims(ctx);
        const body = await ctx.json<Record<string, unknown>>();
        const applicationId = body['applicationId'];
        if (typeof applicationId !== 'string') {
          throw new HttpError(400, 'MISSING_APPLICATIONID', 'Field "applicationId" is required.');
        }
        if (agency !== 'RDF') return { status: 501, body: { status: 'UNSUPPORTED_AGENCY', agency } };
        if (!vetted.has(applicationId)) {
          vetted.add(applicationId);
          // The autonomous age verdict has not landed yet. Retryable 409 — the
          // candidate is standing at the desk.
          return { status: 409, body: { status: 'AGE_PENDING', currentStatus: 'WALK_IN_REGISTERED' } };
        }
        return {
          status: 200,
          body: { status: 'APPLIED', fromStatus: 'WALK_IN_REGISTERED', toStatus: 'WALK_IN_ON_SITE_VETTING', ageStatus: 'PASS' },
        };
      },
    },
  ];
  return startEdgeServer({ serviceName: 'mock-application-service', port, routes, cors: NO_CORS });
}

export function freshIdentityState(): IdentityMockState {
  return { attempts: new Map(), sessions: new Map(), g2gFailuresRemaining: 2 };
}
