// ══════════════════════════════════════════════════════════════════
// @usrp/ui — state vocabulary and pure helpers (S06)
//
// Pure and total: no React, no clock (callers pass `now`), no api-client import
// (ui must not depend on it; features translate their errors with
// `stateFromHttpStatus`).
// ══════════════════════════════════════════════════════════════════

export const UI_STATE_KINDS = [
  "loading",
  "ready",
  "empty",
  "filtered-empty",
  "forbidden",
  "not-found",
  "partial",
  "stale",
  "upstream-failure",
  "conflict",
] as const;
export type UiStateKind = (typeof UI_STATE_KINDS)[number];

/** HTTP status (0 = no response) to the state a screen shows for a failed read. */
export function stateFromHttpStatus(status: number): UiStateKind {
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  return "upstream-failure";
}

export interface ListStateInput {
  readonly isLoading: boolean;
  readonly errorStatus: number | null;
  readonly rowCount: number;
  readonly filtersActive: boolean;
  readonly isPartial?: boolean;
  readonly isStale?: boolean;
}

/** PURE. The one state a list screen is in. Errors win over data; empty depends on filters. */
export function listState(input: ListStateInput): UiStateKind {
  if (input.isLoading) return "loading";
  if (input.errorStatus !== null) return stateFromHttpStatus(input.errorStatus);
  // Partial and stale beat empty: a missing piece must never read as "nothing here".
  if (input.isPartial === true) return "partial";
  if (input.rowCount === 0) return input.filtersActive ? "filtered-empty" : "empty";
  if (input.isStale === true) return "stale";
  return "ready";
}

export const AGE_BUCKETS = ["fresh", "aging", "overdue"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export interface Age {
  readonly minutes: number;
  readonly bucket: AgeBucket;
  /** True when the instant could not be read; the age is then treated as overdue, never fresh. */
  readonly unknown: boolean;
  /** Largest whole unit: { unit: "day", value: 2 }. */
  readonly unit: "minute" | "hour" | "day";
  readonly value: number;
}

export interface AgeThresholds {
  readonly agingAfterMinutes: number;
  readonly overdueAfterMinutes: number;
}
export const DEFAULT_AGE_THRESHOLDS: AgeThresholds = { agingAfterMinutes: 24 * 60, overdueAfterMinutes: 3 * 24 * 60 };

/**
 * PURE. Age of `since` at `now`. A future instant is age 0 (never negative). An
 * unparsable one FAILS CLOSED: unknown, overdue, never fresh.
 */
export function ageOf(since: string, now: Date, thresholds: AgeThresholds = DEFAULT_AGE_THRESHOLDS): Age {
  const t = Date.parse(since);
  if (Number.isNaN(t)) return { minutes: 0, bucket: "overdue", unknown: true, unit: "minute", value: 0 };
  const minutes = Math.max(0, Math.floor((now.getTime() - t) / 60_000));
  const bucket: AgeBucket = minutes >= thresholds.overdueAfterMinutes ? "overdue" : minutes >= thresholds.agingAfterMinutes ? "aging" : "fresh";
  if (minutes >= 24 * 60) return { minutes, bucket, unknown: false, unit: "day", value: Math.floor(minutes / (24 * 60)) };
  if (minutes >= 60) return { minutes, bucket, unknown: false, unit: "hour", value: Math.floor(minutes / 60) };
  return { minutes, bucket, unknown: false, unit: "minute", value: minutes };
}

export interface Freshness {
  readonly stale: boolean;
  readonly age: Age;
}

/** PURE. A read older than `staleAfterMinutes` is stale. */
export function freshnessOf(updatedAt: string, now: Date, staleAfterMinutes = 5): Freshness {
  const age = ageOf(updatedAt, now, { agingAfterMinutes: staleAfterMinutes, overdueAfterMinutes: staleAfterMinutes });
  return { stale: age.unknown || age.minutes >= staleAfterMinutes, age };
}

/** PURE. Keep the last `keep` characters visible; everything else becomes a bullet. Short values are fully masked. */
export function maskValue(value: string, keep = 3): string {
  const chars = [...value];
  if (chars.length === 0) return "";
  const visible = chars.length > keep * 2 ? keep : 0;
  return "•".repeat(chars.length - visible) + chars.slice(chars.length - visible).join("");
}

export interface TimelineEntry {
  readonly id: string;
  readonly at: string;
  readonly title: string;
  readonly detail?: string;
}

/** PURE. Newest first; unparsable instants sort last; stable for ties. */
export function sortTimeline<T extends { readonly at: string }>(entries: readonly T[]): T[] {
  const key = (e: T): number => {
    const t = Date.parse(e.at);
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  };
  return entries.map((e, i) => ({ e, i })).sort((a, b) => key(b.e) - key(a.e) || a.i - b.i).map((x) => x.e);
}
