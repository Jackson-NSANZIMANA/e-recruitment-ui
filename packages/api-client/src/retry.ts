// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — retry policy
//
// THE WHOLE POLICY: retry a named G2G 503, on an operation declared retryable,
// and nothing else. Ever.
//
// Why so narrow, case by case:
//   500 — a persistence fault may have COMMITTED before failing. Retrying a
//         transition could apply it twice, and `status_history` is append-only.
//   502 — an unreachable dependency is indistinguishable from one that
//         half-completed. Same double-write risk.
//   409 — the platform's state disagrees with the request. Retrying cannot
//         change that, and `AGE_PENDING` is a retry the OFFICER makes when the
//         candidate is still at the desk, not one the client makes silently.
//   401 — retrying with the same dead session is a loop.
//   503 with an unrecognised code — an unknown 503 is not evidence of a
//         transient foreign system; treating it as one is how a real outage
//         becomes a thundering herd.
//
// Full jitter on the backoff, because three tabs of the same console retrying in
// lockstep is a small DDoS against a G2G tunnel that is already struggling.
// ══════════════════════════════════════════════════════════════════

import { ApiError } from './errors.js';

export interface RetryPolicy {
  /** Retries AFTER the first attempt. 2 means at most 3 calls. */
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  /** Injectable for tests; defaults to Math.random. */
  readonly random?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
};

/** Exponential backoff with FULL jitter, capped. */
export function backoffDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const random = policy.random ?? Math.random;
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return Math.floor(random() * exponential);
}

/**
 * Whether this failure may be retried.
 *
 * Two conditions, both required: the error is a named G2G 503 AND the caller
 * declared the operation safe to repeat. A read is always safe; a write must opt
 * in, and no transition does.
 */
export function shouldRetry(error: unknown, operationIsRetryable: boolean): boolean {
  if (!operationIsRetryable) return false;
  return error instanceof ApiError && error.isRetryable;
}

/** Run `attempt`, retrying only under the policy above. */
export async function withRetry<T>(
  attempt: () => Promise<T>,
  operationIsRetryable: boolean,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<T> {
  const sleep = policy.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
  let lastError: unknown;

  for (let tries = 0; tries <= policy.maxRetries; tries += 1) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
      if (!shouldRetry(err, operationIsRetryable) || tries === policy.maxRetries) throw err;
      await sleep(backoffDelayMs(tries, policy));
    }
  }
  throw lastError;
}
