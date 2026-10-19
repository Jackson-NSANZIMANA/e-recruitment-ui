import { describe, expect, it } from 'vitest';
import { canonicalJson, digestOf } from '../src/canonical.ts';
import { envelopeProblems, signingInput } from '../src/envelope.ts';
import { createLedger } from '../src/ledger.ts';
import { createWebCryptoSigner, ed25519Supported, generateDeviceKey, verifySignature } from '../src/signer.ts';
import { DuplicateRecordError, createMemoryStorage } from '../src/storage.ts';
import { uuidv7, uuidv7Time } from '../src/uuidv7.ts';

const fixedRandom = (bytes: Uint8Array): Uint8Array => bytes.fill(0xab);
const DRAFT = {
  kind: 'physical-score',
  schemaVersion: 1,
  subject: { applicationId: 'a3f1c2d4-5b6e-4f70-8192-0a1b2c3d4e5f' },
  context: { campaignCode: 'RDF-2027-A', policyHash: 'p'.repeat(64), venue: 'Gasabo', examDay: '2027-03-01', station: 'physical', officerSubject: 'off-221' },
  payload: { heightCm: 176, run3kmTimeSeconds: 742 },
};

describe('canonical form and ids', () => {
  it('canonical JSON ignores key order and refuses non-finite numbers', () => {
    expect(canonicalJson({ b: 1, a: [true, null, 'x'] })).toBe(canonicalJson({ a: [true, null, 'x'], b: 1 }));
    expect(() => canonicalJson({ x: Number.NaN })).toThrow();
  });

  it('UUIDv7 carries its timestamp, version and variant', () => {
    const id = uuidv7(1_790_000_000_000, fixedRandom);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidv7Time(id)).toBe(1_790_000_000_000);
    expect(uuidv7(1, fixedRandom) < uuidv7(2, fixedRandom)).toBe(true);
  });
});

describe('the signer', () => {
  it('uses a non-extractable Ed25519 key and its signatures verify', async () => {
    expect(await ed25519Supported()).toBe(true);
    const pair = await generateDeviceKey();
    expect(pair.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('pkcs8', pair.privateKey)).rejects.toThrow();
    const signer = createWebCryptoSigner(pair, 'key-1');
    const data = new TextEncoder().encode('record');
    const signature = await signer.sign(data);
    expect(await verifySignature(await signer.publicKey(), data, signature)).toBe(true);
    expect(await verifySignature(await signer.publicKey(), new TextEncoder().encode('tampered'), signature)).toBe(false);
  });
});

describe('the ledger', () => {
  const make = async (offlineQueue = false) => {
    const storage = createMemoryStorage();
    const signer = createWebCryptoSigner(await generateDeviceKey(), 'key-1');
    let t = Date.parse('2027-03-01T06:30:00.000Z');
    const ledger = createLedger({
      storage,
      signer,
      deviceId: 'tab-014',
      clock: { now: () => new Date((t += 1000)), timeZone: 'Africa/Kigali', confidence: () => 'SYNCED' },
      policy: { offlineQueue },
      random: fixedRandom,
    });
    return { ledger, storage, signer };
  };

  it('writes locally first, signed, with a digest and a per-device sequence', async () => {
    const { ledger, signer } = await make();
    const first = await ledger.append(DRAFT);
    const second = await ledger.append({ ...DRAFT, supersedes: first.envelope.recordId });
    expect(first.state).toBe('LOCAL_ONLY');
    expect([first.envelope.localSequence, second.envelope.localSequence]).toEqual([1, 2]);
    expect(first.envelope.payloadDigest).toBe(await digestOf(DRAFT.payload));
    expect(envelopeProblems(first.envelope)).toEqual([]);
    const signed = new TextEncoder().encode(canonicalJson(signingInput(first.envelope)));
    expect(await verifySignature(await signer.publicKey(), signed, first.envelope.signature)).toBe(true);
    expect(second.envelope.supersedes).toBe(first.envelope.recordId);
  });

  it('a stored record is never overwritten', async () => {
    const { ledger, storage } = await make();
    const record = await ledger.append(DRAFT);
    await expect(storage.put(record)).rejects.toBeInstanceOf(DuplicateRecordError);
  });

  it('moves only through the state machine, and pilot mode refuses the offline queue', async () => {
    const { ledger, storage } = await make(false);
    const { envelope } = await ledger.append(DRAFT);
    expect((await ledger.apply(envelope.recordId, { type: 'ENQUEUE' })).ok).toBe(false);
    expect((await storage.get(envelope.recordId))?.state).toBe('LOCAL_ONLY');
    await ledger.apply(envelope.recordId, { type: 'SEND' });
    await ledger.apply(envelope.recordId, { type: 'ACK', outcome: 'REJECTED_VALIDATION', reason: 'BAD_SIGNATURE' });
    const stored = await storage.get(envelope.recordId);
    expect(stored?.state).toBe('REJECTED_VALIDATION');
    expect(stored?.reason).toBe('BAD_SIGNATURE');
  });

  it('flags a structurally invalid envelope', () => {
    expect(envelopeProblems({ recordId: 'x', supersedes: 'x', kind: '', schemaVersion: 0, localSequence: 0, capturedAt: 'nope' } as never)).toEqual(
      expect.arrayContaining(['kind is required', 'schemaVersion must be a positive integer', 'a record cannot supersede itself']),
    );
  });
});
