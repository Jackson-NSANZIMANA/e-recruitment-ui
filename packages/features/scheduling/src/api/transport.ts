// ═══════════════════════════════════════════════════════════════
// scheduling — transport
//
// THIS SLICE HAS NO CALLABLE EDGE OPERATION. Not one.
//
// It declared exactly one, `getSlotInvitationKey`, and that operation exists
// nowhere: not in EDGE_OPERATIONS, not in the contract's ROUTE_TABLE, not in the
// backend. scheduling-service is a SCAFFOLD — 000.md §6 lists it as "directory
// exists, no source yet".
//
// So the honest surface is an empty operation list plus a named gap. The
// alternative — keeping a typed function over a route nobody serves — is the
// thing that made this frontend look finished while being unable to work.
// ═══════════════════════════════════════════════════════════════

import type { ApiClient, CallOptions, EdgeOperationId } from '@usrp/api-client';

export type { ApiClient, CallOptions };

/** Empty, and correct. See the header. */
export const SCHEDULING_OPERATIONS = [] as const satisfies readonly EdgeOperationId[];

/**
 * What this slice is waiting on, named so it is tracked rather than assumed.
 *
 * TYPED `readonly string[]` ON PURPOSE — not `EdgeOperationId`, because that is
 * exactly what these are not. If one of them ever becomes real, moving it into
 * SCHEDULING_OPERATIONS is a one-line change the compiler will validate.
 */
export const SCHEDULING_UNSERVED_BY_EDGE: readonly string[] = [
  // Was `getSlotInvitationKey`. Needs scheduling-service to exist at all, then a
  // slot-allocation route, then an edge operation to front it.
  'getSlotInvitationKey',
];

/**
 * The citizen slot gap, recorded as a fact.
 *
 * A citizen assigned an exam slot has NO endpoint that tells them when or where.
 * `SLOT_ASSIGNED` reaches them as a status label and nothing more. That is a
 * product gap owned by the backend roadmap (000.md §14 frontier), not something a
 * frontend can close by rendering a placeholder date.
 */
export const CITIZEN_CAN_READ_OWN_SLOT = false;
