import { describe, expect, it } from 'vitest';
import { addDays, ageInDays, dayQuery, kigaliDate, lastDays, periodWindows, ratio, rowSum, stageQuery, toMatrix, weekRows, weekdayIndex } from './model.js';

// 2026-11-04 is a Wednesday. 22:30 UTC is already 00:30 on the 5th in Kigali (UTC+2).
const WED = new Date('2026-11-04T10:00:00.000Z');
const LATE = new Date('2026-11-04T22:30:00.000Z');

describe('Kigali calendar days', () => {
  it('a late-evening UTC instant belongs to the next Kigali day', () => {
    expect(kigaliDate(WED)).toBe('2026-11-04');
    expect(kigaliDate(LATE)).toBe('2026-11-05');
  });
  it('addDays is pure date arithmetic across month and year ends', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('lastDays ends on today, oldest first, with exactly n days', () => {
    expect(lastDays(WED, 3)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
    expect(lastDays(WED, 0)).toHaveLength(1);
  });
  it('periodWindows splits 2n days into the previous and the current period, with no overlap or gap', () => {
    const w = periodWindows(WED, 7);
    expect(w.previous).toHaveLength(7);
    expect(w.current).toHaveLength(7);
    expect(w.current.at(-1)).toBe('2026-11-04');
    expect(addDays(w.previous.at(-1) as string, 1)).toBe(w.current[0]);
  });
});

describe('weeks', () => {
  it('Monday is 0 and Sunday is 6', () => {
    expect(weekdayIndex('2026-11-02')).toBe(0);
    expect(weekdayIndex('2026-11-04')).toBe(2);
    expect(weekdayIndex('2026-11-08')).toBe(6);
  });
  it('weekRows are Monday-to-Sunday calendar weeks, oldest first, and a day after today is null (not zero)', () => {
    const rows = weekRows(WED, 4);
    expect(rows).toHaveLength(4);
    expect(rows.at(-1)?.start).toBe('2026-11-02');
    expect(rows.at(-1)?.days).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', null, null, null, null]);
    expect(rows[0]?.start).toBe('2026-10-12');
    expect(rows[0]?.days.every((d) => d !== null)).toBe(true);
  });
});

describe('the searches the screens ask', () => {
  it('stageQuery asks for the stage\'s statuses and only the total', () => {
    const q = stageQuery('accepted', { campaign: 'RDF-1' });
    expect(q).toEqual({ status: ['ACCEPTED'], limit: 1, campaign: 'RDF-1' });
    expect(stageQuery('closed').status).toEqual(['REJECTED', 'WITHDRAWN']);
  });
  it('dayQuery asks for one inclusive calendar day', () => {
    expect(dayQuery('2026-11-04', { category: 'GENERAL_ENLISTMENT' })).toEqual({ limit: 1, submittedFrom: '2026-11-04', submittedTo: '2026-11-04', category: 'GENERAL_ENLISTMENT' });
  });
});

describe('shaping the answers', () => {
  it('toMatrix cuts the flat totals into rows of six stages, padding with zero, never reading across rows', () => {
    expect(toMatrix([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 2)).toEqual([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]]);
    expect(toMatrix([1, 2], 1)).toEqual([[1, 2, 0, 0, 0, 0]]);
    expect(rowSum([1, 2, 3])).toBe(6);
  });
  it('ratio refuses an empty whole and stays within 0..1', () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(9, 3)).toBe(1);
  });
  it('ageInDays floors, never goes negative, and refuses an unusable instant', () => {
    expect(ageInDays('2026-11-02T09:59:00.000Z', WED)).toBe(2);
    expect(ageInDays('2026-11-04T09:00:00.000Z', WED)).toBe(0);
    expect(ageInDays('2026-11-09T10:00:00.000Z', WED)).toBe(0);
    expect(ageInDays(null, WED)).toBeNull();
    expect(ageInDays('not a date', WED)).toBeNull();
  });
});
