// @usrp/field-ledger — public surface (ADR-FE-010). No UI, no feature imports.
export { canonicalJson, digestOf, toBase64Url, fromBase64Url } from './canonical.ts';
export { uuidv7, uuidv7Time } from './uuidv7.ts';
export { envelopeProblems, signingInput } from './envelope.ts';
export type { ClockConfidence, RecordSubject, RecordContext, RecordDraft, UnsignedEnvelope, SignedEnvelope } from './envelope.ts';
export { createMemoryStorage, createIndexedDbStorage, DuplicateRecordError } from './storage.ts';
export type { StoragePort, StoredRecord, StorageHealth, IndexedDbOptions } from './storage.ts';
export { ed25519Supported, generateDeviceKey, createWebCryptoSigner, verifySignature } from './signer.ts';
export type { SignerPort } from './signer.ts';
export { SYNC_STATES, TERMINAL_STATES, NOT_ACCEPTED_STATES, transition } from './sync-machine.ts';
export type { SyncState, SyncEvent, SyncPolicy, AckOutcome, TransitionResult } from './sync-machine.ts';
export { RECORD_STATUSES, ackForResult, readSyncResponse, eventsForBatch, readResolveResponse } from './sync-mapping.ts';
export type { RecordStatus, RecordSyncResult, SentRecord, SyncResponseReading, ResolveReading } from './sync-mapping.ts';
export { createLedger } from './ledger.ts';
export type { Ledger, LedgerDeps, LedgerClock } from './ledger.ts';
export { toBase64, sha256Hex } from './canonical.ts';
export { createMemoryIdentityStore, createIndexedDbIdentityStore, publicKeySpkiPem, keyIdOf, newDeviceId, loadOrCreateIdentity, markEnrolled } from './device-identity.ts';
export type { DeviceIdentity, IdentityStore } from './device-identity.ts';
