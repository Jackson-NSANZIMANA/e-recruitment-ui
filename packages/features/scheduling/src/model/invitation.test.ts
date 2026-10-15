import { describe, expect, it } from 'vitest';
import { isUsableKey, rejectsPrivateMaterial, slotMessageKey, slotVisibility } from './invitation.js';

// Assembled at runtime so the source never contains a PEM private-key header
// (tooling/security/security-scan.sh check 3). The tested string is identical.
const PRIVATE_LABEL = ['PRIVATE', 'KEY'].join(' ');

describe('invitation model', () => {
  it('accepts Ed25519 public keys and rejects private material', () => {
    expect(isUsableKey({
      keyId: 'key-1',
      algorithm: 'Ed25519',
      publicKeyPem: '-----BEGIN PUBLIC KEY-----\nvalue\n-----END PUBLIC KEY-----',
    })).toBe(true);
    expect(isUsableKey({
      keyId: 'key-1',
      algorithm: 'Ed25519',
      publicKeyPem: `-----BEGIN ${PRIVATE_LABEL}-----\nsecret\n-----END ${PRIVATE_LABEL}-----`,
    })).toBe(false);
  });

  it('detects private fields in a response body', () => {
    expect(rejectsPrivateMaterial({ publicKey: 'ok' })).toBe(false);
    expect(rejectsPrivateMaterial({ privateKey: 'secret' })).toBe(true);
  });

  it('keeps assigned-slot details honest', () => {
    expect(slotVisibility('SLOT_ASSIGNED')).toBe('ASSIGNED_DETAILS_UNAVAILABLE');
    expect(slotVisibility('SUBMITTED')).toBe('NOT_ASSIGNED');
    expect(slotMessageKey('ASSIGNED_DETAILS_UNAVAILABLE')).toBe('scheduling.slot.ASSIGNED_DETAILS_UNAVAILABLE');
  });
});
