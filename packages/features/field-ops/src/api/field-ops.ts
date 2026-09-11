// ═══════════════════════════════════════════════════════════════
// field-ops — the two calls that work, and nothing else
//
// DELETED: verifyBiometric, enrollDevice, syncScores, resolveConflict. All four
// named operations that do not exist; all four would have thrown. See
// FIELD_OPS_UNSERVED_BY_EDGE for what each waits on.
// ═══════════════════════════════════════════════════════════════

import type { ApiClient } from './transport.ts';

/**
 * Walk-in step one: National ID → opaque `applicantId`.
 *
 * Returns `{ status, applicantId }` and NOTHING else. No name, no date of birth.
 * The officer confirms identity from the physical document in front of them, not
 * from a pre-filled field — raw NIDA PII is rejected by the contract's negative
 * fixtures, and a green tick beside a National ID field is an enumeration oracle
 * with a friendly face.
 */
export const verifyIdentityAtDesk = (
  client: ApiClient,
  nationalId: string,
  correlationId?: string,
): Promise<{ readonly status: 'CREATED' | 'ALREADY_EXISTS'; readonly applicantId: string }> =>
  client.call('verifyIdentity', {
    body: { nationalId, channel: 'WALK_IN' },
    ...(correlationId === undefined ? {} : { correlationId }),
  });

/**
 * Walk-in step two: create the application.
 *
 * NOTE WHAT IS ABSENT: `nationalIdHash`. It is an internal cross-service key that
 * must never reach a browser, and the controller does not accept it. It takes the
 * opaque `applicantId` from step one.
 *
 * `qrInvitationCode` in the response is the on-site ticket the candidate carries;
 * field-score capture binds to IT, not to a venue.
 */
export const registerWalkIn = (
  client: ApiClient,
  body: { readonly applicantId: string; readonly category: string },
  correlationId?: string,
): Promise<{
  readonly status: 'REGISTERED';
  readonly applicationId: string;
  readonly processingCode: string;
  readonly qrInvitationCode: string;
}> => client.call('registerWalkIn', { body, ...(correlationId === undefined ? {} : { correlationId }) });

/**
 * Walk-in step three: on-site vetting.
 *
 * Can answer `409 AGE_PENDING` while the candidate waits — the age verdict rides
 * the Kafka backbone and lands in seconds. That is the OFFICER's retry to make,
 * which is why this is a separate call with its own button rather than being
 * folded into step two, where a normal explainable pause would have become either
 * a hidden failure or a false success.
 */
export const vetWalkIn = (
  client: ApiClient,
  applicationId: string,
  correlationId?: string,
): Promise<unknown> =>
  client.call<unknown>('vetWalkIn', {
    body: { applicationId },
    ...(correlationId === undefined ? {} : { correlationId }),
  });
