// ══════════════════════════════════════════════════════════════════
// StoragePort (ADR-FE-010) and its two adapters.
//
// The port is the seam frontend-revamp-plan D3 asks for: IndexedDB with
// persistent storage for the managed-Chrome pilot, an encrypted native store
// when the Field Station becomes a native wrapper — without touching features.
//
// Records are append-only: `put` of an existing recordId is refused, and the
// only mutable field is the sync state, changed through `setState`.
// ══════════════════════════════════════════════════════════════════

import type { SignedEnvelope } from './envelope.ts';
import type { SyncState } from './sync-machine.ts';

export interface StoredRecord {
  readonly envelope: SignedEnvelope;
  readonly state: SyncState;
  readonly reason?: string;
  readonly updatedAt: string;
}

export interface StorageHealth {
  /** navigator.storage.persisted(): the browser will not evict this store under pressure. */
  readonly persisted: boolean;
  readonly quotaBytes: number | null;
  readonly usageBytes: number | null;
}

export interface StoragePort {
  /** Ask for persistent storage (navigator.storage.persist()) and report the result. */
  health(): Promise<StorageHealth>;
  /** Append a new record. Rejects if the recordId already exists (records never overwrite). */
  put(record: StoredRecord): Promise<void>;
  get(recordId: string): Promise<StoredRecord | null>;
  /**
   * All records in capture order: by device, then localSequence. Not by the
   * UUIDv7 recordId, whose sub-millisecond bits are random and whose clock
   * can be skewed; localSequence is allocated in append order.
   */
  list(): Promise<readonly StoredRecord[]>;
  setState(recordId: string, state: SyncState, reason: string | undefined, updatedAt: string): Promise<void>;
  /** The highest localSequence stored for a device (0 when none). */
  lastSequence(deviceId: string): Promise<number>;
}

/** Capture order: device, then the per-device localSequence. */
export function byCaptureOrder(a: StoredRecord, b: StoredRecord): number {
  if (a.envelope.deviceId !== b.envelope.deviceId) return a.envelope.deviceId < b.envelope.deviceId ? -1 : 1;
  return a.envelope.localSequence - b.envelope.localSequence;
}

export class DuplicateRecordError extends Error {
  constructor(recordId: string) {
    super(`record ${recordId} already exists; a correction is a new record that supersedes it`);
    this.name = 'DuplicateRecordError';
  }
}

/** In-memory adapter: tests, and a degraded mode that the device check must refuse for capture. */
export function createMemoryStorage(health: StorageHealth = { persisted: false, quotaBytes: null, usageBytes: null }): StoragePort {
  const records = new Map<string, StoredRecord>();
  return {
    health: async () => health,
    put: async (record) => {
      if (records.has(record.envelope.recordId)) throw new DuplicateRecordError(record.envelope.recordId);
      records.set(record.envelope.recordId, record);
    },
    get: async (id) => records.get(id) ?? null,
    list: async () => [...records.values()].sort(byCaptureOrder),
    setState: async (id, state, reason, updatedAt) => {
      const current = records.get(id);
      if (current === undefined) throw new Error(`no record ${id}`);
      const { reason: _old, ...rest } = current;
      records.set(id, reason === undefined ? { ...rest, state, updatedAt } : { ...rest, state, reason, updatedAt });
    },
    lastSequence: async (deviceId) =>
      [...records.values()].filter((r) => r.envelope.deviceId === deviceId).reduce((max, r) => Math.max(max, r.envelope.localSequence), 0),
  };
}

export interface IndexedDbOptions {
  readonly dbName?: string;
  readonly indexedDB?: IDBFactory;
  readonly storageManager?: Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>;
}

const STORE = 'records';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/** IndexedDB adapter for the managed-Chrome pilot. Asks for persistent storage on first health check. */
export function createIndexedDbStorage(options: IndexedDbOptions = {}): StoragePort {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  const manager = options.storageManager ?? globalThis.navigator?.storage;
  const name = options.dbName ?? 'usrp-field-ledger';
  let opening: Promise<IDBDatabase> | null = null;

  const db = (): Promise<IDBDatabase> => {
    opening ??= new Promise((resolve, reject) => {
      const open = factory.open(name, 1);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore(STORE, { keyPath: 'envelope.recordId' });
        store.createIndex('deviceId', 'envelope.deviceId');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'));
    });
    return opening;
  };

  const tx = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => (await db()).transaction(STORE, mode).objectStore(STORE);

  return {
    health: async () => {
      if (manager === undefined) return { persisted: false, quotaBytes: null, usageBytes: null };
      const persisted = (await manager.persisted()) || (await manager.persist());
      const estimate = await manager.estimate();
      return { persisted, quotaBytes: estimate.quota ?? null, usageBytes: estimate.usage ?? null };
    },
    put: async (record) => {
      const store = await tx('readwrite');
      try {
        // add(), not put(): an existing key is a ConstraintError, never an overwrite.
        await request(store.add(record));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'ConstraintError') throw new DuplicateRecordError(record.envelope.recordId);
        throw error;
      }
    },
    get: async (id) => ((await request((await tx('readonly')).get(id))) as StoredRecord | undefined) ?? null,
    list: async () => [...((await request((await tx('readonly')).getAll())) as StoredRecord[])].sort(byCaptureOrder),
    setState: async (id, state, reason, updatedAt) => {
      const store = await tx('readwrite');
      const current = (await request(store.get(id))) as StoredRecord | undefined;
      if (current === undefined) throw new Error(`no record ${id}`);
      const { reason: _old, ...rest } = current;
      await request(store.put(reason === undefined ? { ...rest, state, updatedAt } : { ...rest, state, reason, updatedAt }));
    },
    lastSequence: async (deviceId) => {
      const all = (await request((await tx('readonly')).index('deviceId').getAll(deviceId))) as StoredRecord[];
      return all.reduce((max, r) => Math.max(max, r.envelope.localSequence), 0);
    },
  };
}
