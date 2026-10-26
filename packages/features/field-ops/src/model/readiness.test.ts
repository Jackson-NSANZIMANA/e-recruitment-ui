import { describe, expect, it } from 'vitest';
import { clockConfidenceOf, clockSkewFromDate, evaluateReadiness, type ReadinessProbes } from './readiness.ts';
import { venueDayProblems } from './venue.ts';

const good: ReadinessProbes = { ed25519: true, persisted: true, quotaBytes: 1e9, usageBytes: 1e6, clockSkewMs: 500, enrolled: true, venueDayConfirmed: true, trustAnchorCached: true };
const status = (p: Partial<ReadinessProbes>, id: string) => evaluateReadiness({ ...good, ...p }).checks.find((c) => c.id === id)?.status;

describe('device readiness', () => {
  it('a healthy device is not blocked', () => expect(evaluateReadiness(good).blocked).toBe(false));
  it.each([
    [{ ed25519: false }, 'ed25519'], [{ enrolled: false }, 'enrolment'], [{ venueDayConfirmed: false }, 'venue_day'],
    [{ quotaBytes: 40e6, usageBytes: 1e6 }, 'quota'], [{ clockSkewMs: -11 * 60_000 }, 'clock'],
  ] as const)('%j blocks the stations (%s)', (p, id) => {
    expect(status(p, id)).toBe('fail');
    expect(evaluateReadiness({ ...good, ...p }).blocked).toBe(true);
  });
  it.each([[{ persisted: false }, 'persisted'], [{ trustAnchorCached: false }, 'trust_anchor'], [{ clockSkewMs: null }, 'clock'], [{ clockSkewMs: 3 * 60_000 }, 'clock'], [{ quotaBytes: null }, 'quota']] as const)('%j only warns (%s)', (p, id) => {
    expect(status(p, id)).toBe('warn');
    expect(evaluateReadiness({ ...good, ...p }).blocked).toBe(false);
  });
  it('measures skew from the edge Date header', () => {
    expect(clockSkewFromDate('Mon, 26 Oct 2026 08:00:00 GMT', new Date('2026-10-26T08:00:05Z'))).toBe(5000);
    expect(clockSkewFromDate(null, new Date())).toBeNull();
    expect(clockSkewFromDate('garbage', new Date())).toBeNull();
    expect(clockConfidenceOf(null)).toBe('UNKNOWN');
    expect(clockConfidenceOf(1000)).toBe('SYNCED');
    expect(clockConfidenceOf(-300_000)).toBe('SKEWED');
  });
  it('validates a typed venue day', () => {
    expect(venueDayProblems({ campaign: 'REH-RDF-20261019', district: 'Gasabo', examDate: '2026-10-19' })).toEqual([]);
    expect(venueDayProblems({ campaign: ' ', district: 'x', examDate: '19/10/2026' })).toEqual(['campaign', 'district', 'examDate']);
  });
});
