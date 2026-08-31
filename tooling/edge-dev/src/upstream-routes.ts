// ══════════════════════════════════════════════════════════════════
// edge-dev — every upstream route this edge is allowed to call, as DATA
//
// Kept as data, tagged with the `operationId` from `@usrp/contracts`
// `ROUTE_TABLE`, so `scripts/check-against-contracts.ts` can assert this table
// against the contract instead of a reviewer remembering. That script is the
// gate; this file is the claim.
//
// It exists because `tooling/` is outside the pnpm workspace and edge-dev is
// deliberately zero-dependency and runnable with a bare `node`. Importing
// `@usrp/contracts` at runtime would cost both. So: declare, then prove the
// declaration equals the contract, in a separate checked step. Exactly the
// manifest-plus-drift-gate shape the backend already uses.
//
// `reach` is the load-bearing column. `browser` means the contract marks the
// route browser-reachable and the edge forwards the user's own credential.
// `brokered-system` means the route is `service-internal` and the edge calls it
// with its OWN client-credentials system token on the user's behalf, after
// authenticating them. THAT DISTINCTION IS THE SECURITY BOUNDARY: proxying a
// system route to a browser without brokering it is how a citizen gets an
// officer's view.
// ══════════════════════════════════════════════════════════════════

export type UpstreamService = 'iam' | 'identity' | 'application';

export type UpstreamReach =
  /** Contract-marked browser route; the user's own credential is forwarded. */
  | 'browser'
  /** Contract-marked service-internal; the edge brokers it with a system token. */
  | 'brokered-system'
  /** Unauthenticated upstream (login, OTP) — the routes that MINT credentials. */
  | 'public';

export interface UpstreamRouteFact {
  /** Matches `operationId` in @usrp/contracts ROUTE_TABLE. */
  readonly operationId: string;
  readonly service: UpstreamService;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly reach: UpstreamReach;
  /** Which browser session kind may cause this call. */
  readonly caller: 'officer' | 'applicant' | 'anonymous';
  readonly note: string;
}

export const UPSTREAM_ROUTES: readonly UpstreamRouteFact[] = [
  // ── Credential minting (unauthenticated upstream, by necessity) ──
  { operationId: 'officerLogin', service: 'iam', method: 'POST', path: '/v1/auth/officer/login', reach: 'public', caller: 'anonymous', note: 'loginHandle + password. NOT email.' },
  { operationId: 'issueServiceToken', service: 'iam', method: 'POST', path: '/v1/auth/service/token', reach: 'public', caller: 'anonymous', note: "The EDGE's own machine identity. Never proxied; only used internally." },
  { operationId: 'requestApplicantOtp', service: 'identity', method: 'POST', path: '/v1/applicants/auth/otp/request', reach: 'public', caller: 'anonymous', note: 'One byte-identical 202 across four input classes.' },
  { operationId: 'verifyApplicantOtp', service: 'identity', method: 'POST', path: '/v1/applicants/auth/otp/verify', reach: 'public', caller: 'anonymous', note: 'Returns the opaque session token the edge KEEPS.' },
  { operationId: 'logoutApplicant', service: 'identity', method: 'POST', path: '/v1/applicants/auth/logout', reach: 'browser', caller: 'applicant', note: 'Revokes upstream immediately — the property ADR-018 bought.' },

  // ── Officer reads ──
  { operationId: 'listApplications', service: 'application', method: 'GET', path: '/v1/applications', reach: 'browser', caller: 'officer', note: 'RLS-scoped to the officer agency by the DB, not by us.' },
  { operationId: 'listAmberQueue', service: 'application', method: 'GET', path: '/v1/applications/amber-queue', reach: 'browser', caller: 'officer', note: 'ADR-011 review queue.' },
  { operationId: 'findApplicationById', service: 'application', method: 'GET', path: '/v1/applications/by-id', reach: 'browser', caller: 'officer', note: 'Query param, not a path param. Bare 404 by design.' },
  { operationId: 'getApplicationStatusHistory', service: 'application', method: 'GET', path: '/v1/applications/status-history', reach: 'browser', caller: 'officer', note: 'The Procedural Justice surface — OFFICER-only, which is the problem.' },

  // ── Officer writes: FOUR transitions, not three ──
  { operationId: 'recordMedicalReview', service: 'application', method: 'POST', path: '/v1/applications/medical-review', reach: 'browser', caller: 'officer', note: 'ADR-013 two modes: fitnessStatus (RDF) or certVerdict (RNP/RCS).' },
  { operationId: 'recordFinalDecision', service: 'application', method: 'POST', path: '/v1/applications/final-decision', reach: 'browser', caller: 'officer', note: 'SHORTLIST | REJECT.' },
  { operationId: 'acceptApplication', service: 'application', method: 'POST', path: '/v1/applications/accept', reach: 'browser', caller: 'officer', note: 'ADR-014 cross-agency accept lock. Emits 409 CROSS_AGENCY_LOCKED.' },
  { operationId: 'adjudicateApplication', service: 'application', method: 'POST', path: '/v1/applications/adjudicate', reach: 'browser', caller: 'officer', note: 'CLEAR | REJECT.' },
  { operationId: 'registerWalkIn', service: 'application', method: 'POST', path: '/v1/applications/walk-in/register', reach: 'browser', caller: 'officer', note: 'RDF-only; 501 UNSUPPORTED_AGENCY for RNP/RCS.' },
  { operationId: 'vetWalkIn', service: 'application', method: 'POST', path: '/v1/applications/walk-in/vet', reach: 'browser', caller: 'officer', note: 'Step two. AGE_PENDING is a retryable 409.' },

  // ── Officer-callable identity (system+officer upstream) ──
  { operationId: 'verifyIdentity', service: 'identity', method: 'POST', path: '/v1/identities/verify', reach: 'brokered-system', caller: 'officer', note: 'ADR-012 D1: the route accepts officer principals too, so the officer credential is forwarded. Contract marks it service-internal, hence brokered.' },

  // ── Citizen self-service ──
  { operationId: 'listMyApplications', service: 'identity', method: 'GET', path: '/v1/applicants/me/applications', reach: 'browser', caller: 'applicant', note: 'identity-service already brokers the system read behind this.' },
  { operationId: 'withdrawMyApplication', service: 'identity', method: 'POST', path: '/v1/applicants/me/applications/withdraw', reach: 'browser', caller: 'applicant', note: 'ADR-020. Ownership enforced upstream inside the write transaction.' },
  { operationId: 'getMyErasureRequest', service: 'identity', method: 'GET', path: '/v1/applicants/me/erasure-request', reach: 'browser', caller: 'applicant', note: 'ADR-015.' },
  { operationId: 'fileMyErasureRequest', service: 'identity', method: 'POST', path: '/v1/applicants/me/erasure-request', reach: 'browser', caller: 'applicant', note: 'Same path, different method — the edge must not collapse them.' },

  // ── Officer-side erasure administration ──
  { operationId: 'listErasureRequests', service: 'identity', method: 'GET', path: '/v1/identities/erasure-requests', reach: 'browser', caller: 'officer', note: 'ADR-015 queue.' },
  { operationId: 'declineErasureRequest', service: 'identity', method: 'POST', path: '/v1/identities/erasure-requests/decline', reach: 'browser', caller: 'officer', note: 'ADR-015.' },
  { operationId: 'eraseIdentity', service: 'identity', method: 'POST', path: '/v1/identities/erasure', reach: 'browser', caller: 'officer', note: 'Terminates the citizen session as a side effect — proven in ADR-018.' },
] as const;

