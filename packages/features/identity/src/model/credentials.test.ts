import { describe, expect, it } from 'vitest';
import {
  CREDENTIAL_KINDS,
  NON_PERSISTABLE_KEYS,
  credentialKindFor401,
  isExpired,
  shouldWarnExpiry,
} from './credentials.js';
import { FORBIDDEN_OTP_PHRASES, otpChallengeMessageKey } from './no-enumeration.js';

describe('identity model', () => {
  it('keeps credential kinds and persistence boundaries explicit', () => {
    expect(CREDENTIAL_KINDS).toEqual(['officer-jwt', 'applicant-session']);
    expect(NON_PERSISTABLE_KEYS).toContain('nationalId');
    expect(credentialKindFor401('INVALID_SESSION')).toBe('applicant-session');
    expect(credentialKindFor401('UNAUTHENTICATED')).toBe('officer-jwt');
    expect(credentialKindFor401('OTHER')).toBeNull();
  });

  it('handles expiry and the uniform OTP message', () => {
    const now = new Date('2026-09-08T00:00:00.000Z');
    const soon = { token: 'x', expiresAt: '2026-09-08T00:02:00.000Z' };
    expect(isExpired(soon, now)).toBe(false);
    expect(shouldWarnExpiry(soon, now)).toBe(true);
    expect(otpChallengeMessageKey()).toBe('identity.otp.challenged_uniform');
    expect(FORBIDDEN_OTP_PHRASES).toContain('not found');
  });
});
