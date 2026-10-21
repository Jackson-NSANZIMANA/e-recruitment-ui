// ══════════════════════════════════════════════════════════════════
// The ledger: append locally first, sign, store, then move records only
// through the sync state machine. No network here — S08's sync engine calls
// the typed api-client operation and feeds the answer back via `apply`.
// ══════════════════════════════════════════════════════════════════

import { canonicalJson, digestOf } from './canonical.ts';
import { envelopeProblems, signingInput, type ClockConfidence, type RecordDraft, type SignedEnvelope, type UnsignedEnvelope } from './envelope.ts';
import type { SignerPort } from './signer.ts';
import type { StoragePort, StoredRecord } from './storage.ts';
import { transition, type SyncEvent, type SyncPolicy, type TransitionResult } from './sync-machine.ts';
import { uuidv7 } from './uuidv7.ts';

export interface LedgerClock {
  now(): Date;
  readonly timeZone: string;
  /** Measured against the edge `Date` header by the device readiness check. */
  confidence(): ClockConfidence;
}

export interface LedgerDeps {
  readonly storage: StoragePort;
  readonly signer: SignerPort;
  readonly deviceId: string;
  readonly clock: LedgerClock;
  readonly policy: SyncPolicy;
  readonly random?: (bytes: Uint8Array) => Uint8Array;
}

export interface Ledger {
  append<P>(draft: RecordDraft<P>): Promise<StoredRecord>;
  apply(recordId: string, event: SyncEvent): Promise<TransitionResult>;
  list(): Promise<readonly StoredRecord[]>;
}

export function createLedger(deps: LedgerDeps): Ledger {
  const random = deps.random ?? ((bytes: Uint8Array) => crypto.getRandomValues(bytes));
  // Appends are SERIALISED: localSequence is read, the record signed and then
  // stored, with awaits in between. Two concurrent appends must not read the
  // same lastSequence, so each waits for the previous one to settle (success
  // or failure) before it starts. One ledger instance per device and tab.
  let tail: Promise<unknown> = Promise.resolve();
  const serialised = <T>(work: () => Promise<T>): Promise<T> => {
    const run = tail.then(work, work);
    tail = run.catch(() => undefined);
    return run;
  };
  return {
    append<P>(draft: RecordDraft<P>): Promise<StoredRecord> {
      return serialised(() => appendOne(draft));
    },
    async apply(recordId, event) {
      return serialised(async () => {
        const record = await deps.storage.get(recordId);
        if (record === null) return { ok: false, state: 'LOCAL_ONLY', refused: `no record ${recordId}` } as const;
        const result = transition(record.state, event, deps.policy);
        if (result.ok) await deps.storage.setState(recordId, result.state, result.reason, deps.clock.now().toISOString());
        return result;
      });
    },
    list: () => deps.storage.list(),
  };

  async function appendOne<P>(draft: RecordDraft<P>): Promise<StoredRecord> {
    const now = deps.clock.now();
    const unsigned: UnsignedEnvelope<P> = {
      ...draft,
      recordId: uuidv7(now.getTime(), random),
      deviceId: deps.deviceId,
      keyId: deps.signer.keyId,
      capturedAt: now.toISOString(),
      timeZone: deps.clock.timeZone,
      clockConfidence: deps.clock.confidence(),
      localSequence: (await deps.storage.lastSequence(deps.deviceId)) + 1,
      payloadDigest: await digestOf(draft.payload),
    };
    const signature = await deps.signer.sign(new TextEncoder().encode(canonicalJson(signingInput(unsigned))));
    const envelope: SignedEnvelope<P> = { ...unsigned, signature };
    const problems = envelopeProblems(envelope);
    if (problems.length > 0) throw new Error(`invalid record: ${problems.join('; ')}`);
    const record: StoredRecord = { envelope, state: 'LOCAL_ONLY', updatedAt: now.toISOString() };
    await deps.storage.put(record);
    return record;
  }
}
