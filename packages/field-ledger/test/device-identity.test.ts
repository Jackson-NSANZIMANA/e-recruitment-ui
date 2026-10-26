import { describe, expect, it } from 'vitest';
import { createMemoryIdentityStore, keyIdOf, loadOrCreateIdentity, markEnrolled, newDeviceId, publicKeySpkiPem } from '../src/device-identity.ts';
import { sha256Hex, toBase64 } from '../src/canonical.ts';

describe('device identity', () => {
  it('creates one non-extractable identity and keeps it', async () => {
    const store = createMemoryIdentityStore();
    const a = await loadOrCreateIdentity(store);
    const b = await loadOrCreateIdentity(store);
    expect(b.deviceId).toBe(a.deviceId);
    expect(a.pair.privateKey.extractable).toBe(false);
    expect(a.enrolledAt).toBeNull();
    expect(a.deviceId).toMatch(/^fs-[0-9a-f]{16}$/);
    expect(a.keyId).toMatch(/^[0-9a-f]{64}$/);
    expect(await keyIdOf(a.pair)).toBe(a.keyId);
  });

  it('exports only an SPKI PEM public key', async () => {
    const identity = await loadOrCreateIdentity(createMemoryIdentityStore());
    const pem = await publicKeySpkiPem(identity.pair);
    expect(pem).toMatch(/^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=\n]+-----END PUBLIC KEY-----\n$/);
    await expect(crypto.subtle.exportKey('pkcs8', identity.pair.privateKey)).rejects.toThrow();
  });

  it('records enrolment only when told the server answered', async () => {
    const store = createMemoryIdentityStore();
    const a = await loadOrCreateIdentity(store);
    const b = await markEnrolled(store, a, 'RDF', () => new Date('2026-10-26T08:00:00Z'));
    expect(b.enrolledAt).toBe('2026-10-26T08:00:00.000Z');
    expect((await loadOrCreateIdentity(store)).enrolledAgency).toBe('RDF');
  });

  it('helpers', async () => {
    expect(newDeviceId((b) => b.fill(1))).toBe('fs-0101010101010101');
    expect(toBase64(new Uint8Array([1, 2, 3]))).toBe('AQID');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