/**
 * Routes the edge must NEVER expose, brokered or otherwise.
 *
 * Not an oversight list — a refusal list. Each of these is `kind:'system'`
 * upstream AND has no legitimate browser-initiated cause. `submitApplication`
 * is the sharp one: it looks like the obvious thing a portal would call, and
 * exposing it would let a browser create applications for an arbitrary
 * `applicantId`, bypassing the OTP identity binding entirely.
 */
export const REFUSED_UPSTREAM_ROUTES: readonly { readonly operationId: string; readonly why: string }[] = [
  { operationId: 'submitApplication', why: 'System-token write. Browser-reachable it would let anyone submit for any applicantId, bypassing the ADR-018 identity binding.' },
  { operationId: 'listApplicationsByApplicant', why: 'System read across all three ops schemas. identity-service brokers it behind me/applications; a second door would skip the session check.' },
  { operationId: 'withdrawOwnApplication', why: 'System write. The citizen-facing door is me/applications/withdraw, which derives applicantId from the session instead of trusting a body field.' },
  { operationId: 'checkAgeEligibility', why: 'Autonomous pipeline gate. A caller who can invoke it can probe eligibility for arbitrary applicants.' },
  { operationId: 'checkEducationEligibility', why: 'Same.' },
  { operationId: 'checkDegreeEligibility', why: 'Same.' },
  { operationId: 'analyzeDocument', why: 'Returns forensic scores — a forgery-tuning oracle if a citizen can read it.' },
  { operationId: 'uploadDocument', why: 'System-token write; the citizen upload path must go through a route that binds the upload to the session.' },
] as const;

/** Look up a declared route, or throw. Never build an upstream path inline. */
export function upstreamRoute(operationId: string): UpstreamRouteFact {
  const found = UPSTREAM_ROUTES.find((route) => route.operationId === operationId);
  if (found === undefined) {
    throw new Error(
      `No declared upstream route for operationId "${operationId}". Add it to UPSTREAM_ROUTES and re-run ` +
        'scripts/check-against-contracts.ts, which will refuse it if the contract disagrees.',
    );
  }
  return found;
}
