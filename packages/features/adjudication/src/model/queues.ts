// ══════════════════════════════════════════════════════════════════
// adjudication — the officer queues (S06). Pure.
//
// Four queues, each a view over the state machine for one post: amber document
// holds, post-clearance (adjudication) holds, medical, final decision and
// acceptance. A queue offers a row only the transitions that its status allows
// AND the officer's permissions permit; the backend re-checks both.
// ══════════════════════════════════════════════════════════════════

export const QUEUE_IDS = ['amber', 'holds', 'medical', 'final'] as const;
export type QueueId = (typeof QUEUE_IDS)[number];

/** Statuses per search-backed queue (amber and holds come from the amber-queue read). */
export const QUEUE_STATUSES: Readonly<Record<'medical' | 'final', readonly string[]>> = {
  medical: ['PHYSICAL_TEST_COMPLETE', 'WALK_IN_PHYSICAL_TEST'],
  final: ['MEDICAL_REVIEW', 'FINAL_SHORTLIST'],
};

export const QUEUE_READ_PERMISSION = 'adjudication.read';

export type RowTransition = 'clear' | 'reject' | 'shortlist' | 'accept' | 'verdict' | 'open';

/** PURE. The transitions offered on one row of a queue. `open` is always offered. */
export function rowTransitions(queue: QueueId, status: string, permissions: readonly string[]): readonly RowTransition[] {
  const can = (p: string): boolean => permissions.includes(p);
  const out: RowTransition[] = [];
  if (queue === 'amber' || queue === 'holds') {
    if (can('adjudication.decide')) out.push('clear', 'reject');
  } else if (queue === 'medical') {
    if (can('medical.review')) out.push('verdict');
  } else {
    if (status === 'MEDICAL_REVIEW' && can('decision.final')) out.push('shortlist', 'reject');
    if (status === 'FINAL_SHORTLIST' && can('application.accept')) out.push('accept');
  }
  out.push('open');
  return out;
}

export interface BulkResult {
  readonly id: string;
  readonly ok: boolean;
  readonly code: string;
}

/**
 * Apply `apply` to each id strictly in order, one at a time, and report every
 * row's own result. A failure on one row never stops or hides the others, and
 * nothing is retried: a refused or uncertain write is shown, not repeated.
 */
export async function runBulk(
  ids: readonly string[],
  apply: (id: string) => Promise<{ readonly ok: boolean; readonly code: string }>,
  onResult?: (result: BulkResult) => void,
): Promise<readonly BulkResult[]> {
  const results: BulkResult[] = [];
  for (const id of ids) {
    let r: BulkResult;
    try {
      const outcome = await apply(id);
      r = { id, ok: outcome.ok, code: outcome.code };
    } catch {
      r = { id, ok: false, code: 'ERROR' };
    }
    results.push(r);
    onResult?.(r);
  }
  return results;
}

/** PURE. Which of the queue tabs this officer sees: reading needs adjudication.read. */
export function visibleQueues(permissions: readonly string[]): readonly QueueId[] {
  return permissions.includes(QUEUE_READ_PERMISSION) ? QUEUE_IDS : [];
}
