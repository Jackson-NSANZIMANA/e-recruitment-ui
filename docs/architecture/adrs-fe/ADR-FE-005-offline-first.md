# ADR-FE-005 — Offline-first as a constraint, not a feature

**Status:** Accepted · 2026-08-30

## Context

Two different offline problems, often conflated:

1. **The applicant's phone.** Intermittent connectivity, mid-range Android, a
   six-step wizard. Losing a draft means losing the application.
2. **The field tablet at a venue.** No signal for hours, exam-day scores captured
   for hundreds of applicants, then synced. Losing a capture means an applicant
   who ran the 3km for nothing.

The Workbox layer for (1) already exists in
`apps/applicant-portal/vite.config.ts`: `NetworkFirst` for `/api/*` with a
10-second network timeout, `CacheFirst` for `/audio/*` Kinyarwanda guidance, app
shell precached, `registerType: 'autoUpdate'`. This ADR does not re-decide it; it
records what was missing around it.

## Decisions

### Draft persistence is versioned and sanitised

`localStorage` under `usrp_application_draft`, with `DRAFT_SCHEMA_VERSION`. A
draft from an older version is **discarded, not migrated by hope** — a
half-restored shape submits a body the backend answers with a 400 the citizen
cannot act on, and "restore what we recognise" is how that happens.

`NEVER_PERSIST` (`nationalId`, `nationalIdHash`, `otp`, `sessionToken`) is
stripped on the way **out and in**, so a bundle written by an older build is
cleaned on read. INVARIANT 2 does not have an offline exemption, and neither does
a revocable session token.

### The invitation key is cached for offline verification

`CacheFirst`, keyed by `keyId` so a rotation is a new entry rather than a stale
hit. Note it is **not** the token issuer's key: two Ed25519 keypairs, two
purposes, and the shared algorithm name is the trap.

### An unsigned capture never enters the queue

The device signature is the integrity gate and an unsigned record fails the
**entire batch** with a 400. Rejecting it at queue time turns "the officer loses
the whole afternoon's work at sync" into "the officer sees one bad capture
immediately".

### Concurrent captures are resolved by a human, not by a timestamp

Vector-clock comparison returns `CONCURRENT` when neither capture precedes the
other. Silently picking the later timestamp picks whichever tablet had the worse
clock drift. `resolution` is capped at 50 characters client-side, where the server
caps it — a free-text box with no `maxLength` produces a 400 the officer cannot see
coming, at a venue, with a queue behind them.

### `SLOT_ASSIGNED` renders an honest unavailable state

No endpoint returns the citizen's venue or time. `GET /v1/applicants/me/slot` is
proposed, not built. The portal says "you have a slot, we cannot yet tell you
where, you will receive an SMS", because a blank venue field reads as a system
fault to the one person who most needs the answer.

### No applicant-facing document quality indicator

The citizen upload route deliberately returns no lane, score or flags. Handing a
forensics verdict to the person who uploaded the file is a forgery-tuning oracle:
edit, re-upload, watch the number move, repeat until GREEN. Proof 03 fails any
citizen-facing slice file that mentions forensics.

## Enforcement

Proof 06 (`draft`, `conflict`, `invitation` model tests), proof 03 (storage and
forensics greps), proof 09 (`apps/applicant-portal/e2e/offline.spec.ts` asserts the
draft survives a reload while offline and that the stored blob contains neither a
National ID nor a session token).
