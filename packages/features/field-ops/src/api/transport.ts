// Field-operations transport boundary.
//
// The current backend main commit exposes the field-sync edge routes. They are
// now active EdgeOperationId values and can be called by a feature adapter. The
// tablet queue is still deliberately disabled: browser reachability is not the
// same claim as durable offline capture, idempotent replay, and conflict-safe
// local persistence. That distinction prevents a UI from promising sync before
// the IndexedDB command queue exists.

import type { ApiClient, CallOptions, EdgeOperationId } from '@usrp/api-client';

export type { ApiClient, CallOptions };

export const FIELD_OPS_OPERATIONS = [
  'verifyIdentity',
  'registerWalkIn',
  'vetWalkIn',
  'enrollFieldDevice',
  'syncFieldScores',
  'resolveFieldSyncConflict',
] as const satisfies readonly EdgeOperationId[];

export type FieldOpsOperation = (typeof FIELD_OPS_OPERATIONS)[number];

export type UnservedReason = 'upstream-unverified';

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
 * Biometric verification remains unserved because no controller evidence has
 * been reviewed. It must not be promoted from a package directory or a design
 * document alone.
 */
export const FIELD_OPS_UNSERVED: readonly UnservedOperation[] = [
  {
    name: 'verifyBiometric',
    reason: 'upstream-unverified',
    upstreamPath: null,
    edgePath: null,
    evidence: null,
    runtimeCommit: null,
    note: 'No controller evidence reviewed. Do not expose a biometric operation until the backend source, edge registry, and privacy contract are verified together.',
  },
];

/**
 * The edge can receive field-sync commands, but the tablet has no durable local
 * command queue yet. Keep offline capture disabled until the queue, idempotency,
 * replay, and conflict UI are implemented and proved.
 */
export const OFFLINE_CAPTURE_CAN_SYNC = false;

/** True when the active frontend registry contains the promoted sync operation. */
export function fieldSyncIsReachable(edgeOperationIds: readonly string[]): boolean {
  return edgeOperationIds.includes('syncFieldScores');
}
