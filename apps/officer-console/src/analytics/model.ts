// ══════════════════════════════════════════════════════════════════
// officer-console - the analytics screens' pure model.
//
// Every figure on the analytics screens is an exact count the edge already
// serves (`searchApplications` returns `total` for any filter), asked once per
// cell. Nothing here estimates, extrapolates or invents a reading: a chart with
// no data says so. This file only decides WHICH counts to ask for and how to
// shape the answers; it has no I/O and no clock (`now` is a parameter).
//
// Days are Kigali calendar days, the same definition the edge uses for
// `submittedFrom` / `submittedTo` (inclusive, Africa/Kigali), so a bar labelled
// "4 Nov" counts exactly what the search for 4 Nov counts.
// ══════════════════════════════════════════════════════════════════

import type { ApplicationSearchQuery } from "@usrp/api-client";
import { PIPELINE_STAGES, type PipelineStageId } from "../dashboard/model.js";

const KIGALI_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` for the Kigali calendar day an instant falls on. */
export function kigaliDate(at: Date): string {
  const parts = KIGALI_DAY.formatToParts(at);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The calendar day `delta` days from `date` (negative = earlier). Pure date arithmetic: no time zone is involved. */
export function addDays(date: string, delta: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`);
  return new Date(ms + delta * DAY_MS).toISOString().slice(0, 10);
}

/** The `count` calendar days ending on `now`'s day, oldest first. */
export function lastDays(now: Date, count: number): readonly string[] {
  const end = kigaliDate(now);
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

/** This period and the one before it, each `days` long, oldest first. */
export function periodWindows(now: Date, days: number): { readonly current: readonly string[]; readonly previous: readonly string[] } {
  const all = lastDays(now, days * 2);
  return { previous: all.slice(0, days), current: all.slice(days) };
}

/** Monday = 0 ... Sunday = 6, for a calendar day. */
export function weekdayIndex(date: string): number {
  const sunday0 = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (sunday0 + 6) % 7;
}

/** The calendar day as a UTC Date at midnight, for month/day formatting with the bundle's own names. */
export function dayAsDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/**
 * The calendar weeks (Monday to Sunday) that contain the last `weeks` weeks of
 * days ending today, oldest first. A day after today is `null`: it has no count
 * yet, which is different from a count of zero.
 */
export function weekRows(now: Date, weeks: number): readonly { readonly start: string; readonly days: readonly (string | null)[] }[] {
  const today = kigaliDate(now);
  const thisMonday = addDays(today, -weekdayIndex(today));
  return Array.from({ length: Math.max(1, weeks) }, (_, w) => {
    const start = addDays(thisMonday, (w - (weeks - 1)) * 7);
    return { start, days: Array.from({ length: 7 }, (_, d) => { const day = addDays(start, d); return day > today ? null : day; }) };
  });
}

/** `part / whole` in 0..1, or null for an empty whole ("0% of nothing" is not a percentage). */
export function ratio(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.min(1, Math.max(0, part / whole));
}

/** A campaign whose closed share (rejected or withdrawn) is at or above this is flagged "watch". */
export const CLOSED_SHARE_WATCH = 0.5;

/** The search for one pipeline stage, optionally narrowed. `limit: 1` because only `total` is read. */
export function stageQuery(stage: PipelineStageId, narrow: Pick<ApplicationSearchQuery, "campaign" | "category" | "district" | "submittedFrom" | "submittedTo"> = {}): ApplicationSearchQuery {
  const statuses = PIPELINE_STAGES.find((s) => s.id === stage)?.statuses ?? [];
  return { status: statuses, limit: 1, ...narrow };
}

/** The search for every application submitted on one calendar day. */
export function dayQuery(date: string, narrow: Pick<ApplicationSearchQuery, "campaign" | "category"> = {}): ApplicationSearchQuery {
  return { limit: 1, submittedFrom: date, submittedTo: date, ...narrow };
}

/** One stage's count per row of a `rows x stages` matrix, given the flat totals in query order. */
export function toMatrix(totals: readonly number[], rowCount: number): readonly (readonly number[])[] {
  const width = PIPELINE_STAGES.length;
  return Array.from({ length: rowCount }, (_, r) => PIPELINE_STAGES.map((_, s) => totals[r * width + s] ?? 0));
}

/** The sum of one row. */
export const rowSum = (row: readonly number[]): number => row.reduce((s, v) => s + v, 0);

/** Whole days between an ISO instant and `now`, floored and never negative; null for an unusable instant. */
export function ageInDays(queuedAt: string | null, now: Date): number | null {
  if (queuedAt === null) return null;
  const at = Date.parse(queuedAt);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.floor((now.getTime() - at) / DAY_MS));
}
