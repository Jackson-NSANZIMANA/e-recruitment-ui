// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — the path registry, VALIDATED against @usrp/contracts
//
// INVARIANT 1, mechanised. `shared-http` matches paths EXACTLY and has no param
// syntax (ADR-005), so `/v1/applications/${id}` is not "unidiomatic" — it is a
// route that cannot be matched by the server and will 404 in production while
// type-checking perfectly in development. That combination is why this is a
// build-time guard and not a code-review convention.
//
// Three layers of defence, deliberately overlapping:
//
//   1. THIS FILE — every path is a frozen constant. There is no function that
//      builds one, so there is nothing to interpolate into.
//   2. MODULE LOAD — `assertPathsMatchContract()` checks each edge path against
//      the upstream operation it fronts in the contract's ROUTE_TABLE, and
//      refuses to load if an operation has vanished or become service-internal.
//   3. BUILD — `scripts/check-exact-paths.ts` greps the whole package for a
//      template literal containing an interpolation inside a URL-shaped string
//      and exits non-zero. That is the one that catches the code somebody writes
//      next year without reading this comment.
// ══════════════════════════════════════════════════════════════════

import { BROWSER_ROUTES, ROUTE_TABLE, SERVICE_INTERNAL_ROUTES, type RouteFact } from '@usrp/contracts';

/**
 * One browser-callable operation.
 *
 * `edgePath` is what THIS client calls; `upstreamOperationId` is the contract
 * operation the edge fronts. Keeping both means a contract change that renames or
 * removes an upstream route breaks this file loudly instead of producing a 404
 * at the edge months later.
 */
export interface EdgeOperation {
  readonly id: string;
  readonly method: 'GET' | 'POST';
  /** EXACT path on the edge. Never templated, never interpolated. */
  readonly edgePath: string;
  /** `operationId` in @usrp/contracts ROUTE_TABLE. */
  readonly upstreamOperationId: string;
  /** Which session kind may invoke it. */
  readonly session: 'officer' | 'applicant' | 'anonymous';
  /**
   * Whether a 503 G2G fault may be retried. FALSE for every write that changes
   * an application's state — a retried transition is a double write.
   */
  readonly retryOnG2G: boolean;
}

export const EDGE_OPERATIONS: readonly EdgeOperation[] = [
  // ── Auth ──
  { id: 'officerLogin', method: 'POST', edgePath: '/edge/v1/auth/officer/login', upstreamOperationId: 'officerLogin', session: 'anonymous', retryOnG2G: false },
  { id: 'officerLogout', method: 'POST', edgePath: '/edge/v1/auth/officer/logout', upstreamOperationId: 'officerLogin', session: 'officer', retryOnG2G: false },
  { id: 'requestOtp', method: 'POST', edgePath: '/edge/v1/auth/applicant/otp/request', upstreamOperationId: 'requestApplicantOtp', session: 'anonymous', retryOnG2G: true },
  { id: 'verifyOtp', method: 'POST', edgePath: '/edge/v1/auth/applicant/otp/verify', upstreamOperationId: 'verifyApplicantOtp', session: 'anonymous', retryOnG2G: false },
  { id: 'applicantLogout', method: 'POST', edgePath: '/edge/v1/auth/applicant/logout', upstreamOperationId: 'logoutApplicant', session: 'applicant', retryOnG2G: false },

  // ── Officer reads ──
  { id: 'listApplications', method: 'GET', edgePath: '/edge/v1/applications', upstreamOperationId: 'listApplications', session: 'officer', retryOnG2G: true },
  { id: 'listAmberQueue', method: 'GET', edgePath: '/edge/v1/applications/amber-queue', upstreamOperationId: 'listAmberQueue', session: 'officer', retryOnG2G: true },
  { id: 'findApplicationById', method: 'GET', edgePath: '/edge/v1/applications/by-id', upstreamOperationId: 'findApplicationById', session: 'officer', retryOnG2G: true },
  { id: 'getStatusHistory', method: 'GET', edgePath: '/edge/v1/applications/status-history', upstreamOperationId: 'getApplicationStatusHistory', session: 'officer', retryOnG2G: true },
  { id: 'getApplicationDetail', method: 'GET', edgePath: '/edge/v1/applications/detail', upstreamOperationId: 'findApplicationById', session: 'officer', retryOnG2G: true },

  // ── Officer writes: FOUR transitions ──
  { id: 'recordMedicalReview', method: 'POST', edgePath: '/edge/v1/applications/medical-review', upstreamOperationId: 'recordMedicalReview', session: 'officer', retryOnG2G: false },
  { id: 'recordFinalDecision', method: 'POST', edgePath: '/edge/v1/applications/final-decision', upstreamOperationId: 'recordFinalDecision', session: 'officer', retryOnG2G: false },
  { id: 'acceptApplication', method: 'POST', edgePath: '/edge/v1/applications/accept', upstreamOperationId: 'acceptApplication', session: 'officer', retryOnG2G: false },
  { id: 'adjudicateApplication', method: 'POST', edgePath: '/edge/v1/applications/adjudicate', upstreamOperationId: 'adjudicateApplication', session: 'officer', retryOnG2G: false },
  { id: 'registerWalkIn', method: 'POST', edgePath: '/edge/v1/applications/walk-in/register', upstreamOperationId: 'registerWalkIn', session: 'officer', retryOnG2G: false },
  { id: 'vetWalkIn', method: 'POST', edgePath: '/edge/v1/applications/walk-in/vet', upstreamOperationId: 'vetWalkIn', session: 'officer', retryOnG2G: false },
  { id: 'verifyIdentity', method: 'POST', edgePath: '/edge/v1/identities/verify', upstreamOperationId: 'verifyIdentity', session: 'officer', retryOnG2G: true },

  // ── Citizen self-service ──
  { id: 'listMyApplications', method: 'GET', edgePath: '/edge/v1/me/applications', upstreamOperationId: 'listMyApplications', session: 'applicant', retryOnG2G: true },
  { id: 'withdrawMyApplication', method: 'POST', edgePath: '/edge/v1/me/applications/withdraw', upstreamOperationId: 'withdrawMyApplication', session: 'applicant', retryOnG2G: false },
  { id: 'getMyErasureRequest', method: 'GET', edgePath: '/edge/v1/me/erasure-request', upstreamOperationId: 'getMyErasureRequest', session: 'applicant', retryOnG2G: true },
  { id: 'fileMyErasureRequest', method: 'POST', edgePath: '/edge/v1/me/erasure-request', upstreamOperationId: 'fileMyErasureRequest', session: 'applicant', retryOnG2G: false },

  // ── Session ──
  { id: 'readSession', method: 'GET', edgePath: '/edge/v1/session', upstreamOperationId: 'officerLogin', session: 'anonymous', retryOnG2G: false },
  { id: 'refreshSession', method: 'POST', edgePath: '/edge/v1/session/refresh', upstreamOperationId: 'officerLogin', session: 'anonymous', retryOnG2G: false },
] as const;

