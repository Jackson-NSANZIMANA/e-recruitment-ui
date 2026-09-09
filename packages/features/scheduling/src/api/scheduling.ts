// ═══════════════════════════════════════════════════════════════
// scheduling — no API surface, deliberately
//
// WHAT WAS HERE:
//
//     export const getInvitationKey = (t: SliceTransport): Promise<InvitationKey> =>
//       t.call('getSlotInvitationKey');
//
// One function, one operation, and the operation does not exist. Calling it
// throws `Unknown edge operation "getSlotInvitationKey"` from paths.ts. It
// type-checked because the phantom transport took `operationId: string`.
//
// It is DELETED rather than repointed, because there is nothing to repoint it at:
// scheduling-service has no source, no route, and no edge operation.
//
// WHAT REMAINS, AND WHY IT IS STILL WORTH HAVING
//
// The QR invitation-key VERIFICATION model in `../model/invitation.ts` is pure
// domain logic over a signed token the FIELD DEVICE already holds — the
// `qrInvitationCode` that `registerWalkIn` returns on the officer console today.
// Verifying a token you were handed needs no endpoint. That is real work and it
// stays.
//
// What cannot exist yet is FETCHING a slot or an invitation from the server.
// See SCHEDULING_UNSERVED_BY_EDGE.
// ═══════════════════════════════════════════════════════════════

export { SCHEDULING_OPERATIONS, SCHEDULING_UNSERVED_BY_EDGE, CITIZEN_CAN_READ_OWN_SLOT } from './transport.ts';
