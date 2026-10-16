# Frontend Revamp Plan — Architecture, Engineering, Build

**Status:** Proposed · 2026-10-15
**Input:** [`docs/product/user-facing-feature-spec-2026-10-15.md`](../product/user-facing-feature-spec-2026-10-15.md) (the national deployment baseline, "the baseline")
**Scope:** Waves 0–2 in detail; Waves 3–6 in outline
**Verified against:** frontend `90c331c` (PR #25), backend `1d971ae` (PR #32). The frontend pins backend `df80f65`.

---

## 0. Decisions this plan is built on

| # | Decision | Source | Consequence |
|---|---|---|---|
| D1 | **Keep ADS as-is.** The AGENTS.md composition ladder is unchanged, and features keep importing `@atlaskit/*` directly. | Owner, 2026-10-15 | This overrides baseline §1.1 decision 11. ADR-FE-008 records the licence question as an owner-accepted risk. No façade layer is built. |
| D2 | **Three deployable apps**: `applicant-portal`, `officer-console` and a new `field-station`. | Owner, 2026-10-15 | The gate and walk-in routes move out of the officer console. ADR-FE-004's "do not scaffold an admin console" is superseded, because administration lives in `officer-console`. |
| D3 | **The field runtime is a managed Android PWA for the pilot, then native.** Field records go through a storage port, so an encrypted native database can replace IndexedDB without touching features. | Owner, 2026-10-15 | `OFFLINE_CAPTURE_CAN_SYNC` stays `false` until Wave 4 proof. Pilot capture is online-first, with paper fallback. |
| D4 | **Plan depth:** Waves 0–2 in detail, 3–6 in outline. | Owner, 2026-10-15 | — |

Unchanged invariants (AGENTS.md §2):
- one origin, `/edge/v1/**`
- no `Authorization` header from the browser
- no secrets in the browser
- typed transition POSTs only
- no automatic retry of writes
- no forensics signal shown to applicants
- agency is taken from the session only

---

## 1. Where we actually are (verified 2026-10-15)

| Area | Fact | Evidence |
|---|---|---|
| Contract | 43 backend edge operations, including `admitAtGate`. The frontend registry is pinned to `df80f65`, the tip of the merged PR #32. | `edge-operations.ts`, `packages/api-client/src/paths.ts:20` |
| Baseline document | Already out of date on SHAs (`bd939f61`/`cd27d111`), the operation count (42), and T2/gate ("not built") | This file §1 |
| Gate | Built: ADR-034 single-use admission with ID-card hash binding and 10 typed outcomes. A score is refused without an admission. `apps/officer-console/src/routes/gate.tsx` (224 lines), plus the citizen QR state `ADMITTED`. | ADR-034, PR #25 |
| Feature slices | **All 16 route files in `packages/features/*/src/routes` are one-line placeholders.** They hold the real models and API adapters but render only a title. | `wc -l` |
| Real screens | Applicant: `apply/index.tsx` (619 lines), `exam-qr` (172), `status` (122). Officer: `gate` (224), `dashboard` (30, basic counts), applications list and detail (thin wrappers over `features/applications/ui`). | — |
| Tests | 9 `test.fixme` across 11 E2E specs | `apps/*/e2e` |
| Offline | `OFFLINE_CAPTURE_CAN_SYNC = false`. The PWA shell uses `NetworkOnly` for `/edge/v1/**`. | `field-ops/src/api/transport.ts:59`, `vite.config.ts` |
| Biometrics | `verifyBiometric` is listed as `FIELD_OPS_UNSERVED`, reason upstream-unverified | `field-ops/src/api/transport.ts` |
| Tooling | contract-drift (method/path/session/composition/retry), surface-contract (1 manifest), boundary checks, `verify:full` | `package.json` |

**The real gap is screens and proof, not plumbing.** The transport, auth, contracts, i18n, the generated MSW fixtures and the proof harness are solid. What's missing:
- the Campaign Studio
- every specialist queue
- station workflows
- the citizen tracker and checklist
- a durable field record log
- E2E proof for nearly everything except the gate

---

## 2. Target architecture

### 2.1 Topology

```
                     ┌──────────────────────── /edge/v1/** (one origin) ───────────────────────┐
                     │                                                                          │
  apps/applicant-portal          apps/officer-console                    apps/field-station
  citizen PWA, mobile-first      desktop, data-dense                     managed Android tablet PWA
  ─────────────────────          ───────────────────                     ─────────────────────────
  /campaigns, /campaigns/:code   /campaigns  (Campaign Studio)           /setup     (device + venue + day)
  /apply/*                       /applications, /applications/:id        /stations  (picker by permission)
  /applications                  /queues/{amber,holds,medical,final}     /gate, /documents, /physical,
  /applications/:id/exam-pass    /operations (dashboard)                 /medical, /walk-in (RDF)
  /privacy                       /privacy/dpo  (after B-13)              /sync, /conflicts (supervisor)
                                 /field/oversight (read-only, later)     /paper (fallback sheets, re-entry)
                     │                         │                                       │
                     └──────────── composes packages/features/* (no cross-slice imports) ┘
```

Why a separate field app, beyond D2:
- **Different threat model.** A device key is involved, local evidence is stored, and devices may be lost.
- **Different release cadence.** A change freeze applies before exam days, and version attestation is needed (baseline §15.9).
- **Different runtime.** It is installed on managed Chrome now and becomes a native wrapper later (D3).
- **Different interaction model.** Station-centric, glove- and sunlight-friendly, minimal navigation.

Keeping it inside `officer-console` would put desktop administration bundles and an offline record log in the same service-worker scope.

**Ownership rule:** an app owns routing, the shell, the PWA manifest, auth boot and composition. Features own behaviour. `gate.tsx` and `walk-in.tsx` currently hold logic in `apps/officer-console`. They move into feature slices, and `field-station` mounts them.

### 2.2 Packages (deltas from today)

| Package | Change |
|---|---|
| `packages/features/campaigns` | **New slice.** Holds the public catalogue/detail (applicant) and the Campaign Studio (officer). Wraps the 9 campaign operations already in `api-client/operations/campaigns.ts`. |
| `packages/features/field-ops` | **Fill.** Station model, gate (moved from the app), paper-document sighting, physical capture, walk-in, sync centre and conflicts. The placeholder routes are replaced. |
| `packages/features/scheduling` | **Fill.** Offline signed-pass verifier (Ed25519 public key, `USRP-SLOT.v1`), used as the gate's degraded rung. It also owns Exam Pass rendering and is shared with the applicant portal. |
| `packages/features/adjudication` | **Fill.** Amber queue and post-clearance hold queue (Q1/Q2) |
| `packages/features/applications` | **Extend.** Citizen stage projection, tracker, Applicant 360 tabs, medical/final/accept actions per agency mode, document checklist (citizen and officer views) |
| `packages/features/compliance` | **Fill.** Privacy centre (citizen). The DPO queue waits for B-13. |
| `packages/field-ledger` | **New platform package (not a feature).** A durable record log behind `StoragePort` and `SignerPort`, plus the client sync state machine (§2.5). It has no domain vocabulary beyond "record". `features/field-ops` depends on it. |
| `packages/ui` | **Extend** with the cross-surface patterns the baseline requires on every route (PLAT-07): `StateBoundary`, `QueueTable`, `ConfirmAction`, `Timeline`, `MaskedValue`, `FreshnessStamp`, `StationHeader` and `PrintSheet`. These are ADS compositions (AGENTS.md ladder rung 4), and they hold no domain logic. |
| `apps/field-station` | **New app.** A Vite + PWA scaffold mirroring `officer-console` (eager login, `OfficerGuard`, `NetworkOnly` edge caching). It has its own manifest and its own bundle-size budget. |

`check-boundaries.mjs` gains the rules:
- `field-ledger` must not import `features/*`
- `features/*` may import `field-ledger`
- `apps/field-station` may compose only `identity`, `scheduling` and `field-ops`, plus the read-only `applications` model

### 2.3 Readiness is declared and gated

Surface manifests (`docs/ui-surfaces/*.json`) become the delivery unit. The schema gains:

```json
"readiness": {
  "rung": "SCREEN-BUILT",
  "evidence": {
    "e2e": ["apps/officer-console/e2e/application-flow.spec.ts"],
    "contract": "df80f65",
    "a11y": "storybook:Applications/*"
  },
  "blockedBy": ["B-2"]
}
```

`surface:verify` enforces each rung:
- **EDGE-AVAILABLE:** every listed operation is in `paths.ts`.
- **CLIENT-WIRED:** every operation has a typed op plus a zod decode.
- **SCREEN-BUILT:** the route source is not a placeholder (it must render each declared state), and the locale keys are at parity.
- **E2E-PROVEN:** the referenced spec exists and contains no `fixme`/`skip`.

LOAD-PROVEN and OPERATIONALLY-READY are signed off outside this repo, so the manifest records a reference and does not try to verify it. Every route in all three apps gets a manifest in Wave 0. The verifier then reports actual readiness, replacing the prose in the docs.

### 2.4 Contract parity v2

`tooling/contract-drift` currently compares method, path, session, composition and retry policy. Extend it to compare:
- request and response schema (generated zod against the backend OpenAPI)
- the permission each operation requires (`x-usrp-permission`, which the backend must emit; an ask)
- the outcome union for 409/422 refusals (e.g. ADR-034's 10 outcomes)
- the idempotency scope

CI then emits an **evidence bundle** as a build artefact, not a doc. It contains both SHAs, the operation inventory and diff, test results with `fixme` counted separately, and the bundle sizes. Docs link to the artefact and do not restate it. This is the fix for a document going out of date within hours.

### 2.5 Field record log (`@usrp/field-ledger`)

```
 feature (station UI) ──append(record)──► Ledger ──► StoragePort   (IndexedDB+persist now │ native encrypted DB later)
                                            │   └──► SignerPort    (WebCrypto Ed25519, non-extractable │ Android Keystore later)
                                            └──► SyncEngine ──► typed op (syncFieldScores …) ──► per-record ack
```

- **Record envelope** (baseline §15.3): `recordId` (UUIDv7), `kind`, `schemaVersion`, the application/ticket reference, campaign and policy hash, venue/day/station, officer subject, `deviceId`/`keyId`, `capturedAt` plus timezone plus a clock-confidence flag, local sequence, payload digest, signature, and `supersedes?`.
- **Client sync states:** `LOCAL_ONLY → QUEUED → SENDING → ACCEPTED | DUPLICATE_REPLAY | REJECTED_VALIDATION | STALE_CONFLICT → NEEDS_SUPERVISOR → RESOLVED`. Each one maps to a real `syncFieldScores` / `resolveFieldSyncConflict` response variant. Those mappings are pure functions tested against the generated fixtures. No state is ever inferred from an HTTP 200.
- **Pilot mode (`OFFLINE_CAPTURE_CAN_SYNC = false`):** the ledger still writes locally *first* and then sends immediately. With no network the record stays `LOCAL_ONLY`, labelled "not accepted — use paper sheet". Offline capture can therefore never be mistaken for synced, and the ledger is built and exercised from day one.
- **Correction never overwrites.** A correction is a new record with `supersedes`.
- **Device readiness check** at `/setup`:
  - `navigator.storage.persisted()` must be true
  - quota headroom
  - Ed25519 support
  - clock skew against the edge `Date` header
  - device enrolment state
  - app build version

  A failed check blocks the stations and points to the paper fallback.

### 2.6 Station model (field-station)

A station is available when the session's permissions grant it. It is never a free choice.

| Station | Permission(s) | Wave 2 scope |
|---|---|---|
| Gate | `admission.gate` | Online `admitAtGate` (exists). Offline signature check as a visible degraded rung; it cannot spend the QR. |
| Paper documents | `document.verify.venue` | `getDocumentChecklist` → `verifyDocumentAtVenue`, one write-once mark per item |
| Physical | `field.score.sync` | One candidate at a time, bounds-checked, signed via the ledger, sent online. Heat mode comes in Wave 4. |
| Medical | `medical.review` | Agency mode taken from the session (RDF BOARD; RNP/RCS CERTIFICATE with physician name) → `recordMedicalReview` |
| Walk-in | `walkin.register` / `walkin.vet` / `identity.verify`, RDF only | Moved from officer-console |
| Supervisor | `field.conflict.resolve` | Sync centre and conflicts; device enrolment (`field.device.enroll`) |

`/setup` fixes the venue name and exam day for the session. The gate decision is matched case- and space-insensitively per ADR-034. Until a venue/session read (B-5/B-6) exists, the venue is typed and confirmed. This is flagged as a pilot limitation in the manifest.

### 2.7 Officer console information architecture

Navigation is built from permissions (`permissionsForRoles` in the session view). It is a usability layer only:
- **Campaigns** (`campaign.*`)
- **Applications** (`application.read`)
- **Queues:** Amber and Holds (`adjudication.*`), Medical (`medical.review`), Final and Accept (`decision.final` / `application.accept`)
- **Operations:** the dashboard, honest about its data source until B-1
- **Privacy** (after B-13)

Each queue is a `QueueTable` with age, last action, the permitted transition and a separation-of-duties hint from the status history.

### 2.8 Applicant portal information architecture

- **Campaigns:** a public catalogue/detail with shareable `/campaigns/:publicCode`.
- **Apply:** the existing wizard, which moves into the `applications` slice.
- **My applications:** a stage tracker, and an Exam Pass with the states `PENDING`, `READY`, `ON_HOLD`, `ADMITTED` and unavailable.
- **Privacy:** withdraw and erasure.

The stage projection is one pure function, `toCitizenStage(status)`, with an exhaustive test over all 21 `APPLICATION_STATUSES`. `DRAFT` is not "submitted", and the walk-in statuses are excluded.

---

## 3. ADRs to write (Wave 0)

| ADR | Decision |
|---|---|
| FE-007 | Three-app topology; field-station boundary; gate and walk-in move out of officer-console (supersedes FE-004 §4) |
| FE-008 | ADS retained (D1); licence question recorded as an owner-accepted risk with a review date |
| FE-009 | Readiness ladder in surface manifests, enforced by `surface:verify` |
| FE-010 | `@usrp/field-ledger`: record envelope, storage and signer ports, client sync states, local-first even in online mode (extends FE-005) |
| FE-011 | Station model: permission-derived stations, venue/day session setup, the degraded-gate rung |
| FE-012 | Contract parity v2 and the CI evidence bundle; docs never restate counts or SHAs |
| FE-013 | Citizen stage projection as a view over the canonical enum |

---

## 4. Wave 0: evidence, cleanup and scaffolding

**Goal:** a truthful baseline and the skeleton the later waves fill in. No new user-facing features.

| ID | Task | Owner | Done when |
|---|---|---|---|
| W0-01 | Fix the baseline document: remove the stray prompt (lines 1030–1031), rename it to `docs/product/usrp-national-baseline-v1.md`, add an errata box for ADR-034, SHAs and operation count, and point the "current state" claims at the CI bundle | FE lead | The doc carries no unverifiable counts |
| W0-02 | Confirm `df80f65` ≡ the tree of `1d971ae` for the edge registry. If it differs, re-pin with the regenerated contracts. | FE | contract-drift shows 0 findings at the pinned SHA |
| W0-03 | Refresh `frontend-architecture.md` and `cross-repo-contract-reconciliation-*`. Fix stale comments in `ConnectionStatus`, the applicant `home.tsx` and `citizen-journey.spec.ts`. | FE | No doc or comment contradicts code (reviewed by grep for old counts/SHAs) |
| W0-04 | Run `pnpm verify:full` plus E2E. Record the real results in the first CI evidence bundle. | FE | The artefact exists for `90c331c` |
| W0-05 | Triage the 9 `test.fixme`: delete the ones made obsolete by PRs #24/#25, convert the ones that can now run, and keep the rest with a `BLOCKED: B-x` reason | FE | Each `fixme` names a backlog ID |
| W0-06 | Contract-drift v2 (§2.4). Schema, outcome-union and idempotency comparison now. Permission comparison follows the backend ask BE-01. | FE | The selftest covers each new dimension with a failing fixture |
| W0-07 | Surface schema v2 (`readiness`), plus manifests for every existing route in both apps | FE | `surface:verify` prints the real rung per route |
| W0-08 | Scaffold `apps/field-station`: shell, eager login, `OfficerGuard`, i18n, PWA manifest, CI build, size budget and boundary rules | FE | It builds, logs in against edge-dev, and shows an empty station picker |
| W0-09 | Move the gate and walk-in logic into the `field-ops` slice. Officer-console routes redirect to field-station, or drop after the pilot sign-off. | FE | `gate.spec.ts` passes against field-station |
| W0-10 | Scaffold the `features/campaigns` slice and `packages/field-ledger` (ports, envelope types, state machine, unit tests; no UI) | FE | The packages typecheck and the state-machine table tests pass |
| W0-11 | Write ADRs FE-007 to FE-013 | FE lead | Merged |
| W0-12 | Open the owner-decision tracker for the Wave 2 blockers (§7) | Product | Each item has an owner and a date |

**Exit gate:** evidence bundle published; contract drift at 0; every route has a manifest with a truthful rung; no unexplained `fixme`; field-station builds; ADRs merged.

### Wave 0 progress (2026-10-15, uncommitted working tree on `90c331c`)

| Task | Status | Evidence |
|---|---|---|
| W0-02 | **Done** | `df80f65` and `1d971ae` share tree `477ec8e`. `contracts/scripts/verify.ts --backend ../e-recruitment` at `df80f65` is green (877 drift assertions, 2,377 total). Without `--backend`, gates B and C silently run at reduced scope, so CI must pass the checkout. |
| W0-04 | **Done locally** (CI bundle still to do) | Uncached (`--force`, 0 cache hits): typecheck 20/20, lint 18/18, test 17/17 (vitest 4.1.12, 26 tests), build 2/2. Rules, hygiene, surface (44 assertions), extraction and size all pass. Storybook a11y passes, but covers only 3 stories. The security scan is green with every check run, including Trivy. E2E: applicant 16/16; officer 10 passed, 2 failed (W1-00). |
| W0-04 security | **Done** | Fixed: `.env` files untracked, PEM-header markers removed from a test and a fixture, and the dependency upgrade (vitest 2→4, vite 5→6, vite-plugin-pwa 0.20→1.2, workbox 7.3→7.4, `ads-mcp` deduplicated, scoped `puppeteer>tar-fs`/`puppeteer>ws` overrides). Audit went from 4 critical + 10 high to 0 critical + 3 high; the 3 high have no upstream fix and are registered in `docs/security/audit-exceptions.md`, enforced by the scan (selftest: 16 assertions). |
| W0-05 | **Done** | 7 obsolete `fixme` → 10 real E2E tests (onboarding, campaign-bound apply with idempotency, walk-in with AGE_PENDING). 2 kept: `BLOCKED: W2-12` and `BLOCKED: B-13`. |

**Environment findings:**
- An interrupted `pnpm install` truncated 49 `node_modules/.bin` shims to 0 bytes. After that, `turbo` and `playwright` exited 0 **without running anything**. The CI evidence bundle should assert non-zero task counts, not just exit codes.
- The local `a11y` script fails only on its `sudo` `--with-deps` install; that step is correct in CI.

**W1-00 — done (`5322c65`).** `/applications/:id` → **Accept** opened no confirmation dialog on the dev server. It reproduced on the untouched `90c331c` (Vite 5.4.21) and passed against the production build.

- **Cause:** `@atlaskit/portal` 7.0.2's legacy path creates its container in `useMemo` and removes it in an effect cleanup. React StrictMode's dev-only unmount/remount strands the content in a detached node.
- **Why it was locked in:** both apps resolved every ADS flag to `false`, which pinned that legacy path.
- **Fix:** `@usrp/design-system` now holds one allowlist (`resolveAdsFeatureFlag`) that enables only `platform_design_system_team_portal_logic_r18_fix`. A test pins the set.
- **Verified:** officer E2E passes on both the dev server and the production build.

### Found running against the real backend (2026-10-16)

| ID | Finding | Status |
|---|---|---|
| W1-09 | The walk-in form never sent the NESA/HEC reference the backend requires per category, so every walk-in was refused with `422 INVALID_ACADEMIC_INPUT`, shown only as "Something went wrong". The mocked E2E passed because its mock accepted the incomplete body. | **Done (`20b90a9`).** Category is now a Select of the officer's agency's categories, the academic field follows the category, and each register refusal is named (en/rw/fr). Verified live: body carries `nesaIndexNumber`, and the remaining refusal (`NO_WALK_IN_CAMPAIGN`) is named on screen. |
| W1-10 | **There is no dev data path.** `bootstrap:db` seeds officers but no `agency_admin` and no campaign, and there is no Campaign Studio screen. Against the real stack every list was empty, walk-ins were refused (`NO_WALK_IN_CAMPAIGN`), and the portal had nothing to apply to; citizens also could not read their OTP. | **Done (2026-10-16).** OTP: backend dev SMS inbox (`pnpm dev:sms`, backend `feat/dev-sms-inbox`). Data: **USRP Rehearsal** (backend ADR-035, `pnpm rehearse`, backend `feat/rehearsal`) stages one synthetic campaign per agency through the real control plane (first-admin function, then draft → policy → sessions → publish over the edge), idempotent per Kigali day and fenced from production. The portal marks rehearsals on the campaign card and the Exam Pass (`isRehearsalCampaign`). The live journey `apps/applicant-portal/e2e/live-rehearsal.spec.ts` (opt-in `USRP_LIVE=1`) passes on the real stack: persona A applies, clears all three gates, gets the rehearsal Exam Pass and is admitted at the gate; persona B is refused at the age gate. |

**W2-13 head start:** `live-rehearsal.spec.ts` is the first cross-app journey on the real edge; W2-13 extends it (walk-in lane, medical, final decision, accept) and runs it in CI against a booted stack.

**Lesson for the E2E harness (feeds W2-13):** route-intercepted specs prove the screen sends what *we* think the contract is. Every journey also needs at least one run against the real edge, or contract gaps like W1-09 pass green.

---

## 5. Wave 1: the reference officer workspace, plus queues

**Goal:** make `/applications` and `/applications/:id` **E2E-PROVEN**, extract the patterns, then reuse them to build the queues quickly.

| ID | Task | Detail | Done when |
|---|---|---|---|
| W1-01 | `packages/ui` patterns | `StateBoundary` covers loading, empty, filtered-empty, forbidden, not-found, partial, stale, upstream-failure and conflict. Also `QueueTable`, `ConfirmAction`, `Timeline`, `MaskedValue` and `FreshnessStamp`, with Storybook stories and a11y checks for every state. | Storybook a11y is green and each state has a story |
| W1-02 | List truth | The list is capped at 100 with no server filter (baseline §7.3). Render "showing first N", never imply completeness. Client filters are labelled as such. The cursor and filter ask goes to the backend as BE-02. | E2E asserts the cap notice |
| W1-03 | Applicant 360 tabs | Summary (masked by default), status timeline, document checklist (`getDocumentChecklist`), slot/invitation, field records and medical. Each tab has its own `StateBoundary`, and partial data is never promoted to complete. | All manifest states are tested |
| W1-04 | Transition actions | Medical (agency mode from the session), final decision, accept (renders `409 CROSS_AGENCY_LOCKED` naming the holding agency), and adjudicate (CLEAR/REJECT). Every action uses `ConfirmAction`, protection against double-submit, no retry, and focus and live announcements. | E2E for each action, including the refusal paths |
| W1-05 | Q1/Q2 queues | Fill `amber-queue` plus a holds view. A null forensic signal renders "not analysed", never blank (ADR-FE-004 §1). | E2E with mixed-queue fixtures |
| W1-06 | Q3 medical / Q4 final views | Status-filtered views over the capped list, labelled. Bulk final decision is a per-record loop with a per-row result; no hidden partial failure. | E2E with partial-failure fixtures |
| W1-07 | Permission-built navigation | Implements §2.7. A forbidden route renders a forbidden state, never a broken screen. | Negative E2E for each role fixture |
| W1-08 | Pilot continuity artefacts (field-station) | `/paper` holds printable numbered score sheets and a blank roster template (`PrintSheet`). A **dual-entry re-entry** screen has two officers enter the same sheet, and mismatches are blocked before sending. The roster pre-fill waits for B-5. | Print CSS verified; dual-entry E2E |

**Exit gate:** officer application workspace E2E-PROVEN; queues SCREEN-BUILT with E2E; patterns reused by at least 3 surfaces; locale parity maintained; a11y green.

---

## 6. Wave 2: one thin end-to-end pilot journey across all three apps

**Goal:** a synthetic candidate goes from campaign publish to a final decision through the UI only, with a correlated trace.

| ID | App | Task | Ops (all exist) | Done when |
|---|---|---|---|---|
| W2-01 | officer | Campaign Studio, steps 1–4: basics → policy (immutable, show SHA-256; prefills labelled "suggestion") → district × day session grid with the `UNBOUNDED_CAPACITY` code → preflight checklist plus citizen preview → publish (a structured 409 keeps the draft) | `createCampaign`, `createCampaignPolicy`, `configureCampaignSession`, `publishCampaign` | E2E publishes a campaign that the applicant catalogue shows |
| W2-02 | officer | Lifecycle controls: close, complete and cancel with typed confirmation. Impact counts are labelled "unavailable" until B-1/B-6. | `closeCampaignRegistration`, `completeCampaign`, `cancelCampaign` | E2E for each transition and its refusal |
| W2-03 | applicant | Campaign catalogue and detail at `/campaigns/:publicCode`, deep-linking into apply | `listCampaigns`, `getCampaignDetail` | E2E: anonymous browse → apply |
| W2-04 | applicant | Apply journey proven: onboarding (non-enumerating copy, lockout, expired OTP), campaign-bound submit, replay (same key) and key reuse (different body) | the identity ops, `submitMyApplication` | The `citizen-journey` `fixme` is retired |
| W2-05 | applicant | Document checklist (citizen view): "received" is not "verified", no lane or score shown, and "bring paper" items flow into the Exam Pass "what to bring" list | `getMyDocumentChecklist`, `uploadMyDocument` | E2E for each item state |
| W2-06 | applicant | Tracker with `toCitizenStage`, using the top-level status only. The per-gate detail is marked `blockedBy: B-2`. Withdrawn vs auto-withdrawn wording. | `listMyApplications` | Exhaustive projection unit test plus E2E |
| W2-07 | applicant | Exam Pass E2E across all states, including `ADMITTED`, download/print, and `no-store` asserted on the API read | `getMyExamInvitation` | E2E |
| W2-08 | field | `/setup` device readiness check (§2.5), plus device enrolment with a WebCrypto non-extractable Ed25519 key | `enrollFieldDevice` | E2E for enrolment and each readiness failure |
| W2-09 | field | Station picker plus Gate (online) plus Paper documents | `admitAtGate`, `getDocumentChecklist`, `verifyDocumentAtVenue` | E2E: admit → mark paper |
| W2-10 | field | Physical station: a single-candidate capture written to the ledger first, signed, sent online, with the per-record ack shown | `syncFieldScores` | E2E: accepted, rejected-validation and not-admitted paths. A network drop leaves the record `LOCAL_ONLY` with the paper prompt. |
| W2-11 | field | Medical station for **one** pilot agency | `recordMedicalReview` | E2E |
| W2-12 | field | Supervisor sync centre and conflicts | `resolveFieldSyncConflict` | The `offline-conflict` `fixme` is retired, or kept as BLOCKED with its reason |
| W2-13 | all | **Journey E2E**: a cross-app Playwright project against `tooling/edge-dev` that runs publish → apply → (harness-driven eligibility events) → Exam Pass READY → gate → physical → medical → final → accept → citizen sees the outcome. It asserts one application, one admission and one score, and that the correlation id is constant. | — | Green in CI and attached to the evidence bundle |

**Exit gate:** the baseline's Wave 2 gate (a single synthetic candidate traced end to end, no duplicates, honest notification and sync state), with field capture explicitly online-only.

---

## 7. Dependencies outside this repo for Waves 0–2

### Backend asks

| ID | Ask | Needed by | Workaround until then |
|---|---|---|---|
| BE-01 | Emit `x-usrp-permission` (and the outcome unions) per edge operation in the OpenAPI | W0-06 | Compare permissions against `shared-auth` by hand |
| BE-02 | Officer application list: cursor, filters, total (B-8 in the baseline's FE list) | W1-02 | A "first 100" notice |
| BE-03 | Venue/session read, scoped to campaign/day (B-5/B-6) | W2-08 venue pick, W1-08 roster pre-fill | A typed venue name plus a blank roster |
| BE-04 | Edge-dev harness hooks to emit eligibility and slot events for a test applicant | W2-13 | — (this is a blocker for the journey E2E) |
| BE-05 | Confirm that `enrollFieldDevice` accepts a WebCrypto-exported raw Ed25519 public key | W2-08 | — |

### Owner decisions (from baseline §12, the ones that block Wave 2)

1. **Pilot agency and district.** This fixes the medical mode for W2-11 and whether the walk-in station is in scope.
2. **Paper fallback procedure.** Sheet fields, serials, custody and the dual-entry rule (W1-08).
3. **Assisted desk model.** Staff use the applicant portal under the citizen's own OTP session on a desk device, or need a backend "assisted" channel with attribution. The second is a new backend capability.
4. **Who may enrol devices** at the pilot (screening officer vs supervisor).
5. **Operator relocation (B-12a) is backend NEW and baseline P1.** No frontend work can start until its API exists, so it is tracked as a pilot blocker, not a Wave 2 task.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| ADS licence ruled against later (D1) | ADR-FE-008 sets a review date. Domain logic stays out of the ADS composition files (features keep model and API separate from UI), so a swap only touches the UI layers. |
| The capped list is mistaken for complete data | W1-02 adds the notice, and an E2E asserts it |
| IndexedDB eviction on pilot devices | Readiness check plus persistent storage. Pilot capture is online-first. Paper fallback. Durable offline waits for Wave 4 proof. |
| Field-station becomes a second officer console | The boundary rule restricts which slices it may compose. Its manifests declare `audience: field`. |
| Docs drift again | FE-012 requires counts and SHAs to come only from the CI bundle |

---

## 9. Waves 3–6 (outline)

- **Wave 3 — applicant and studio completeness.**
  - Eligibility pre-check (needs B-7)
  - Gate-level tracker (B-2)
  - Notice inbox (B-8)
  - Policy diff, capacity indicators (B-6), admin all-state campaign list
  - List cursor and filters wired (BE-02)
- **Wave 4 — durable offline.**
  - Offline gate roster (B-5)
  - Heat/bib timing for the 3 km run
  - Offline capture with replay and record-by-record sync
  - Restart, eviction and clock-skew drills
  - `OFFLINE_CAPTURE_CAN_SYNC` flips to `true` in the same change as the proof
  - Native wrapper spike behind the `StoragePort` and `SignerPort`
- **Wave 5 — operations and governance.**
  - Command dashboard (B-1), live venue board
  - Device fleet and revoke (B-4)
  - Roster and stations (B-9)
  - Audit explorer (B-10)
  - DPO queue (B-13)
  - Purpose-of-access reveal
  - Run sheets
- **Wave 6 — reach** (each needs an owner decision first):
  - Outcome letters (B-11)
  - Amber re-upload
  - Applicant-requested reschedule
  - Campaign alerts
  - USSD
