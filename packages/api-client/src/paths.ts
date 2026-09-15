import { BROWSER_ROUTES, ROUTE_TABLE, SERVICE_INTERNAL_ROUTES, type RouteFact } from '@usrp/contracts';

/**
 * A browser-facing edge operation. Exact paths only, never interpolated.
 *
 * Composition support:
 * - composition: 'single' = operation maps 1:1 to a backend service
 * - composition: 'aggregated' = operation aggregates 2+ services into one call
 *
 * When composition is 'aggregated', composedOf lists the upstream operation IDs
 * that the edge handler calls internally. The frontend wire type (response
 * interface) reflects the aggregated structure, making it explicit that multiple
 * upstreams are involved.
 */
export interface EdgeOperation {
  readonly id: string;
  readonly method: 'GET' | 'POST';
  readonly edgePath: string;
  /** Upstream @usrp/contracts operation, or null when the edge owns the behavior. */
  readonly upstreamOperationId: string | null;
  readonly session: 'officer' | 'applicant' | 'anonymous';
  readonly retryOnG2G: boolean;
  /** Type of composition. 'single' = 1:1 mapping, 'aggregated' = multiple upstreams. */
  readonly composition?: 'single' | 'aggregated';
  /** When composition is 'aggregated', the upstream operation IDs being combined. */
  readonly composedOf?: readonly string[];
  /** Explanation of why this operation aggregates multiple upstreams. */
  readonly compositionReason?: string;
}

/**
 * A route present on the backend edge-runtime branch but not yet promoted into
 * the pinned frontend contract.
 *
 * IMPORTANT: this is metadata, not a callable operation. It intentionally does
 * not satisfy EdgeOperation and cannot be passed to ApiClient.call(). The branch
 * is not merged, the frontend contract is still pinned to the current backend
 * baseline, and promoting it early would make contract drift meaningless.
 */
export interface PendingEdgeRuntimeOperation {
  readonly id: string;
  readonly edgePath: string;
  readonly method: 'POST';
  readonly session: 'officer';
  readonly upstreamOperationId: string;
  readonly runtimeCommit: string;
  readonly promotionBlocker: 'backend-merge-and-pin';
}

// Backend runtime branch evidence reviewed 2026-09-15. Keep these ids OUT of
// EDGE_OPERATIONS until that commit is merged to the backend release line and
// BACKEND_SHA is deliberately updated in frontend CI.
export const EDGE_RUNTIME_PENDING_OPERATIONS = [
  {
    id: 'enrollFieldDevice',
    edgePath: '/edge/v1/field-sync/devices',
    method: 'POST',
    session: 'officer',
    upstreamOperationId: 'enrollFieldDevice',
    runtimeCommit: 'cd45fafe6814964a34b7899a22e5ee2493357468',
    promotionBlocker: 'backend-merge-and-pin',
  },
  {
    id: 'syncFieldScores',
    edgePath: '/edge/v1/field-sync/scores',
    method: 'POST',
    session: 'officer',
    upstreamOperationId: 'syncFieldScores',
    runtimeCommit: 'cd45fafe6814964a34b7899a22e5ee2493357468',
    promotionBlocker: 'backend-merge-and-pin',
  },
  {
    id: 'resolveFieldSyncConflict',
    edgePath: '/edge/v1/field-sync/conflicts/resolve',
    method: 'POST',
    session: 'officer',
    upstreamOperationId: 'resolveFieldSyncConflict',
    runtimeCommit: 'cd45fafe6814964a34b7899a22e5ee2493357468',
    promotionBlocker: 'backend-merge-and-pin',
  },
] as const satisfies readonly PendingEdgeRuntimeOperation[];

