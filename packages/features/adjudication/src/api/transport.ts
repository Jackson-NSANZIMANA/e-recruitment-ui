// ═══════════════════════════════════════════════════════════════
// adjudication — transport
//
// The ONLY slice whose six operation ids were all real. Worth stating plainly:
// the phantom transport is still replaced here, because an interface that
// accepts `operationId: string` is what let the other five drift, and leaving it
// in one slice leaves the door open in the next commit.
// ═══════════════════════════════════════════════════════════════

import type { ApiClient, CallOptions, EdgeOperationId } from '@usrp/api-client';

export type { ApiClient, CallOptions };

export const ADJUDICATION_OPERATIONS = [
  'listAmberQueue',
  'findApplicationById',
  'acceptApplication',
  'adjudicateApplication',
  'recordMedicalReview',
  'recordFinalDecision',
] as const satisfies readonly EdgeOperationId[];

export type AdjudicationOperation = (typeof ADJUDICATION_OPERATIONS)[number];

/**
 * NONE of the four transitions may be retried by the transport.
 *
 * The registry sets `retryOnG2G: false` on every one, and the call site cannot
 * override it. A retried transition is a DOUBLE WRITE on a citizen's legal
 * record. Restated here because this is the slice that issues them.
 */
export const TRANSITIONS_ARE_NEVER_RETRIED = true;
