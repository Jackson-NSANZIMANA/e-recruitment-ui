import { describe, expect, it } from 'vitest';
import {
  DECLINE_NOTE_MAX,
  hasForbiddenIdentity,
  validateDecline,
} from './erasure.js';

describe('erasure model', () => {
  it('requires a non-empty decline ground and trims it', () => {
    expect(validateDecline('   ')).toEqual({ ok: false, reason: 'NOTE_REQUIRED' });
    expect(validateDecline('  active application  ')).toEqual({
      ok: true,
      note: 'active application',
    });
  });

  it('rejects grounds longer than the wire limit', () => {
    expect(validateDecline('x'.repeat(DECLINE_NOTE_MAX + 1))).toEqual({
      ok: false,
      reason: 'NOTE_TOO_LONG',
    });
  });

  it('detects identity fields in a queue row', () => {
    expect(hasForbiddenIdentity({ requestId: 'r-1', applicantId: 'a-1' })).toBe(false);
    expect(hasForbiddenIdentity({ requestId: 'r-1', nationalId: 'hidden' })).toBe(true);
    expect(hasForbiddenIdentity({ requestId: 'r-1', phone: 'hidden' })).toBe(true);
  });
});
