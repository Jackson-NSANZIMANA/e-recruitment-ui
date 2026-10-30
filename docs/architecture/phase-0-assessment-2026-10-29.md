# Phase 0 assessment — the frontend boundary

**Date:** 2026-10-29
**Scope:** `Jackson-NSANZIMANA/e-recruitment-ui` (this repository) at `main` = `bc05403`, plus the open drafts
FE #45, FE #46, FE #47 and backend #53.
**Question answered:** the owner's full-system evaluation of 2026-10-29 rates the system at ≈50% deployable and
opens **Phase 0** with eleven defects and five merge actions. This document says which of those land in this
repository, what is actually true of each today, what the ordered path to "Phase 0 closed" is, and which steps
are blocked outside this repository.
**Companion documents:** [`frontend-architecture.md`](./frontend-architecture.md) (baseline),
[`edge-contract.md`](./edge-contract.md) (browser boundary), backend `docs/program/ROADMAP.md` §8.3 (the wave plan).

---

## 1. How this was measured

Everything below was produced by running the repository's own gates, not by reading its claims:

| Command | What it proves |
|---|---|
| `pnpm --filter @usrp/contracts run verify -- --backend <checkout>` | determinism, drift gates A–E, fixture round-trip, zod parity, proposed isolation |
| `pnpm typecheck` / `lint` / `test` | 23 / 21 / 21 workspace packages |
| `pnpm surface:verify`, `pnpm verify:hygiene`, `pnpm verify:rules` | every route has a manifest; static boundaries |
| `VITE_EDGE_URL=… pnpm build && pnpm size` | the production bundles and their gzip budgets |
| the same commands again on `git worktree add` copies of `origin/feat/s12c-sandbox-ui` and after a scratch re-pin | what each draft will do once rebased |

Environment caveats, stated because two of them changed a result:

- **Sandbox: 3 GB RAM, 4 cores, Node 22.22.3.** CI pins **Node 24**. `pnpm typecheck` at default parallelism was
  OOM-killed (exit 137) here and passes with `--concurrency=1`; that is this sandbox, not the repo.
- **No browser binaries.** `PUPPETEER_SKIP_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` during install, so the
  Playwright/axe jobs were **not** re-run locally. Their CI results are quoted, not reproduced.
- **`VITE_EDGE_URL` is required to build** (`apps/*/vite.config.ts` refuses without it). A local build without it
  fails for a reason that has nothing to do with the branch under test.

---

## 2. The gate picture today

`main` is green on every gate available here. That sentence is worth less than it looks, and §5.1 says why.

| Gate | `main` | FE #45 | FE #46 | FE #47 |
|---|---|---|---|---|
| contracts verify (pinned backend) | PASS — 3078 assertions | **FAIL** — 2 gates | PASS | PASS (CI) |
| typecheck / lint / test | PASS | PASS (locally) | PASS (CI) | PASS (CI) |
| surface:verify | PASS | PASS | PASS | PASS (CI) |
| hygiene / rules | PASS | PASS | PASS | PASS (CI) |
| build + bundle budget | PASS — applicant-portal 293.9/300 KB | **FAIL** — 302.1/300 KB | PASS (CI) | PASS (CI) |
| Playwright E2E | not re-run | CI: skipped | CI: PASS | CI: PASS |
| mergeable | — | BLOCKED | **BEHIND** | CLEAN |

The two FE #45 failures are the whole reason Phase 0 step 5 is not already done; §4 takes them apart.

---

## 3. Phase 0 through this repository's boundary

The evaluation's Phase 0 has five items. Four are backend work. This table says what each one requires of the
frontend, what state that part is in, and what "done" means here.

