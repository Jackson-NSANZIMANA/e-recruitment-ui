import { BROWSER_ROUTES, ROUTE_TABLE, SERVICE_INTERNAL_ROUTES, type RouteFact } from '@usrp/contracts';

/** A browser-facing edge operation. Exact paths only, never interpolated. */
export interface EdgeOperation {
  readonly id: string;
  readonly method: 'GET' | 'POST';
  readonly edgePath: string;
  /** Upstream @usrp/contracts operation, or null when the edge owns the behavior. */
  readonly upstreamOperationId: string | null;
  readonly session: 'officer' | 'applicant' | 'anonymous';
  readonly retryOnG2G: boolean;
}

// ══════════════════════════════════════════════════════════════════════════
// WHY `as const satisfies` AND NOT `: readonly EdgeOperation[]`
//
// The annotation this used to carry erased the id literals to `string`. That
// made `operation('getSlotInvitationKey')` a WELL-TYPED call to an operation
// that does not exist — it threw at runtime, inside a click handler, in front of
// a citizen. Four packages were shipping ids like that (see ADR-FE-006).
//
// `satisfies` keeps the shape check AND the literals, so `EdgeOperationId`
// below is derivable and a fictional id is a COMPILE error. This is the
// frontend counterpart of the backend's exhaustive Kafka topic map, where an
// unrouted event type fails the build rather than going unconsumed (000.md §9).
// ══════════════════════════════════════════════════════════════════════════
export const EDGE_OPERATIONS = [
  { id: 'officerLogin', method: 'POST', edgePath: '/edge/v1/auth/officer/login', upstreamOperationId: 'officerLogin', session: 'anonymous', retryOnG2G: false },
  { id: 'officerLogout', method: 'POST', edgePath: '/edge/v1/auth/officer/logout', upstreamOperationId: null, session: 'officer', retryOnG2G: false },
  { id: 'requestOtp', method: 'POST', edgePath: '/edge/v1/auth/applicant/otp/request', upstreamOperationId: 'requestApplicantOtp', session: 'anonymous', retryOnG2G: true },
  { id: 'verifyOtp', method: 'POST', edgePath: '/edge/v1/auth/applicant/otp/verify', upstreamOperationId: 'verifyApplicantOtp', session: 'anonymous', retryOnG2G: false },
  { id: 'applicantLogout', method: 'POST', edgePath: '/edge/v1/auth/applicant/logout', upstreamOperationId: 'logoutApplicant', session: 'applicant', retryOnG2G: false },

  { id: 'listApplications', method: 'GET', edgePath: '/edge/v1/applications', upstreamOperationId: 'listApplications', session: 'officer', retryOnG2G: true },
  { id: 'listAmberQueue', method: 'GET', edgePath: '/edge/v1/applications/amber-queue', upstreamOperationId: 'listAmberQueue', session: 'officer', retryOnG2G: true },
  { id: 'findApplicationById', method: 'GET', edgePath: '/edge/v1/applications/by-id', upstreamOperationId: 'findApplicationById', session: 'officer', retryOnG2G: true },
  { id: 'getStatusHistory', method: 'GET', edgePath: '/edge/v1/applications/status-history', upstreamOperationId: 'getApplicationStatusHistory', session: 'officer', retryOnG2G: true },
  { id: 'getApplicationDetail', method: 'GET', edgePath: '/edge/v1/applications/detail', upstreamOperationId: 'findApplicationById', session: 'officer', retryOnG2G: true },

  { id: 'recordMedicalReview', method: 'POST', edgePath: '/edge/v1/applications/medical-review', upstreamOperationId: 'recordMedicalReview', session: 'officer', retryOnG2G: false },
  { id: 'recordFinalDecision', method: 'POST', edgePath: '/edge/v1/applications/final-decision', upstreamOperationId: 'recordFinalDecision', session: 'officer', retryOnG2G: false },
  { id: 'acceptApplication', method: 'POST', edgePath: '/edge/v1/applications/accept', upstreamOperationId: 'acceptApplication', session: 'officer', retryOnG2G: false },
  { id: 'adjudicateApplication', method: 'POST', edgePath: '/edge/v1/applications/adjudicate', upstreamOperationId: 'adjudicateApplication', session: 'officer', retryOnG2G: false },
  { id: 'registerWalkIn', method: 'POST', edgePath: '/edge/v1/applications/walk-in/register', upstreamOperationId: 'registerWalkIn', session: 'officer', retryOnG2G: false },
  { id: 'vetWalkIn', method: 'POST', edgePath: '/edge/v1/applications/walk-in/vet', upstreamOperationId: 'vetWalkIn', session: 'officer', retryOnG2G: false },
  { id: 'verifyIdentity', method: 'POST', edgePath: '/edge/v1/identities/verify', upstreamOperationId: 'verifyIdentity', session: 'officer', retryOnG2G: true },

  { id: 'listMyApplications', method: 'GET', edgePath: '/edge/v1/me/applications', upstreamOperationId: 'listMyApplications', session: 'applicant', retryOnG2G: true },
  { id: 'withdrawMyApplication', method: 'POST', edgePath: '/edge/v1/me/applications/withdraw', upstreamOperationId: 'withdrawMyApplication', session: 'applicant', retryOnG2G: false },
  { id: 'getMyErasureRequest', method: 'GET', edgePath: '/edge/v1/me/erasure-request', upstreamOperationId: 'getMyErasureRequest', session: 'applicant', retryOnG2G: true },
  { id: 'fileMyErasureRequest', method: 'POST', edgePath: '/edge/v1/me/erasure-request', upstreamOperationId: 'fileMyErasureRequest', session: 'applicant', retryOnG2G: false },

  { id: 'readSession', method: 'GET', edgePath: '/edge/v1/session', upstreamOperationId: null, session: 'anonymous', retryOnG2G: false },
  { id: 'refreshSession', method: 'POST', edgePath: '/edge/v1/session/refresh', upstreamOperationId: null, session: 'anonymous', retryOnG2G: false },
] as const satisfies readonly EdgeOperation[];

