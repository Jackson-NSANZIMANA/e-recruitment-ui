// ══════════════════════════════════════════════════════════════════
// The device identity (ADR-FE-016): one non-extractable Ed25519 key pair, its
// device id and key id, kept across reloads.
//
// IndexedDB stores a CryptoKey by structured clone and keeps it non-extractable,
// so the private key is never readable by any script, ours included. Only the
// public key leaves the device (SPKI PEM at enrolment). The id of the key is the
// SHA-256 hex of the SPKI DER (ADR-037 §4, the same keyId B2 will sign evidence
// with). `enrolledAt` is set only after the server answered the enrolment.
// ══════════════════════════════════════════════════════════════════

import { toBase64, sha256Hex } from './canonical.ts';
import { generateDeviceKey } from './signer.ts';

export interface DeviceIdentity {
  readonly deviceId: string;
  readonly keyId: string;
  readonly pair: CryptoKeyPair;
  readonly createdAt: string;
  /** Set only when the server acknowledged the enrolment. */
  readonly enrolledAt: string | null;
  /** The agency that enrolled it, from the server's answer. */
  readonly enrolledAgency: string | null;
}

export interface IdentityStore {
  load(): Promise<DeviceIdentity | null>;
  save(identity: DeviceIdentity): Promise<void>;
}

export function createMemoryIdentityStore(): IdentityStore {
  let current: DeviceIdentity | null = null;
  return { load: async () => current, save: async (identity) => { current = identity; } };
}

const IDENTITY_STORE = 'identity';
const IDENTITY_KEY = 'device';

export function createIndexedDbIdentityStore(options: { readonly dbName?: string; readonly indexedDB?: IDBFactory } = {}): IdentityStore {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  const name = options.dbName ?? 'usrp-field-device';
  let opening: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> => {
    opening ??= new Promise((resolve, reject) => {
      const open = factory.open(name, 1);
      open.onupgradeneeded = () => { open.result.createObjectStore(IDENTITY_STORE); };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'));
    });
    return opening;
  };
  const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const store = (await db()).transaction(IDENTITY_STORE, mode).objectStore(IDENTITY_STORE);
    const req = work(store);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  };
  return {
    load: async () => ((await run('readonly', (s) => s.get(IDENTITY_KEY))) as DeviceIdentity | undefined) ?? null,
    save: async (identity) => { await run('readwrite', (s) => s.put(identity, IDENTITY_KEY)); },
  };
}

/** The public key as an SPKI PEM, the shape `enrollFieldDevice` takes. */
export async function publicKeySpkiPem(pair: CryptoKeyPair, subtle: SubtleCrypto = crypto.subtle): Promise<string> {
  const der = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const body = toBase64(der).replace(/(.{64})/g, '$1\n').trimEnd();
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`;
}

/** SHA-256 hex of the SPKI DER. */
export async function keyIdOf(pair: CryptoKeyPair, subtle: SubtleCrypto = crypto.subtle): Promise<string> {
  const der = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const digest = new Uint8Array(await subtle.digest('SHA-256', der));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** `fs-` + 16 hex: well inside the server's 64-character device id limit. */
export function newDeviceId(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  return `fs-${[...random(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function loadOrCreateIdentity(store: IdentityStore, now: () => Date = () => new Date(), subtle: SubtleCrypto = crypto.subtle): Promise<DeviceIdentity> {
  const existing = await store.load();
  if (existing !== null) return existing;
  const pair = await generateDeviceKey(subtle);
  const identity: DeviceIdentity = { deviceId: newDeviceId(), keyId: await keyIdOf(pair, subtle), pair, createdAt: now().toISOString(), enrolledAt: null, enrolledAgency: null };
  await store.save(identity);
  return identity;
}

export async function markEnrolled(store: IdentityStore, identity: DeviceIdentity, agency: string, now: () => Date = () => new Date()): Promise<DeviceIdentity> {
  const next: DeviceIdentity = { ...identity, enrolledAt: now().toISOString(), enrolledAgency: agency };
  await store.save(next);
  return next;
}