| Item | Type | Frontend work | State today | Acceptance (in this repo) |
|---|---|---|---|---|
| **D1** — `sms_notification_status` missing from `rnp_ops`/`rcs_ops` | backend migration + application-service | none directly. `SLOT_ASSIGNED` is not a status the console renders differently per agency, and no browser type carries the column. | nothing to do | a re-pinned drift run stays green after the migration lands |
| **D2** — dead-lettered Irembo 429/503 never re-driven | backend background-vetting | none directly, but it decides what "verifying" means on screen. The citizen's checklist `clearance.state` is `VERIFYING` while the event is queued **and** while it is dead-lettered — the citizen screen cannot tell "working" from "lost". | no distinction exists in the contract (`ClearanceItem.state`) | when the backend adds a terminal state or an age-based escalation, this repo has one enum entry to add and one locale string per language. Until then a citizen waiting on a dead-lettered event sees an honest "verifying" and no way to escalate — record it as a **accepted, documented** gap rather than a silent one |
| **D7, D8, D9** — forensics 400→503 mapping, duplicate-upload dedupe, sandbox edge on `0.0.0.0` | backend identity/forensics/sandbox | none. D7 and D8 are upstream of the edge; D9 is a sandbox bind address. | nothing to do | after the backend fix, the citizen documents screen shows the real refusal code instead of a generic failure; add one fixture per new code |
| **D10** — no officer operation resolves a criminal-clearance `UNDER_REVIEW` | backend **and** S06 screen | **real, unbuilt, and worse than reported** — see §5.2. The screen offers actions the backend refuses and never says why the row is in the queue. | **open** | (a) the officer can see *why* a criminal/NESA hold is in the queue (closed reason codes the backend already serves), (b) no dead action is offered on a row the backend cannot act on, (c) once the backend ships the resolving operation, one typed operation + one confirm flow + trilingual copy + states, proven by a surface manifest at `E2E-PROVEN` |
| **D11** — `POST /field-sync/scores` 500s on a non-UUID `capturingOfficerId`; the edge session carries no officer subject | backend edge + field-sync, with a frontend half | FE #46 already stops the 500: the capture is attributed to a per-tablet pseudonymous UUID, with the defect written down in `packages/features/field-ops/src/model/field-sync.ts` (`stationActorId`). The four-eyes rule **cannot** be checked from the payload until the edge session exposes the officer's opaque id. | **open, documented, correctly scoped** | when the edge session carries the officer subject: replace the pseudonym with it, keep the tablet id, and add the negative four-eyes proof (confirmer ≠ capturing officer). No frontend change is possible before that; do not invent a client-side identity |
| **Step 5** — merge the drafts | cross-repo | FE #45, #46, #47, and the backend pin | #47 clean, #46 green/behind, #45 blocked | see §4 and §6 |

**Conclusion for this repository:** D1, D7, D8 and D9 need nothing from us. D2 and D11 have a frontend edge that is
already honestly documented. **D10 is the one Phase 0 item that requires real frontend construction**, and Step 5 is
where this repository currently holds up the programme.

---

## 4. The draft queue, measured

### 4.1 FE #45 (S12c UI) — blocked, and the reason is a stale pin, not the branch

CI: `Quality Gate`, `Contract drift vs pinned backend`, `Build and production proof` and `Evidence bundle` fail;
`Evidence bundle` and `Quality Gate` are cascades. Both real failures reproduce locally:

**(a) Contract drift — 5 findings.** The branch documents two backend routes and one edge operation that the
*pinned* backend does not serve: `POST /v1/applicants/me/applications/clearance-certificate`,
`POST /v1/applications/clearance-certificate-own`, `GET /edge/v1/me/identity`. Two of those three exist on backend
`main`; the pin is three backend merges old. **The branch is right and the pin is wrong** — which is why the
failure reads so confusingly (gate A calls the route "extra", gate B says the backend serves it and nobody
documents it).

**(b) Determinism — 2 files.** `application-service.types.ts` and `application-service.zod.ts` cannot be regenerated
byte-identically: the branch edited `packages/contracts/openapi/application-service.yaml` and did not run
`pnpm --filter @usrp/contracts run generate`. This is the failure mode the gate exists for, and it is a
`git checkout -- packages/contracts/src/generated && pnpm generate` away from closing.