/**
 * Every operation id the edge actually serves.
 *
 * THE WHITELIST. Any package that calls the edge should type its operation
 * constants as this union, so an id the edge does not serve fails `pnpm
 * typecheck` instead of a citizen's click. Four of the six feature slices were
 * naming ids that do not exist — 11 of 27 calls — and nothing caught it.
 */
export type EdgeOperationId = (typeof EDGE_OPERATIONS)[number]['id'];

/** Operations the browser may reach without any session at all. */
export type AnonymousEdgeOperationId = Extract<
  (typeof EDGE_OPERATIONS)[number],
  { readonly session: 'anonymous' }
>['id'];

/**
 * Widened to `string` KEYS on purpose.
 *
 * `operation()` keeps its runtime guard for callers reached from JavaScript, or
 * from an id assembled at runtime. The type is the first gate, not the only one.
 */
const BY_ID: ReadonlyMap<string, EdgeOperation> = new Map(
  EDGE_OPERATIONS.map((edgeOperation): readonly [string, EdgeOperation] => [edgeOperation.id, edgeOperation]),
);

export function operation(id: string): EdgeOperation {
  const found = BY_ID.get(id);
  if (found === undefined) throw new Error(`Unknown edge operation "${id}". Add it to EDGE_OPERATIONS in paths.ts.`);
  return found;
}

/** True when `id` is an operation the edge serves. Use at a runtime boundary. */
export function isEdgeOperationId(id: string): id is EdgeOperationId {
  return BY_ID.has(id);
}

export const EDGE_PATHS: readonly string[] = [...new Set(EDGE_OPERATIONS.map((edgeOperation) => edgeOperation.edgePath))];

export class ContractMismatchError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`@usrp/api-client disagrees with @usrp/contracts:\n  ${problems.join('\n  ')}`);
    this.name = 'ContractMismatchError';
    this.problems = problems;
  }
}

/** Fail closed when a real upstream operation is renamed or becomes internal. */
export function assertPathsMatchContract(): void {
  const problems: string[] = [];
  const byOperationId = new Map<string, RouteFact>(ROUTE_TABLE.map((route) => [route.operationId, route]));
  const brokered = new Set(['verifyIdentity']);

  if (ROUTE_TABLE.length === 0) problems.push('ROUTE_TABLE is empty.');
  if (BROWSER_ROUTES.length === 0) problems.push('BROWSER_ROUTES is empty.');
  if (SERVICE_INTERNAL_ROUTES.length === 0) problems.push('SERVICE_INTERNAL_ROUTES is empty.');

  const seen = new Set<string>();
  for (const edgeOperation of EDGE_OPERATIONS) {
    if (seen.has(edgeOperation.id)) problems.push(`${edgeOperation.id}: duplicate operation id.`);
    seen.add(edgeOperation.id);

    if (edgeOperation.edgePath.includes('${') || edgeOperation.edgePath.includes(':')) {
      problems.push(`${edgeOperation.id}: edge path is templated.`);
    }
    if (edgeOperation.upstreamOperationId === null) continue;
    const upstream = byOperationId.get(edgeOperation.upstreamOperationId);
    if (upstream === undefined) {
      problems.push(`${edgeOperation.id}: no contract operation "${edgeOperation.upstreamOperationId}".`);
      continue;
    }
    if (upstream.reach === 'service-internal' && !brokered.has(edgeOperation.upstreamOperationId)) {
      problems.push(`${edgeOperation.id}: "${edgeOperation.upstreamOperationId}" is service-internal and not brokered.`);
    }
    if (upstream.path.includes('${') || upstream.path.includes(':')) {
      problems.push(`${edgeOperation.id}: upstream path is templated.`);
    }
  }
  if (problems.length > 0) throw new ContractMismatchError(problems);
}

assertPathsMatchContract();
