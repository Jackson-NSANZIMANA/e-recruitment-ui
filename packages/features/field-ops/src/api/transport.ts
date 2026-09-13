// ═══════════════════════════════════════════════════════════════
// field-ops — transport
//
// CORRECTED 2026-09-13 (incoming frontend architect). The previous version of
// this file asserted that FOUR of this slice's six operations were "invented"
// against an architecture diagram, and that field-sync-service is a SCAFFOLD
// with "directory exists, no source".
//
// THREE OF THOSE FOUR ARE IMPLEMENTED UPSTREAM. Read, not inferred, in the
// backend tree at commit 2b1814f:
//
//   services/field-sync-service/src/adapters/http/enroll-device.controller.ts
//   services/field-sync-service/src/adapters/http/sync-scores.controller.ts
//   services/field-sync-service/src/adapters/http/resolve-conflict.controller.ts
//
// plus device-registry.pg.ts and field-score-store.pg.ts adapters, a domain and
// application layer, main.ts, and a selfcheck. The service manifest describes
// itself as "enrolls field tablets, verifies device-signed score records, merges
// them with vector clocks".
//
// The predecessor read 000.md §6 instead of the tree. That is precisely the
// error his own handover audit was written to punish, and it matters more than
// a wrong comment: the operative conclusion below (capture must not sync yet)
// was RIGHT, so a reviewer who spot-checks the reason, finds field-sync alive,
// and concludes the whole note is stale will flip the flag into a missing edge.
//
// THE REAL BLOCKER IS THE EDGE, NOT THE UPSTREAM. The browser's only legal
// origin is /edge/v1/** (ADR-021, edge-contract.md §1). In the backend tree
// services/edge-gateway/ contains ONLY openapi/ — no package.json, no
// entrypoint, no runnable composition. An implemented upstream controller with
// no edge route in front of it is not reachable from a tablet.
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

/** Where an unserved operation's blocker actually sits. */
export type UnservedReason =
  /** Implemented upstream and verified by file; no /edge/v1 route brokers it. */
  | 'edge-route-missing'
  /** No upstream implementation has been read. Do not assume either way. */
  | 'upstream-unverified';

export interface UnservedOperation {
  /**
   * The name a slice would have called. Typed `string`, NEVER `EdgeOperationId`,
   * so it cannot be passed to the transport by accident.
   */
  readonly name: string;
  readonly reason: UnservedReason;
  /** The upstream route, when one has been read from source. */
  readonly upstreamPath: string | null;
  /** The file that proves the claim, or null when the claim is an absence. */
  readonly evidence: string | null;
  readonly note: string;
}

/**
 * Operations this slice must not call, each with its REAL blocker and the file
 * that proves it.
 *
 * The shape changed deliberately. The old flat `readonly string[]` could only
 * say "absent", which is how three implemented controllers came to be recorded
 * as fiction. Every entry now carries provenance, so the next reviewer checks a
 * citation instead of re-deriving it — and an entry with `evidence: null` is
 * visibly weaker than one with a path, which is the honest distinction.
 */
export const FIELD_OPS_UNSERVED_BY_EDGE: readonly UnservedOperation[] = [
  {
    name: 'enrollFieldDevice',
    reason: 'edge-route-missing',
    upstreamPath: 'POST /v1/field-sync/devices',
    evidence: 'services/field-sync-service/src/adapters/http/enroll-device.controller.ts',
    note:
      'IMPLEMENTED upstream. Officer-authenticated; agency and enrolling officer come ' +
      'from the verified token, never the body. Registers an Ed25519 PUBLIC key per ' +
      'device (the private key never leaves the tablet). Idempotent: 201 ENROLLED, ' +
      '200 ALREADY_ENROLLED. Blocked only by the absent edge route.',
  },
  {
    name: 'syncFieldScores',
    reason: 'edge-route-missing',
    upstreamPath: 'POST /v1/field-sync/scores',
    evidence: 'services/field-sync-service/src/adapters/http/sync-scores.controller.ts',
    note:
      'IMPLEMENTED upstream. Batch upload of device-signed captures. Shape-validated ' +
      'at the edge of the service, cryptographically verified in the core; a malformed ' +
      'batch is 400, a well-formed but forged record is rejected PER-RECORD with 200 ' +
      'and a per-record result so a safe re-upload converges. Vector clocks are part ' +
      'of the record shape. Blocked only by the absent edge route.',
  },
  {
    name: 'resolveFieldConflict',
    reason: 'edge-route-missing',
    upstreamPath: 'POST /v1/field-sync/conflicts/resolve',
    evidence: 'services/field-sync-service/src/adapters/http/resolve-conflict.controller.ts',
    note:
      'IMPLEMENTED upstream. Officer adjudicates concurrent captures by selecting the ' +
      'authoritative score row. `resolution` is REQUIRED and capped at 50 characters ' +
      'server-side — ADR-FE-005 caps the client input at the same 50, and that number ' +
      'is now verified against this controller rather than asserted. 409 NO_CONFLICT is ' +
      'a real outcome and must surface to the officer, not be swallowed as an error.',
  },
  {
    name: 'verifyBiometric',
    reason: 'upstream-unverified',
    upstreamPath: null,
    evidence: null,
    note:
      'UNVERIFIED — claimed neither way. biometric-service has a populated src tree, a ' +
      'selfcheck and a manifest, but NO controller in it has been read, so it is not ' +
      'promoted to implemented on the strength of a directory listing. That inference ' +
      'is the exact defect this file was rewritten to remove. Read the service before ' +
      'moving this entry. When it moves: only SCORES are ever stored, never frames or ' +
      'vectors, and nidaMatchConfidence is the officer-visible field.',
  },
];

/**
 * Offline capture must not attempt to sync, and the tablet must say so plainly.
 *
 * STILL FALSE, FOR A CORRECTED REASON. The upstream batch endpoint exists and is
 * verified (see above). What does not exist is any browser-reachable route to it:
 * services/edge-gateway/ holds an OpenAPI document and nothing else, and the
 * browser is forbidden from calling a service port directly.
 *
 * A queue that accumulates signed scores against an unreachable endpoint loses
 * an officer's whole day the first time the buffer is cleared. Until an edge
 * route brokers POST /v1/field-sync/scores, capture stays local AND THE UI SAYS
 * SO — see `offline.sync_unavailable` in @usrp/i18n, rendered by the officer
 * console's ConnectionStatus. Silence here is what turns a known limitation into
 * an officer's discovery at a venue.
 */
export const OFFLINE_CAPTURE_CAN_SYNC = false;

/**
 * The single condition that flips the flag above.
 *
 * Written as a predicate over a fact someone must verify, rather than a comment
 * someone must remember. When the edge composition lands, assert this against
 * EDGE_OPERATIONS instead of editing a boolean by hand.
 */
export function fieldSyncIsReachable(
  edgeOperationIds: readonly string[],
): boolean {
  return edgeOperationIds.includes('syncFieldScores');
}