**(c) Bundle budget — over by 2.1 KB.** `apps/applicant-portal`'s entry chunk is **302.1 KB gzip against a 300 KB
ceiling**; `main` is at 293.9. The branch's new `/documents` route is not lazy-loaded, so it lands in the entry
chunk. The fix is a `lazy(() => import('./routes/documents.js'))` registration next to the five existing ones in
`apps/applicant-portal/src/app.tsx:28-33` — not a raised ceiling. (`AGENTS.md` §3 and `gates.config.json` both treat
raising it as a user-cost decision, and rightly.)

**Forecast, measured not guessed.** I applied this session's re-pin (commit `7ebe107`) to a scratch copy of the
branch and re-ran the same command CI runs. Findings drop from **5 to 3**:

| After rebase on `7ebe107` | Gate | Owner |
|---|---|---|
| `getMyIdentity` documents `GET /v1/applicants/me/identity`, which the backend does not serve | A | BE #53 |
| `GET /edge/v1/me/identity` has no backend edge entry | D | BE #53 |
| `POST /v1/applications/clearance-certificate-own` served and undocumented | A | **already fixed by `7ebe107`**; rebase drops it |

So **one third-party merge (BE #53) plus two one-line fixes inside #45 close it entirely.** #45 does not need
redesign; it needs its pin, its generator run and its route split.

### 4.2 FE #46 (S08 Field Station) — green, and BEHIND

Every check passes, including Playwright and the three SPA image builds. `mergeStateStatus: BEHIND` means the base
moved and branch protection requires an up-to-date head: it needs a rebase (or a merge of `main` into it), then it
can land. Nothing in it is Phase 0 content, but it carries two Phase 0-adjacent artefacts worth keeping:
the D11 pseudonym with its hand-off comment, and `resolveFieldSyncConflict` becoming a typed call site.

### 4.3 FE #47 (invalid-phone message) — clean

Green, mergeable, one line. It is the only draft that can land today without help.

### 4.4 BE #53 (S12c backend) — the actual dependency

FE #45's remaining two findings are both `getMyIdentity`. That route exists only on `feat/s12c-policy-v2`.
Until #53 merges, #45 cannot be green at any pin, and no amount of frontend work changes that. **Phase 0 step 5 is
gated on a backend merge for exactly one route.**

---

## 5. What this assessment found beyond the owner's list

### 5.1 FINDING: `main` was green because its pin was stale

`main` pinned backend `cd49628`. Backend `main` is `d0ef603` — S12b (#52), the OTP fix (#56) and two docs merges
ahead. Re-running `verify` unchanged against the current backend produced **3 findings on `main`**:

```
gate B: [identity-service]     NEW BACKEND ROUTE, undocumented: POST /v1/applicants/me/applications/clearance-certificate
gate B: [application-service]  NEW BACKEND ROUTE, undocumented: POST /v1/applications/clearance-certificate-own
gate D: [edge-gateway]         MISSING FRONTEND EDGE OPERATION: POST /edge/v1/me/applications/clearance-certificate (attachMyClearanceCertificate)
```

The last one is not paperwork: it means **no citizen screen could reach the clearance-certificate route the backend
ships and the product needs**. The pin, not the code, was hiding it.

This is the repository's own stated failure mode (*"a gate scoped away from the code it describes is a comment"*)
in a new place. The pin is a piece of evidence, and nothing was checking that it was current. §6 step 1 fixes the
instance; §6 step 6 adds the missing check.

### 5.2 FINDING: D10 is worse at the boundary than "nothing acts on it"

The evaluation says the amber queue shows a criminal-clearance hold and nothing acts on it. Measured against
backend `d0ef603` and the console's source, three separate things are true:

1. **The row reaches the queue.** `application-read.pg-repository.ts:103` adds criminal `UNDER_REVIEW` and
   NESA-review rows to the same read as document holds.
2. **The backend now says why** (`application-read.pg-repository.ts:316` → `reasons: queueReasons(row)`, closed
   codes: `CRIMINAL_RECORD_REVIEW`, `CLEARANCE_CONTENT_REVIEW`, `IDENTITY_NAME_PARTIAL`, `IDENTITY_HOLDER_UNREADABLE`,
   `NESA_*`). **The console drops the field**: `AmberQueueEntry` in `packages/api-client/src/wire.ts:87` has no
   `reasons`, and `decodeAmberQueue` (`decode.ts:166`) never looks for one. An officer sees an unexplained row.
3. **The console offers decisions the server refuses.** `packages/features/adjudication/src/model/amber.ts:1` types
   `AmberRow.status` as `DocumentReviewAmber | AdjudicationReview`; the backend serves rows at `CRIMINAL_CLEARANCE`
   (`lifecycle.ts:145`). Any non-amber status is classified `ADJUDICATION` by `holdKindOf`, so the row lands on the
   Holds tab, where `rowTransitions` (`queues.ts:28`) offers `clear` and `reject` unconditionally. The backend's
   adjudicate transaction accepts only `DOCUMENT_REVIEW_AMBER` and `ADJUDICATION_REVIEW`
   (`officer-transition.pg-repository.ts:52`) and answers `NOT_APPLICABLE`. **The officer is shown a button whose
   only outcome is a refusal, on a row whose reason is hidden.**

So D10's frontend half is not "add a screen". It is: *stop lying about the row you do have*, and then add the
resolving operation when the backend ships it. §6 orders it that way because the first half is unblocked today and
the second half is not.

### 5.3 FINDING: the applicant portal has 6 KB of headroom and every citizen screen spends it

| | entry chunk (gzip) | ceiling | headroom |
|---|---|---|---|
| `main` | 293.9 KB | 300 KB | 6.1 KB |
| FE #45 | 302.1 KB | 300 KB | **−2.1 KB** |

`main` is green and one screen from failing. S10a/S10b (citizen timeline and notices) is on the Phase 2 critical
path and will hit this wall immediately; D10's S06 screen will hit the officer console's ceilings (733/1200 total,
431/500 largest) the same way. This is a budget that has to be spent deliberately — route-level lazy imports and a
narrower ADS surface — not discovered by a red check on the day a feature is due.

---

## 6. The path to Phase 0 = 100%

Ordered by dependency, not by preference. Each step names its proof; a step is not done until the proof is in the
evidence bundle.

**Step 1 — Re-pin to the backend the services actually run. ✅ done in this branch (`7ebe107`).**
Pin `ci.yml`, `paths.ts`, the eleven OpenAPI documents, `route-manifest.json` and the six surface manifests together;
document the S12b clearance-certificate pair; add the edge registry entry; regenerate; add fixtures for every new
2xx (the gate refuses an unexercised success shape).
*Proof:* `contracts verify --backend d0ef603` → **ALL GATES GREEN, 3175 assertions**; typecheck/lint/test 23/21/21;
surface and hygiene PASS. Verified in this sandbox at Node 22; CI re-runs it at 24.

**Step 2 — Land FE #47.** One line, green, no dependencies.
*Proof:* `gh pr merge 47 --merge`.

**Step 3 — Rebase and land FE #46.** Then confirm the two D11 artefacts survived the rebase
(`stationActorId` with its hand-off comment; the typed `resolveFieldSyncConflict` call site).
*Proof:* CI green on the rebased head, including Playwright.

**Step 4 — Land BE #53, then make FE #45 green.** #45's two remaining findings are `getMyIdentity`, which only #53
serves. Once #53 merges: re-pin again to the new backend head, then in #45 (a) rebase on this branch's re-pin so the
`clearance-certificate-own` finding and the generated-file drift disappear, (b) `lazy()`-load `/documents`, (c) run
the generator. *Do not* raise the bundle ceiling.
*Proof:* `contracts verify --backend <new head>` green; `pnpm size` with applicant-portal's largest chunk < 300 KB;
Playwright green on both specs the branch adds.

**Step 5 — D10 part 1, unblocked: make the queue honest (frontend-only, no backend ask).**
Carry `reasons` through `wire.ts` + `decode.ts`; widen `AmberRow.status` to any status the queue actually serves and
classify a hold as `DOCUMENT | ADJUDICATION | CLEARANCE | NESA`; render the reason code in words, trilingually; and
**offer only the transitions the server accepts** for the hold kind, with an explanatory disabled state for the
clearance/NESA holds that currently have no resolving operation.
*Proof:* unit tests on the classifier (one per hold kind, including an unknown status), a mocked E2E per hold kind,
a surface manifest at the rung the E2E proves, and a negative test asserting CLEAR/REJECT are unreachable on a
clearance hold.

**Step 6 — Close the hole in step 1: make a stale pin go red.** Today the pin is checked for *agreement* between
`ci.yml`, `paths.ts` and the OpenAPI documents (`tooling/ci/evidence-bundle.mjs:pinAgreement`) but never for
*currency*. Add a check that the pinned SHA is an ancestor of the backend's current `main` (CI already checks the
backend out; one `git merge-base --is-ancestor` in the contract-drift job, reported at the `Quality Gate`).
*Proof:* the drift selftest gains a case that goes red on a non-ancestor pin; the check runs in CI on every PR.

**Step 7 — D10 part 2, blocked on the backend: the resolving operation.** When the backend ships it, add the typed
operation, the confirm flow with its destructive-confirmation state, the trilingual copy, and the `NOT_APPLICABLE` /
`409 AGE_PENDING` / forbidden states the surface manifest requires.
*Proof:* surface manifest moved up the readiness ladder by proof, not by edit; live sandbox journey green.

**Step 8 — D2, D11: record what is accepted.** D2's citizen consequence (`VERIFYING` covers both "working" and
"lost") and D11's four-eyes gap belong in the document that a reader will find, with the date and the owner, so
neither can be mistaken later for an oversight. Prefer one line in this file plus the existing in-code hand-off
comments over a new document.

