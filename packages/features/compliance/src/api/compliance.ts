// ═══════════════════════════════════════════════════════════════
// compliance — the citizen half, which works
//
// DELETED: listErasureRequests, declineErasureRequest. Both officer-side, both
// naming operations that do not exist. See COMPLIANCE_UNSERVED_BY_EDGE.
// ═══════════════════════════════════════════════════════════════

import type { WithdrawOutcome } from '../model/self-withdrawal.ts';
import type { ApiClient } from './transport.ts';

/**
 * ADR-015. A 404 is a NORMAL state here: "no erasure request on file".
 *
 * It is not an error UI, and it must not be rendered as one.
 */
export const getMyErasureRequest = (client: ApiClient): Promise<Readonly<Record<string, unknown>>> =>
  client.call<Readonly<Record<string, unknown>>>('getMyErasureRequest');

/**
 * ADR-015. Answers 202: FILED, NOT ACTIONED.
 *
 * The confirmation copy must say the request was received and will be reviewed.
 * It must not say the data was erased — erasure is a soft delete a DPO has to
 * action, and there is no DPO queue yet (COMPLIANCE_UNSERVED_BY_EDGE).
 */
export const fileMyErasureRequest = (client: ApiClient): Promise<Readonly<Record<string, unknown>>> =>
  client.call<Readonly<Record<string, unknown>>>('fileMyErasureRequest');

/**
 * ADR-020 self-withdrawal. Four outcomes across three status codes.
 *
 * Already-WITHDRAWN is an idempotent 200 `NO_CHANGE`; ACCEPTED, REJECTED and
 * WALK_IN_REJECTED are 409 `NOT_APPLICABLE`. Ownership is derived from the
 * SESSION inside the write transaction, never from a body field — so this sends
 * only an `applicationId`, and offering an `applicantId` the server correctly
 * ignores would invite the next reader to think it matters.
 */
export const withdrawMyApplication = (client: ApiClient, applicationId: string): Promise<WithdrawOutcome> =>
  client.call<WithdrawOutcome>('withdrawMyApplication', { body: { applicationId } });