const BY_ID = new Map(EDGE_OPERATIONS.map((operation) => [operation.id, operation]));

/** Look up an operation. Throws rather than returning undefined: a missing id is a bug, not a runtime condition. */
export function operation(id: string): EdgeOperation {
  const found = BY_ID.get(id);
  if (found === undefined) throw new Error(`Unknown edge operation "${id}". Add it to EDGE_OPERATIONS in paths.ts.`);
  return found;
}

/** Every distinct edge path, for the build guard and the selfcheck. */
export const EDGE_PATHS: readonly string[] = [...new Set(EDGE_OPERATIONS.map((operation) => operation.edgePath))];

export class ContractMismatchError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`@usrp/api-client disagrees with @usrp/contracts:\n  ${problems.join('\n  ')}`);
    this.name = 'ContractMismatchError';
    this.problems = problems;
  }
}

/**
 * Assert this registry against the contract's route table.
 *
 * Checks four things, each of which has a specific failure it prevents:
 *   • every referenced upstream operation still EXISTS (a rename is caught here,
 *     not by a 404 in production);
 *   • no edge path is templated;
 *   • no operation fronts a route the contract marks `service-internal` unless
 *     it is explicitly declared as brokered — proxying a system route to a
 *     browser is a security incident, not a convenience;
 *   • the contract's own browser/internal partition is non-empty, so an empty
 *     ROUTE_TABLE (a broken generate) fails loudly instead of passing vacuously.
 */
export function assertPathsMatchContract(): void {
  const problems: string[] = [];
  const byOperationId = new Map<string, RouteFact>(ROUTE_TABLE.map((route) => [route.operationId, route]));

  if (ROUTE_TABLE.length === 0) problems.push('ROUTE_TABLE is empty — @usrp/contracts generate has not run.');
  if (BROWSER_ROUTES.length === 0) problems.push('BROWSER_ROUTES is empty — the reach partition is broken.');
  if (SERVICE_INTERNAL_ROUTES.length === 0) problems.push('SERVICE_INTERNAL_ROUTES is empty — the reach partition is broken.');

  /**
   * `verifyIdentity` is `service-internal` in the contract AND legitimately
   * officer-callable (ADR-012 D1 widened `withAuth` to accept officer
   * principals). It is named here, once, with its ADR, so the exception is an
   * auditable line of code rather than a silently permissive rule.
   */
  const BROKERED = new Set(['verifyIdentity']);

  for (const edgeOperation of EDGE_OPERATIONS) {
    if (edgeOperation.edgePath.includes('${') || edgeOperation.edgePath.includes(':')) {
      problems.push(`${edgeOperation.id}: edge path "${edgeOperation.edgePath}" is templated. Exact paths only (ADR-005).`);
    }
    const upstream = byOperationId.get(edgeOperation.upstreamOperationId);
    if (upstream === undefined) {
      problems.push(`${edgeOperation.id}: no contract operation "${edgeOperation.upstreamOperationId}".`);
      continue;
    }
    if (upstream.reach === 'service-internal' && !BROKERED.has(edgeOperation.upstreamOperationId)) {
      problems.push(
        `${edgeOperation.id}: "${edgeOperation.upstreamOperationId}" is service-internal in the contract and is not a declared brokered route.`,
      );
    }
    if (upstream.path.includes('${') || upstream.path.includes(':')) {
      problems.push(`${edgeOperation.id}: upstream path "${upstream.path}" is templated.`);
    }
  }

  if (problems.length > 0) throw new ContractMismatchError(problems);
}

// Run at module load. A client whose paths disagree with the contract must not
// be importable — failing at boot beats failing at a citizen's request.
assertPathsMatchContract();
