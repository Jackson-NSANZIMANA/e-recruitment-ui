// ═══════════════════════════════════════════════════════════════
// scheduling — no API surface, deliberately
//
// WHAT WAS HERE:
//
//     export const getInvitationKey = (t: SliceTransport): Promise<InvitationKey> =>
//       t.call('getSlotInvitationKey');
//
// One function, one operation, and the operation does not exist — not in
// EDGE_OPERATIONS, not in the contract's ROUTE_TABLE, not in the backend.
// Calling it throws `Unknown edge operation "getSlotInvitationKey"` from
// paths.ts. It type-checked because the phantom transport took
// `operationId: string`.
//
// DELETED rather than repointed, because there is nothing to repoint it at:
// scheduling-service has no source (000.md §6 lists it as a scaffold), so there
// is no route for an edge operation to front.
//
// WHAT REMAINS, AND WHY IT IS STILL REAL WORK
//
// The QR invitation-key VERIFICATION model in `../model/invitation.ts` operates
// on a signed token the device ALREADY HOLDS — the `qrInvitationCode` that
// `registerWalkIn` returns on the officer console today. Verifying a token you
// were handed needs no server call, which is exactly why the locale bundle can
// promise "the signing key is cached on this device, so verification works with
// no signal" and mean it.
//
// What cannot exist yet is FETCHING a slot or an invitation. See
// SCHEDULING_UNSERVED_BY_EDGE in ./transport.ts.
//
// This file deliberately re-exports NOTHING from ./transport.ts: the package
// barrel does `export *` from both, so duplicating a name here would be a
// compile error.
// ═══════════════════════════════════════════════════════════════

/**
 * There is no server call in this slice, and that is a verified fact rather than
 * an omission.
 *
 * Asserted by `SCHEDULING_OPERATIONS` being empty and typed against
 * `EdgeOperationId`: the day a real scheduling operation lands, moving it into
 * that list is a one-line change the compiler validates.
 */
export const SCHEDULING_HAS_NO_API_SURFACE = true;
