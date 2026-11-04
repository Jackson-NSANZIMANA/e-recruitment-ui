// ══════════════════════════════════════════════════════════════════
// @usrp/ui — reading a count without inventing one
//
// A metric tile that renders `data?.total ?? 0` while the read is in flight is
// not showing a number, it is making a claim: "zero applications are awaiting
// adjudication". An officer who acts on that claim during a slow read is acting
// on a false fact, and the falsehood is invisible because 0 is a perfectly
// ordinary value for a queue.
//
// The rule this encodes: a count has three states, not one. Known, not yet
// known, and unable to be known. They must be distinguishable on screen, so the
// type keeps them apart and the tile cannot collapse them by accident.
// ══════════════════════════════════════════════════════════════════

export type Count =
  /** A reading was taken and this is it. `0` here means genuinely zero. */
  | { readonly state: "known"; readonly value: number }
  /** The read has not answered yet. Say nothing rather than say zero. */
  | { readonly state: "pending" }
  /** The read failed. The tile says so instead of showing a stale or zero figure. */
  | { readonly state: "failed" };

/** A known count. The only constructor that can produce a `0` reading. */
export const known = (value: number): Count => ({
  state: "known",
  value: Number.isFinite(value) ? value : 0,
});

export const PENDING: Count = { state: "pending" };
export const FAILED: Count = { state: "failed" };

export interface CountQueryLike {
  readonly data: unknown;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

/**
 * Turn a query into a count.
 *
 * `select` runs only when the query actually has data, so a `select` that would
 * throw on a half-built response cannot be reached during loading. Errors win
 * over pending: a failed read that is also retrying is still a failed read, and
 * saying "loading" would hide the failure behind motion.
 */
export function countFrom<T>(
  query: CountQueryLike & { readonly data: T | undefined },
  select: (data: T) => number,
): Count {
  if (query.isError) return FAILED;
  if (query.data === undefined) return PENDING;
  return known(select(query.data));
}

/** The numeric reading, or `null` when there is none. Never a fabricated zero. */
export function valueOf(count: Count): number | null {
  return count.state === "known" ? count.value : null;
}