// ══════════════════════════════════════════════════════════════════════════
// WHY `as const satisfies` AND NOT `: readonly EdgeOperation[]`
//
// The annotation this used to carry erased the id literals to `string`. That
// made `operation('getSlotInvitationKey')` a WELL-TYPED call to an operation
// that does not exist — it threw at runtime, inside a click handler, in front of
// a citizen. `satisfies` keeps the shape check AND the literals.
// ══════════════════════════════════════════════════════════════════════════
export const EDGE_OPERATIONS = [
  { id: 'officerLogin', method: 'POST', edgePath: '/edge/v1/auth/officer/login', upstreamOperationId: 'officerLogin', session: 'anonymous', retryOnG2G: false, composition: 'single' },
  { id: 'officerLogout', method: 'POST', edgePath: '/edge/v1/auth/officer/logout', upstreamOperationId: null, session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'requestOtp', method: 'POST', edgePath: '/edge/v1/auth/applicant/otp/request', upstreamOperationId: 'requestApplicantOtp', session: 'anonymous', retryOnG2G: true, composition: 'single' },
  { id: 'verifyOtp', method: 'POST', edgePath: '/edge/v1/auth/applicant/otp/verify', upstreamOperationId: 'verifyApplicantOtp', session: 'anonymous', retryOnG2G: false, composition: 'single' },
  { id: 'applicantLogout', method: 'POST', edgePath: '/edge/v1/auth/applicant/logout', upstreamOperationId: 'logoutApplicant', session: 'applicant', retryOnG2G: false, composition: 'single' },

  { id: 'listApplications', method: 'GET', edgePath: '/edge/v1/applications', upstreamOperationId: 'listApplications', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'listAmberQueue', method: 'GET', edgePath: '/edge/v1/applications/amber-queue', upstreamOperationId: 'listAmberQueue', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'findApplicationById', method: 'GET', edgePath: '/edge/v1/applications/by-id', upstreamOperationId: 'findApplicationById', session: 'officer', retryOnG2G: true, composition: 'single' },
  { id: 'getStatusHistory', method: 'GET', edgePath: '/edge/v1/applications/status-history', upstreamOperationId: 'getApplicationStatusHistory', session: 'officer', retryOnG2G: true, composition: 'single' },
  {
    id: 'getApplicationDetail',
    method: 'GET',
    edgePath: '/edge/v1/applications/detail',
    upstreamOperationId: null,
    session: 'officer',
    retryOnG2G: true,
    composition: 'aggregated',
    composedOf: ['findApplicationById', 'getStatusHistory'],
    compositionReason: 'Procedural Justice view combines application record and decision trail in one round trip. Field tablet on slow links needs both to render one cohesive view without latency penalty of separate calls.',
  },

  { id: 'recordMedicalReview', method: 'POST', edgePath: '/edge/v1/applications/medical-review', upstreamOperationId: 'recordMedicalReview', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'recordFinalDecision', method: 'POST', edgePath: '/edge/v1/applications/final-decision', upstreamOperationId: 'recordFinalDecision', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'acceptApplication', method: 'POST', edgePath: '/edge/v1/applications/accept', upstreamOperationId: 'acceptApplication', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'adjudicateApplication', method: 'POST', edgePath: '/edge/v1/applications/adjudicate', upstreamOperationId: 'adjudicateApplication', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'registerWalkIn', method: 'POST', edgePath: '/edge/v1/applications/walk-in/register', upstreamOperationId: 'registerWalkIn', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'vetWalkIn', method: 'POST', edgePath: '/edge/v1/applications/walk-in/vet', upstreamOperationId: 'vetWalkIn', session: 'officer', retryOnG2G: false, composition: 'single' },
  { id: 'verifyIdentity', method: 'POST', edgePath: '/edge/v1/identities/verify', upstreamOperationId: 'verifyIdentity', session: 'officer', retryOnG2G: false, composition: 'single' },

  { id: 'listMyApplications', method: 'GET', edgePath: '/edge/v1/me/applications', upstreamOperationId: 'listMyApplications', session: 'applicant', retryOnG2G: true, composition: 'single' },
  { id: 'withdrawMyApplication', method: 'POST', edgePath: '/edge/v1/me/applications/withdraw', upstreamOperationId: 'withdrawMyApplication', session: 'applicant', retryOnG2G: false, composition: 'single' },
  { id: 'getMyErasureRequest', method: 'GET', edgePath: '/edge/v1/me/erasure-request', upstreamOperationId: 'getMyErasureRequest', session: 'applicant', retryOnG2G: true, composition: 'single' },
  { id: 'fileMyErasureRequest', method: 'POST', edgePath: '/edge/v1/me/erasure-request', upstreamOperationId: 'fileMyErasureRequest', session: 'applicant', retryOnG2G: false, composition: 'single' },

  { id: 'readSession', method: 'GET', edgePath: '/edge/v1/session', upstreamOperationId: null, session: 'anonymous', retryOnG2G: false, composition: 'single' },
  { id: 'refreshSession', method: 'POST', edgePath: '/edge/v1/session/refresh', upstreamOperationId: null, session: 'anonymous', retryOnG2G: false, composition: 'single' },
] as const satisfies readonly EdgeOperation[];

export type EdgeOperationId = (typeof EDGE_OPERATIONS)[number]['id'];

export type AnonymousEdgeOperationId = Extract<
  (typeof EDGE_OPERATIONS)[number],
  { readonly session: 'anonymous' }
>['id'];

const BY_ID: ReadonlyMap<string, EdgeOperation> = new Map(
  EDGE_OPERATIONS.map((edgeOperation): readonly [string, EdgeOperation] => [edgeOperation.id, edgeOperation]),
);

export function operation(id: string): EdgeOperation {
  const found = BY_ID.get(id);
  if (found === undefined) throw new Error(`Unknown edge operation "${id}". Add it to EDGE_OPERATIONS in paths.ts.`);
  return found;
}

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

    // Composition sanity checks
    if (edgeOperation.composition === 'aggregated') {
      if (!edgeOperation.composedOf || edgeOperation.composedOf.length < 2) {
        problems.push(`${edgeOperation.id}: aggregated composition must list 2+ upstream operation IDs in composedOf.`);
      }
    } else if (edgeOperation.composition === 'single' || edgeOperation.composition === undefined) {
      if (edgeOperation.composedOf !== undefined) {
        problems.push(`${edgeOperation.id}: composedOf should only be set when composition is 'aggregated'.`);
      }
    }

    // For aggregated compositions, we don't require a single upstreamOperationId because the aggregation
    // means multiple upstreams. For single compositions, validate the upstream exists.
    if (edgeOperation.composition === 'single' || edgeOperation.composition === undefined) {
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
  }
  if (problems.length > 0) throw new ContractMismatchError(problems);
}

assertPathsMatchContract();
