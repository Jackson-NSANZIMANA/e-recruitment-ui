// field-ops transport boundary
//
// The backend edge-runtime branch now implements the browser-facing field-sync
// routes. They remain intentionally OUT of EdgeOperationId until the backend
// runtime is merged and the frontend CI backend pin is updated. This distinction
// is load-bearing: an unmerged branch is not a production dependency.

import type { ApiClient, CallOptions, EdgeOperationId } from '@usrp/api-client';

export type { ApiClient, CallOptions };

export const FIELD_OPS_OPERATIONS = [
  'verifyIdentity',
  'registerWalkIn',
  'vetWalkIn',
] as const satisfies readonly EdgeOperationId[];

export type FieldOpsOperation = (typeof FIELD_OPS_OPERATIONS)[number];

export type UnservedReason =
  | 'edge-runtime-not-promoted'
  | 'upstream-unverified';

export interface UnservedOperation {
  readonly name: string;
  readonly reason: UnservedReason;
  readonly upstreamPath: string | null;
  readonly edgePath: string | null;
  readonly evidence: string | null;
  readonly runtimeCommit: string | null;
  readonly note: string;
}

/**
 * These routes exist on backend edge-runtime commit
 * cd45fafe6814964a34b7899a22e5ee2493357468, but that branch is not the pinned
 * backend release line. They are metadata only and cannot be passed to the
 * operation transport by construction.
 */
export const FIELD_OPS_PENDING_EDGE_PROMOTION: readonly UnservedOperation[] = [
  {
    name: 'enrollFieldDevice',
    reason: 'edge-runtime-not-promoted',
    upstreamPath: 'POST /v1/field-sync/devices',
    edgePath: 'POST /edge/v1/field-sync/devices',
    evidence: 'services/edge-gateway/src/adapters/http/field-sync.controller.ts',
    runtimeCommit: 'cd45fafe6814964a34b7899a22e5ee2493357468',
    note: 'Implemented on the runtime branch. Promote only after backend merge, pinned-contract regeneration, and live smoke proof.',
  },
  {
    name: 'syncFieldScores',
    reason: 'edge-runtime-not-promoted',
    upstreamPath: 'POST /v1/field-sync/scores',
    edgePath: 'POST /edge/v1/field-sync/scores',
    evidence: 'services/edge-gateway/src/adapters/http/field-sync.controller.ts',
    runtimeCommit: 'cd45fafe6814964a34b7899a22e5ee2493357468',
    note: 'Device-signed batch forwarding exists on the runtime branch. The tablet queue stays disabled until the merged edge contract is pinned and proven.',
  },
  {
    name: 'resolveFieldSyncConflict',
    reason: 'edge-runtime-not-promoted',
    upstreamPath: 'POST /v1/field-sync/conflicts/resolve',
    edgePath: 'POST /edge/v1/field-sync/conflicts/resolve',
    evidence: 'services/edge-gateway/src/adapters/http/field-sync.controller.ts',
    runtimeCommit: 'cd45fafe6814964a34b7899a22e5ee2493357468',
    note: 'Conflict resolution exists on the runtime branch. Keep the human-resolution model, including the 50-character cap and explicit NO_CONFLICT state.',
  },
  {
    name: 'verifyBiometric',
    reason: 'upstream-unverified',
    upstreamPath: null,
    edgePath: null,
    evidence: null,
    runtimeCommit: null,
    note: 'No controller evidence reviewed. Do not promote this operation from a directory listing or a design document.',
  },
];

/** The tablet must not enqueue work for an unpromoted browser contract. */
export const OFFLINE_CAPTURE_CAN_SYNC = false;

/**
 * Promotion predicate used by tests and the future activation change. It is
 * intentionally separate from the feature flag: a route can exist on a branch
 * and still be unsafe to activate in the pinned frontend.
 */
export function fieldSyncIsReachable(edgeOperationIds: readonly string[]): boolean {
  return edgeOperationIds.includes('syncFieldScores');
}
