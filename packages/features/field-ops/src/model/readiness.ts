// ══════════════════════════════════════════════════════════════════
// field-ops — device readiness (S08, kit item 1). PURE.
//
// Each check is ok / warn / fail. A FAIL blocks every station and points to
// the paper fallback. A WARN is shown and does not block.
//
//   ed25519      fail  signing is impossible without it (ADR-FE-016)
//   persisted    warn  online-first: a record is sent at once, so eviction risk is
//                      bounded to the gap between capture and acknowledgement
//   quota        fail  under 50 MB free: the ledger could not append
//   clock        fail  skew over 10 min (capture times cannot be trusted)
//                warn  skew over 2 min, or not measured
//   enrolment    fail  not enrolled: nothing signed would be accepted
//   venue day    fail  not confirmed: every record needs its venue and day
//   trust anchor warn  no scheduling key cached: the offline signature rung is unavailable
// ══════════════════════════════════════════════════════════════════

export type CheckStatus = 'ok' | 'warn' | 'fail';
export const CHECK_IDS = ['ed25519', 'persisted', 'quota', 'clock', 'enrolment', 'venue_day', 'trust_anchor'] as const;
export type CheckId = (typeof CHECK_IDS)[number];

export interface ReadinessProbes {
  readonly ed25519: boolean;
  readonly persisted: boolean;
  readonly quotaBytes: number | null;
  readonly usageBytes: number | null;
  /** Device clock minus the edge `Date` header, in ms; null when not measured. */
  readonly clockSkewMs: number | null;
  readonly enrolled: boolean;
  readonly venueDayConfirmed: boolean;
  readonly trustAnchorCached: boolean;
}

export interface ReadinessCheck { readonly id: CheckId; readonly status: CheckStatus; readonly value?: string }
export interface Readiness { readonly checks: readonly ReadinessCheck[]; readonly blocked: boolean }

export const MIN_FREE_BYTES = 50 * 1024 * 1024;
export const SKEW_WARN_MS = 2 * 60_000;
export const SKEW_FAIL_MS = 10 * 60_000;

/** Skew from an edge `Date` header; null when absent or unparsable. */
export function clockSkewFromDate(headerDate: string | null, deviceNow: Date): number | null {
  if (headerDate === null) return null;
  const server = Date.parse(headerDate);
  return Number.isNaN(server) ? null : deviceNow.getTime() - server;
}

export function evaluateReadiness(p: ReadinessProbes): Readiness {
  const free = p.quotaBytes === null || p.usageBytes === null ? null : p.quotaBytes - p.usageBytes;
  const skew = p.clockSkewMs === null ? null : Math.abs(p.clockSkewMs);
  const checks: ReadinessCheck[] = [
    { id: 'ed25519', status: p.ed25519 ? 'ok' : 'fail' },
    { id: 'persisted', status: p.persisted ? 'ok' : 'warn' },
    { id: 'quota', status: free === null ? 'warn' : free >= MIN_FREE_BYTES ? 'ok' : 'fail', ...(free === null ? {} : { value: `${String(Math.round(free / (1024 * 1024)))} MB` }) },
    { id: 'clock', status: skew === null ? 'warn' : skew > SKEW_FAIL_MS ? 'fail' : skew > SKEW_WARN_MS ? 'warn' : 'ok', ...(skew === null ? {} : { value: `${String(Math.round(skew / 1000))} s` }) },
    { id: 'enrolment', status: p.enrolled ? 'ok' : 'fail' },
    { id: 'venue_day', status: p.venueDayConfirmed ? 'ok' : 'fail' },
    { id: 'trust_anchor', status: p.trustAnchorCached ? 'ok' : 'warn' },
  ];
  return { checks, blocked: checks.some((c) => c.status === 'fail') };
}

/** The clock confidence a ledger record carries (envelope.clockConfidence). */
export function clockConfidenceOf(skewMs: number | null): 'SYNCED' | 'SKEWED' | 'UNKNOWN' {
  if (skewMs === null) return 'UNKNOWN';
  return Math.abs(skewMs) > SKEW_WARN_MS ? 'SKEWED' : 'SYNCED';
}
