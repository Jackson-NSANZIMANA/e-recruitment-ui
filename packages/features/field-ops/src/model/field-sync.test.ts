import { describe, expect, it } from 'vitest';
import {
  canonicalJson, createLedger, createMemoryIdentityStore, createMemoryStorage, createWebCryptoSigner, fromBase64Url, loadOrCreateIdentity, publicKeySpkiPem, sha256Hex, toBase64Url,
  type Ledger, type SignerPort,
} from '@usrp/field-ledger';
import type { FieldScoreWireRecord, FieldSyncAnswer } from '@usrp/api-client';
import { capturePhysical, stationActorId, fateOf, isServerAcknowledged, recoverInterrupted, sendRecords, summarise, toWireRecord } from './field-sync.ts';
import { readPhysicalForm } from './physical.ts';

const APP = 'a3f1c2d4-5b6e-4f70-8192-0a1b2c3d4e5f';
const TICKET = { applicationId: APP, ticketId: 'TKT-1', venueName: 'Nyagatare Stadium', examDate: '2027-06-06', agency: 'RDF' };
const DAY = { campaign: 'RDF-2026', district: 'Nyagatare', examDate: '2027-06-06', venueName: 'Nyagatare Stadium' };
const metrics = readPhysicalForm({ heightCm: '178', weightKg: '72', chestCm: '96', run3kmTimeSeconds: '720', remeasureReason: '' }).metrics!;

async function rig(): Promise<{ ledger: Ledger; signer: SignerPort; spki: string; deviceId: string }> {
  const identity = await loadOrCreateIdentity(createMemoryIdentityStore());
  const signer = createWebCryptoSigner(identity.pair, identity.keyId);
  const ledger = createLedger({
    storage: createMemoryStorage(), signer, deviceId: identity.deviceId,
    clock: { now: () => new Date('2027-06-06T08:00:00Z'), timeZone: 'Africa/Kigali', confidence: () => 'SYNCED' },
    policy: { offlineQueue: false },
  });
  return { ledger, signer, spki: await publicKeySpkiPem(identity.pair), deviceId: identity.deviceId };
}
const cap = (ledger: Ledger) => capturePhysical(ledger, { ticket: TICKET, metrics, day: DAY, officerSubject: '0190a000-0000-4000-8000-0000000000aa' });
const answer = (status: string, extra: Record<string, unknown> = {}) => async (records: readonly FieldScoreWireRecord[]): Promise<FieldSyncAnswer> => ({
  httpStatus: 200,
  body: { status: 'SYNCED', results: records.map((r) => ({ applicationId: r.applicationId, deviceId: r.deviceId, status, ...extra })) },
});

describe('physical capture is local first and never claimed synced without an acknowledgement', () => {
  it('a capture starts LOCAL_ONLY and signed; an ACCEPTED answer acknowledges it', async () => {
    const { ledger, signer } = await rig();
    const record = await cap(ledger);
    expect(record.state).toBe('LOCAL_ONLY');
    expect(record.envelope.signature).toMatch(/^[A-Za-z0-9_-]{86}$/);
    const [result] = await sendRecords(ledger, signer, answer('ACCEPTED', { scoreId: 's-1' }), [record]);
    expect(result?.state).toBe('ACCEPTED');
    expect(isServerAcknowledged('ACCEPTED')).toBe(true);
    expect((await ledger.list())[0]?.scoreId).toBe('s-1');
  });

  it('no answer (network drop) leaves it LOCAL_ONLY: waiting, not synced', async () => {
    const { ledger, signer } = await rig();
    const record = await cap(ledger);
    const [result] = await sendRecords(ledger, signer, async () => ({ httpStatus: null, body: null }), [record]);
    expect(result?.state).toBe('LOCAL_ONLY');
    expect(fateOf(result!.state)).toBe('WAITING');
    expect(isServerAcknowledged(result!.state)).toBe(false);
  });

  it.each([
    [{ httpStatus: 200, body: { status: 'SYNCED' } }],
    [{ httpStatus: 200, body: {} }],
    [{ httpStatus: 502, body: null }],
    [{ httpStatus: 200, body: { status: 'SYNCED', results: [] } }],
  ])('an HTTP answer without a matching per-record result is not an acknowledgement (%j)', async (reply) => {
    const { ledger, signer } = await rig();
    const record = await cap(ledger);
    const [result] = await sendRecords(ledger, signer, async () => reply, [record]);
    expect(result?.state).toBe('LOCAL_ONLY');
  });

  it.each([
    ['ACCEPTED', 'ACCEPTED'], ['SUPERSEDED', 'ACCEPTED'], ['DUPLICATE', 'DUPLICATE_REPLAY'],
    ['CONFLICT', 'STALE_CONFLICT'], ['STALE', 'STALE_CONFLICT'], ['NOT_FOUND', 'REJECTED_VALIDATION'], ['REJECTED', 'REJECTED_VALIDATION'],
  ])('maps the real result %s to %s', async (status, state) => {
    const { ledger, signer } = await rig();
    const record = await cap(ledger);
    const [result] = await sendRecords(ledger, signer, answer(status, status === 'REJECTED' ? { reason: 'NOT_ADMITTED' } : {}), [record]);
    expect(result?.state).toBe(state);
  });

  it('a whole-batch 400 refuses the record', async () => {
    const { ledger, signer } = await rig();
    const record = await cap(ledger);
    const [result] = await sendRecords(ledger, signer, async () => ({ httpStatus: 400, body: { error: 'INVALID_RECORD' } }), [record]);
    expect(result).toMatchObject({ state: 'REJECTED_VALIDATION', reason: 'INVALID_RECORD' });
  });

  it('a record is sent once: an acknowledged one is not sent again', async () => {
    const { ledger, signer } = await rig();
    const record = await cap(ledger);
    let calls = 0;
    const send = async (r: readonly FieldScoreWireRecord[]): Promise<FieldSyncAnswer> => { calls += 1; return answer('ACCEPTED')(r); };
    await sendRecords(ledger, signer, send, [record]);
    await sendRecords(ledger, signer, send, await ledger.list());
    expect(calls).toBe(1);
  });

  it('a record left SENDING by a crash returns to waiting', async () => {
    const { ledger } = await rig();
    const record = await cap(ledger);
    await ledger.apply(record.envelope.recordId, { type: 'SEND' });
    expect(await recoverInterrupted(ledger)).toBe(1);
    expect((await ledger.list())[0]?.state).toBe('LOCAL_ONLY');
  });

  it('summarises honestly', async () => {
    const { ledger, signer } = await rig();
    const a = await cap(ledger); await cap(ledger);
    await sendRecords(ledger, signer, answer('ACCEPTED'), [a]);
    expect(summarise(await ledger.list())).toMatchObject({ total: 2, acknowledged: 1, waiting: 1, refused: 0, conflicts: 0 });
  });
});

