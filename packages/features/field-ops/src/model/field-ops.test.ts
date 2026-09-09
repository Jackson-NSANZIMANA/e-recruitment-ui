import { describe, expect, it } from 'vitest';
import { checkInVerdict, forbiddenVerdict, invalidInvitationKey } from './biometric.js';
import { compareClocks, requiresHumanResolution, validateResolution } from './conflict.js';
import { summarizeSync } from './sync-result.js';

describe('field ops model', () => {
  it('keeps biometric verdicts and invitation errors explicit', () => {
    expect(checkInVerdict({ status: 'EVALUATED', verified: true, sessionId: 's', applicantId: 'a', livenessPass: true, faceMatchPass: true })).toBe('ADMIT');
    expect(checkInVerdict({ status: 'EVALUATED', verified: false, sessionId: 's', applicantId: 'a', livenessPass: false, faceMatchPass: false })).toBe('REFUSE');
    expect(forbiddenVerdict({ status: 'AGENCY_MISMATCH' })).toBe('WRONG_AGENCY');
    expect(invalidInvitationKey()).toBe('field_ops.biometric.invalid_invitation');
  });

  it('requires human review only for concurrent clocks', () => {
    expect(compareClocks({ a: 1 }, { a: 2 })).toBe('BEFORE');
    expect(compareClocks({ a: 2, b: 1 }, { a: 1, c: 2 })).toBe('CONCURRENT');
    expect(requiresHumanResolution({ a: 2, b: 1 }, { a: 1, c: 2 })).toBe(true);
    expect(validateResolution('  ')).toEqual({ ok: false, length: 0 });
    expect(validateResolution('resolved')).toEqual({ ok: true, length: 8 });
  });

  it('does not claim full success for partial syncs', () => {
    expect(summarizeSync({ status: 'SYNCED', results: [] }).verdict).toBe('EMPTY');
    expect(summarizeSync({ status: 'SYNCED', results: [{ applicationId: 'a', outcome: 'ACCEPTED' }, { applicationId: 'b', outcome: 'REJECTED' }] })).toMatchObject({ verdict: 'PARTIALLY_SAVED', accepted: 1, rejected: 1, safeToShowSuccess: false });
  });
});
