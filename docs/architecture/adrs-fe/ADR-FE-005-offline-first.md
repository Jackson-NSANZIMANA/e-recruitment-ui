# ADR-FE-005 — Offline-first as a constraint, not a feature

**Status:** Accepted · 2026-08-30
**Amended:** 2026-09-13 — Context corrected against the actual build config; the
decisions below are unchanged.

## Context

Two different offline problems, often conflated:

1. **The applicant's phone.** Intermittent connectivity, mid-range Android, a
   six-step wizard. Losing a draft means losing the application.
2. **The field tablet at a venue.** No signal for hours, exam-day scores captured
   for hundreds of applicants, then synced. Losing a capture means an applicant
   who ran the 3km for nothing.

The Workbox layer for (1) exists in `apps/applicant-portal/vite.config.ts`:
**`NetworkOnly` for `/edge/v1/*`**, `CacheFirst` for `/audio/*` Kinyarwanda
guidance, app shell precached via `globPatterns`, `registerType: 'autoUpdate'`.
This ADR does not re-decide it; it records what was missing around it.

> **CORRECTION, 2026-09-13.** The paragraph above previously described that file
> as *"`NetworkFirst` for `/api/*` with a 10-second network timeout"*. That was
> wrong in three ways at once, and it is worth naming because this is the
> document an engineer reads *before* touching offline behaviour:
>
> - the handler is `NetworkOnly`, not `NetworkFirst`. The difference is the whole
>   security argument: `NetworkFirst` **caches** authenticated responses and can
>   serve one citizen's data after logout, or on a shared venue tablet, to the
>   next person. An ADR that described a caching handler as the accepted decision
>   would have made restoring that bug look like conformance.
> - the path is `/edge/v1/*`, not `/api/*`. `/api/*` is the pre-ADR-021 shape
>   that `edge-contract.md` retired; the browser has exactly one origin.
> - there is no 10-second network timeout, because `NetworkOnly` has nothing to
>   time out *to*.

**And the harder of the two problems had no implementation at all.** Until
2026-09-13 every offline mechanism in this repository lived in the applicant
portal. `apps/officer-console` — the tablet this ADR describes standing at a
venue with no signal for hours — had no service worker, no manifest, no precached
shell, and one `Desktop Chrome` Playwright project. It could not load its own
application offline. `gates.config.json` compounded this by describing that app
as *"institutional desktop clients on agency networks"* when justifying its
bundle ceiling. The device class in the budget rationale was simply wrong.

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

> Verified against the upstream controller on 2026-09-13:
> `services/field-sync-service/src/adapters/http/sync-scores.controller.ts`
> rejects a malformed **batch** with 400, and rejects a well-formed but forged
> record **per-record with 200**, returning a per-record result so a safe
> re-upload converges. The client-side rule above is therefore stricter than the
> server's, deliberately: the officer must not be able to enqueue the thing that
> will come back rejected hours later.

### Concurrent captures are resolved by a human, not by a timestamp

Vector-clock comparison returns `CONCURRENT` when neither capture precedes the
other. Silently picking the later timestamp picks whichever tablet had the worse
clock drift. `resolution` is capped at 50 characters client-side, where the server
caps it — a free-text box with no `maxLength` produces a 400 the officer cannot see
coming, at a venue, with a queue behind them.

> The 50-character cap is now **verified**, not asserted:
> `resolve-conflict.controller.ts` rejects a `resolution` longer than 50. That
> controller also answers `409 NO_CONFLICT`, which is an officer-visible state and
> must not be swallowed as a generic error.

### `SLOT_ASSIGNED` renders an honest unavailable state

No endpoint returns the citizen's venue or time. `GET /v1/applicants/me/slot` is
proposed, not built. The portal says "you have a slot, we cannot yet tell you
where, you will receive an SMS", because a blank venue field reads as a system
fault to the one person who most needs the answer.

### Offline score capture says it cannot sync

The same principle as `SLOT_ASSIGNED`, applied to the officer.
`OFFLINE_CAPTURE_CAN_SYNC` is `false` in the field-ops slice, and the officer
console now **renders that fact** (`offline.sync_unavailable`) instead of leaving
an officer to infer it. The upstream batch endpoint is implemented; no `/edge/v1`
route brokers it, so nothing can be uploaded. An officer who does not know that
wipes or hands off the tablet.

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

**Still missing, and named so it is not mistaken for covered:** there is no
equivalent proof for the officer tablet. The `field-tablet` Playwright project
added 2026-09-13 gives it a touch-capable device and a real built bundle to run
against, which is the precondition for such a proof, not the proof itself. An
offline spec asserting the officer shell boots with no network is the next piece
of work this ADR requires.
