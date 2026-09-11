// ═══════════════════════════════════════════════════════════════
// field-ops — transport
//
// TWO of this slice's six operations were real. Four were invented:
// verifyBiometric, enrollFieldDevice, syncFieldScores, resolveFieldConflict.
//
// That is not a coincidence of naming. biometric-service and field-sync-service
// are both SCAFFOLDS in 000.md §6 — directory exists, no source. The four
// functions were written against the architecture DIAGRAM rather than the
// running system, which is the same mistake as the twelve fictional statuses:
// plausible, consistent with the design, and not there.
// ═══════════════════════════════════════════════════════════════

import type { ApiClient, CallOptions, EdgeOperationId } from '@usrp/api-client';

export type { ApiClient, CallOptions };

/**
 * The walk-in lane, which is RDF-ONLY (ADR-012) and genuinely THREE calls.
 *
 * Not collapsed into one convenience wrapper: `verifyIdentity` yields the opaque
 * `applicantId` that `registerWalkIn` needs, and `vetWalkIn` legitimately answers
 * `409 AGE_PENDING` while the candidate is standing at the desk. AGE_PENDING is
 * the only retryable 409 in the platform and it is the OFFICER's retry, not the
 * transport's — the registry sets `retryOnG2G: false` on that write, because a
 * retried transition is a double write on a legal record.
 */
export const FIELD_OPS_OPERATIONS = [
  'verifyIdentity',
  'registerWalkIn',
  'vetWalkIn',
] as const satisfies readonly EdgeOperationId[];

export type FieldOpsOperation = (typeof FIELD_OPS_OPERATIONS)[number];

/**
 * The four inventions, and the backend work each one actually waits on.
 *
 * TYPED `readonly string[]` ON PURPOSE. These are not EdgeOperationIds and must
 * not be assignable to one.
 */
export const FIELD_OPS_UNSERVED_BY_EDGE: readonly string[] = [
  // biometric-service is a scaffold. 1:1 face match populates
  // `nidaMatchConfidence`; only SCORES are ever stored, never frames or vectors.
  'verifyBiometric',
  // field-sync-service is a scaffold. Device enrolment must register an Ed25519
  // public key per device (shared-security/signing.ts, ADR-003).
  'enrollFieldDevice',
  // Offline score capture reconciles by CRDT merge + vector clocks (ADR-003).
  // There is no route, and inventing an optimistic queue aimed at a missing
  // endpoint is the same lie with a delay on it.
  'syncFieldScores',
  // Conflict resolution presupposes the sync route above.
  'resolveFieldConflict',
];

/**
 * Offline capture is NOT wired to anything yet, and the tablet must not pretend.
 *
 * A queue that accumulates signed scores against an endpoint that does not exist
 * loses an officer's whole day of work the first time the buffer is cleared.
 * Until `syncFieldScores` is real, capture stays local and says so.
 */
export const OFFLINE_CAPTURE_CAN_SYNC = false;
