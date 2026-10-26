import { describe, expect, it } from 'vitest';
import { canonicalJson, toBase64, toBase64Url } from '../src/canonical.ts';
import { anchorFromBase64, readSlotClaims, verifySlotToken, type SlotClaims, type TrustAnchor } from '../src/slot-token.ts';
import { publicKeySpkiPem } from '../src/device-identity.ts';

const CLAIMS: SlotClaims = {
  v: 1, keyId: 'qr-2026', ticketId: 'TKT-1', applicationId: 'a3f1c2d4-5b6e-4f70-8192-0a1b2c3d4e5f', applicantId: 'ap-1', agency: 'RDF',
  campaignId: 'c-1', slotId: 's-1', venueName: 'Nyagatare Stadium', examDate: '2027-06-06', reportingTimeHour: 7,
  issuedAt: '2027-05-01T00:00:00.000Z', expiresAt: '2027-06-08T00:00:00.000Z',
};

async function mint(claims: SlotClaims = CLAIMS): Promise<{ token: string; anchor: TrustAnchor }> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const payload = toBase64Url(new TextEncoder().encode(canonicalJson(claims)));
  const input = `USRP-SLOT.v1.${payload}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, pair.privateKey, new TextEncoder().encode(input)));
  return { token: `${input}.${toBase64Url(sig)}`, anchor: { keyId: null, publicKeyPem: await publicKeySpkiPem(pair) } };
}
const DAY = new Date('2027-06-06T06:00:00Z');

describe('offline slot verification (cannot spend, only show)', () => {
  it('accepts a genuine pass and reports venue and day', async () => {
    const { token, anchor } = await mint();
    const verdict = await verifySlotToken(token, [anchor], DAY);
    expect(verdict.valid).toBe(true);
    expect(verdict.valid && verdict.claims.venueName).toBe('Nyagatare Stadium');
  });
  it('rejects a tampered claim, a foreign key, an expiry, garbage and a missing anchor', async () => {
    const { token, anchor } = await mint();
    const other = await mint();
    const forged = token.split('.'); forged[2] = toBase64Url(new TextEncoder().encode(canonicalJson({ ...CLAIMS, venueName: 'Elsewhere' })));
    expect((await verifySlotToken(forged.join('.'), [anchor], DAY))).toMatchObject({ valid: false, reason: 'BAD_SIGNATURE' });
    expect((await verifySlotToken(token, [other.anchor], DAY))).toMatchObject({ valid: false, reason: 'BAD_SIGNATURE' });
    expect((await verifySlotToken(token, [anchor], new Date('2027-07-01T00:00:00Z')))).toMatchObject({ valid: false, reason: 'EXPIRED' });
    expect((await verifySlotToken('nonsense', [anchor], DAY))).toMatchObject({ valid: false, reason: 'MALFORMED' });
    expect((await verifySlotToken(token, [], DAY))).toMatchObject({ valid: false, reason: 'NO_TRUST_ANCHOR' });
    expect((await verifySlotToken(token, [{ keyId: 'other', publicKeyPem: anchor.publicKeyPem }], DAY))).toMatchObject({ reason: 'NO_TRUST_ANCHOR' });
  });
  it('reads claims without trusting them', async () => {
    const { token } = await mint();
    expect(readSlotClaims(token)?.ticketId).toBe('TKT-1');
    expect(readSlotClaims('USRP-SLOT.v1.e30.x')).toBeNull();
  });
  it('takes the installed key as base64 of a PEM and refuses private material', async () => {
    const { anchor } = await mint();
    expect(anchorFromBase64(btoa(anchor.publicKeyPem))?.publicKeyPem).toBe(anchor.publicKeyPem);
    expect(anchorFromBase64(btoa(['-----BEGIN', 'PRIVATE KEY-----'].join(' ')))).toBeNull();
    expect(anchorFromBase64('%%%')).toBeNull();
    expect(toBase64(new Uint8Array([255]))).toBe('/w==');
  });
});