**Phase 0 is 100% when:** the seven drafts are merged or closed with a stated reason; `main`'s pin equals the
backend head and a stale one is a red check; D10 part 1 is proven by tests, E2E and a surface manifest; and every
remaining Phase 0 defect has an owner and a date in one place.

---

## 7. What changed in this branch

Commit `7ebe107` — *chore(contracts): re-pin to backend d0ef603 and document the S12b clearance-certificate pair*.
It is Step 1 above: pin, route manifest, both clearance-certificate operations with their full outcome sets,
the `ClearanceItem` block on the RIB checklist item, one typed operation, one mutation hook, one explicit
no-invalidation entry, and eleven fixtures (three negative — two of them exist only to keep the certificate number
and the officer's review reasons out of a browser).

Why it is safe to land without #45: it changes no screen. It makes the registry match the backend, which is the
condition every later step needs.

---

## 8. Traps for whoever takes the next step

Each of these cost time in this session; none is obvious from the code.

1. **The pin is six files, not one.** `ci.yml` `BACKEND_SHA`, `paths.ts` `EDGE_BACKEND_SHA`, every
   `openapi/*.yaml` `x-usrp-backend-sha`, `route-manifest.json` `backendSha`, and the six `docs/ui-surfaces/*.json`
   `readiness.evidence.contract` values (the surface tool **refuses** a manifest whose contract SHA is not the pinned
   one). Change any five and the sixth fails in a different job.
2. **`route-manifest.json` is hand-mined and drives gates A and B.** Regenerating OpenAPI is not enough; the manifest
   entry needs the real path constant and controller filename, which gate B checks against the backend source.
3. **The fixture gate requires a fixture for every 2xx body.** "No fixtures" is not a warning here — an operation
   without one cannot be verified (`An unexercised success shape is an unproven one`).
4. **`pnpm build` refuses without `VITE_EDGE_URL`**, and `pnpm size` reads the build output. Both failures look like
   build bugs and are configuration.
5. **This sandbox OOMs `turbo run typecheck` at default parallelism** (exit 137). Use `--concurrency=1` before
   concluding a typecheck failure exists.
6. **`--frozen-lockfile` install needs browser downloads disabled** here
   (`PUPPETEER_SKIP_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`), so Playwright jobs must be read from CI.
7. **A green contract gate says the pin agrees with itself.** Until Step 6 lands, check currency by hand:
   `git merge-base --is-ancestor <pinned> <backend main>`.
