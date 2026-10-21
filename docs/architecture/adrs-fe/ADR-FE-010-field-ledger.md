# ADR-FE-010 — `@usrp/field-ledger`: a signed, local-first record log behind storage and signer ports

**Status:** Accepted · 2026-10-18 (S02) · **Extends:** ADR-FE-005 (offline-first as a constraint)

## Context

Field capture (physical scores, document sightings, later biometrics) must survive a venue with no signal and a lost device, and must never be shown as saved when the server has not accepted it. `OFFLINE_CAPTURE_CAN_SYNC` is `false` until encrypted capture, replay and conflict UX are proven (AGENTS.md §2). D3 says the pilot runtime is a managed-Chrome PWA and later a native wrapper.

## Decision

1. **A platform package, not a feature.** `packages/field-ledger` knows no domain vocabulary beyond "record", has no UI, and imports no feature or React (`check-boundaries.mjs`). Features (field-ops, S08) import it.
2. **Record envelope** (baseline §15.3): `recordId` (UUIDv7, time-ordered), `kind`, `schemaVersion`, subject (`applicationId` / opaque `ticketRef`, never the QR credential), context (campaign code, policy hash, venue, exam day, station, officer subject), `deviceId`, `keyId`, `capturedAt` + `timeZone` + `clockConfidence`, `localSequence`, `payloadDigest` (SHA-256 of canonical JSON), `signature`, optional `supersedes`. A correction never overwrites: it is a new record naming the one it supersedes; storage refuses a second write of a `recordId`.
3. **StoragePort** with an IndexedDB adapter that requests `navigator.storage.persist()` and reports quota; an in-memory adapter for tests. A native encrypted store replaces IndexedDB behind the same port.
4. **SignerPort** with a WebCrypto Ed25519 adapter whose private key is generated **non-extractable**; only the raw public key leaves, for device enrolment. Android Keystore replaces it behind the same port.
5. **Client sync state machine** — pure and total: `LOCAL_ONLY → QUEUED → SENDING → ACCEPTED | DUPLICATE_REPLAY | REJECTED_VALIDATION | STALE_CONFLICT → NEEDS_SUPERVISOR → RESOLVED`.
   - Records are written locally first, always (`LOCAL_ONLY`).
   - Only a per-record answer moves a record out of `SENDING`; a batch `200 { status: 'SYNCED' }` proves nothing.
   - Nothing is retried automatically: an uncertain send returns to `QUEUED` (or `LOCAL_ONLY` in pilot mode); a deliberate resend of the same signed payload is answered `DUPLICATE` by the server.
   - With `OFFLINE_CAPTURE_CAN_SYNC=false`, `ENQUEUE` is refused: an offline record stays `LOCAL_ONLY` ("not accepted — use paper").
6. **Response mapping** (`sync-mapping.ts`) follows the backend source at the pinned SHA: per-record `status` ∈ ACCEPTED, SUPERSEDED → ACCEPTED; DUPLICATE → DUPLICATE_REPLAY; CONFLICT, STALE → STALE_CONFLICT; NOT_FOUND, REJECTED (+reason) → REJECTED_VALIDATION; whole-batch 400 → REJECTED_VALIDATION; anything else → uncertain. `resolveFieldSyncConflict`: RESOLVED or 409 NO_CONFLICT → resolved; 404 NOT_FOUND / SCORE_NOT_FOUND → refused.

## Consequences

- S02 found that `packages/contracts/openapi/field-sync-service.yaml` types per-record results as an open record and its fixtures use `outcome` where the controller emits `status`; the ledger follows the controller and S08 must correct the contract before consuming it.
- Persisting the device key pair across reloads (IndexedDB structured clone keeps it non-extractable), the sync engine and the device readiness check at `/setup` are S08's.
- Enforced by: `packages/field-ledger/test/*` (full transition table, mapping totality, signature verification, non-extractability, append-only storage).
