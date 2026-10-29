# ADR-FE-016 — Field Station screens: device key, signed capture, honest acknowledgement

**Status:** Accepted · 2026-10-29 (S08, part 2) · extends ADR-FE-010 (ledger) and ADR-FE-011 (stations)

## Decision

1. **Signing uses WebCrypto Ed25519 on the pinned Chrome; there is no pure-JS fallback.** `ed25519Supported()` is a readiness check that BLOCKS the stations (a tablet that cannot sign captures nothing and is pointed to the paper fallback). The key pair is generated non-extractable and persisted by structured clone in IndexedDB; only the SPKI public key is ever sent (`enrollFieldDevice`). Proven live on system Chrome (Ed25519 enrolled and a signature verified by the field-sync service). A device whose Chrome lacks Ed25519 is rejected at setup; if the Galaxy Tab A7 fleet's pinned Chrome turns out not to support it, add one audited pure-JS implementation behind `SignerPort` (not done: no evidence it is needed).
2. **Physical capture is ledger-first and never "saved" without a per-record answer.** The record is appended `LOCAL_ONLY`, signed, sent once by `syncFieldScores` (never auto-retried; `OFFLINE_CAPTURE_CAN_SYNC` stays false), and the screen reports the per-record result mapped from the real response union (`fateOf`). No answer (network drop, 5xx without a body) returns the record to `LOCAL_ONLY` with the paper prompt. `DUPLICATE` is shown as "server already had it".
3. **Attribution.** The field-sync service stores `capturingOfficerId` in a UUID column; a non-UUID is a 500 and no per-record answer. The browser session carries no officer subject (CONTRACT-PENDING), so a capture is attributed to a per-tablet pseudonymous UUID (`stationActorId`), never to a person; a non-UUID subject is refused on the device as `NOT_SENDABLE`. Consequence: ADR-037's "the confirmer is not the capturing officer" cannot be checked from the payload until the edge session exposes the officer's opaque id (backend ask).
4. **Medical mode comes from the session agency** (RDF BOARD; RNP, RCS CERTIFICATE with the physician), never from a choice on screen. A 422 detail is never rendered.
5. **Supervisor station** is granted by `field.conflict.resolve` or `field.device.manage` (S09 decision: `field_supervisor` and `agency_admin` manage the fleet; enrolment stays with the screening officer, who can enrol on `/setup`). It shows venue live counts, this tablet's sync centre, the fleet (read only) and links to `/conflicts`, which resolves a held score (`resolveFieldSyncConflict`, mandatory reason, only a 200 `RESOLVED` appends the resolution events). `/check-in` reads `getBiometricPolicy` and states the mode; in OFF and SHADOW nothing about a face is shown and a no-match is never a refusal (ADR-037).

## Not in this change

Paper-documents station, the degraded offline-signature rung UI, biometric capture (B2) and the manual-identity confirmation list (needs B2 evidence records; in SHADOW the service answers `NOT_REQUIRED`).