describe('the wire record matches what the backend verifies (shared-security verifyFieldScoreRecord)', () => {
  it('signs canonicalJson of the seven signable fields with the device key, standard base64, plus sha256-hex of the metrics', async () => {
    const { ledger, signer, spki, deviceId } = await rig();
    const wire = await toWireRecord(await cap(ledger), signer);
    expect(wire.deviceSignature).toMatch(/^[A-Za-z0-9+/]{86}==$/);
    expect(wire.vectorClock).toEqual({ [deviceId]: 1 });
    expect(wire.capturingOfficerId).toBe('0190a000-0000-4000-8000-0000000000aa');
    expect(wire.signedPayloadHash).toBe(await sha256Hex(canonicalJson(wire.metrics)));
    const { deviceSignature: _s, signedPayloadHash: _h, ...signable } = wire;
    const der = fromBase64Url(spki.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    const key = await crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']);
    const signature = Uint8Array.from(atob(wire.deviceSignature), (c) => c.charCodeAt(0));
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, new TextEncoder().encode(canonicalJson(signable)))).toBe(true);
    expect(toBase64Url(signature)).not.toContain('=');
  });
});

describe('stationActorId', () => {
  const memory = (): Pick<Storage, 'getItem' | 'setItem'> & { map: Map<string, string> } => {
    const map = new Map<string, string>();
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); } };
  };
  it('is a UUID, created once and then kept for the tablet', () => {
    const storage = memory();
    const first = stationActorId(storage, () => '0190a000-0000-4000-8000-00000000a001');
    expect(first).toBe('0190a000-0000-4000-8000-00000000a001');
    expect(stationActorId(storage, () => '0190a000-0000-4000-8000-00000000ffff')).toBe(first);
  });
  it('replaces a kept value that is not a UUID, and survives a refusing storage', () => {
    const storage = memory();
    storage.map.set('usrp_field_station_actor', 'RDF:screening_officer');
    expect(stationActorId(storage, () => '0190a000-0000-4000-8000-00000000a002')).toBe('0190a000-0000-4000-8000-00000000a002');
    expect(stationActorId({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } }, () => '0190a000-0000-4000-8000-00000000a003')).toBe('0190a000-0000-4000-8000-00000000a003');
  });
});

describe('a capture whose officer id is not a UUID', () => {
  it('is refused on the device as NOT_SENDABLE and never sent (the service would answer 500)', async () => {
    const { ledger, signer } = await rig();
    const record = await capturePhysical(ledger, { ticket: TICKET, metrics, day: DAY, officerSubject: 'RDF:screening_officer' });
    let calls = 0;
    const results = await sendRecords(ledger, signer, () => { calls += 1; return Promise.resolve({ httpStatus: 200, body: null }); }, [record]);
    expect(calls).toBe(0);
    expect(results[0]).toMatchObject({ state: 'REJECTED_VALIDATION', reason: 'NOT_SENDABLE' });
  });
});
