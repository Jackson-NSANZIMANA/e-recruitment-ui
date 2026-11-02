# FE-P0 — frontend baseline and contract blockers

**Status: BLOCKED / draft evidence; not a contract reconciliation or release approval.**
**Inspected:** 2026-11-01. Frontend main and baseline checkout: `2b9fe322f8b7a3c225b51f68e3d495d3f03a4eeb`. Backend main and inspection checkout: `e887c768989acd2bca9824a15e8f6d0fab50178c`. Current frontend pin: `b004fca840af12435bbc84ec0e365c513c788c36`.

The attached *USRP Frontend Engineer — Execution Charter* requires the integration authority to confirm the backend SHA **before committing a re-pin** and provide a complete versioned contract packet. `e887c768` is an inspection target, not an assumed approved release revision. The frontend and backend default-branch heads were independently rechecked; the backend comparison reports 26 commits and 139 changed files from the current pin. The pin is an ancestor of the inspection target. No deployed backend revision was checked. The [official roadmap](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/docs/program/ROADMAP.md) governs milestone order: M1 staff, M2 online exam day with paper, M3 staging/recovery, M4 pilot decision, M5 durable offline/native and later biometrics.

No feature code, contract pin, generated schema or readiness manifest is changed in this report. No Phase 2 work should start before FE-P0 is reviewed and merged. The frontend is three PWAs with feature slices and a single `/edge/v1/**` operation-ID boundary; the server determines agency, permissions and lifecycle. Cookies remain httpOnly; do not expose upstream credentials, fabricate identity, add generic status writes or automatic write retries. `OFFLINE_CAPTURE_CAN_SYNC` stays false.

## 1. Executed baseline

Environment: Linux sandbox, Node `v24.22.2` installed from the npm `node@24` package, pnpm `9.15.0`, exact frontend baseline above; checkout also had an untracked earlier architecture plan, with no tracked changes. `VITE_EDGE_URL=http://localhost:4021` was set only for proof builds, matching CI's mock harness; it is not a deployment or live-edge claim. Browser downloads were skipped at install. Commands below were run before changing frontend code. Full local command logs are in `/home/user/usrp-proofs/` in this session; CI artifacts must be collected separately for the eventual PR head.

| Command | Exit | Result and scope |
|---|---:|---|
| `PUPPETEER_SKIP_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile` | 0 | Lockfile installed, browser binaries intentionally not downloaded. |
| `pnpm verify:rules` | 0 | 2 tests passed. |
| `pnpm verify:hygiene` | 0 | Static gates pass; output notes 4 recorded script-coverage gaps, so lint/test do not cover every package. |
| `pnpm surface:verify` | 0 | Static manifest gate passed; output reports numerous typed-but-undecoded operations. This is not live readiness evidence. |
| `pnpm --filter @usrp/contracts run drift:selftest` | 0 | 50 selftest assertions. |
| `pnpm --filter @usrp/contracts run verify -- --backend /home/user/backend-pin` | 0 | `b004fca` checkout, 3217 assertions, including determinism and drift. Old-pin proof only. |
| `pnpm --filter @usrp/contracts run verify -- --backend /home/user/backend-reference` | 0 | `e887c768` checkout, 3219 assertions. **Not proof of complete compatibility:** the manifest remains pinned to `b004fca` and important dimensions are notes/not compared, below. |
| `pnpm --filter @usrp/contracts run drift --backend /home/user/backend-reference` | 0 | Gates A–E ran, 1463 assertions, 0 findings and 36 notes. Gate E explicitly says adjudication request and outcomes are **not compared**; several other request/outcome mappings are also missing, and a known submit schema divergence is downgraded to a note. The test does not validate the backend checkout SHA against the manifest pin. |
| `pnpm typecheck --concurrency=1` | 0 | 23/23 workspace tasks. |
| `pnpm lint --concurrency=1` | 0 | 21/21 tasks. |
| `pnpm test --concurrency=1` | 1 | Invocation error: pnpm interpreted `--concurrency` as its own option. Not a test result. |
| `pnpm exec turbo run test --concurrency=1` | 0 | Corrected run, 21/21 tasks. Does not cover the script gaps noted by hygiene. |
| `pnpm build --concurrency=1` | 0 | Three production app builds, local mock-origin configuration; not a deployment. |
| `pnpm verify:extraction` | 0 | Build-time compiled extraction passed for all three apps. |
| `pnpm size` | 0 | All three app bundles within checked budgets. |
| `pnpm security:scan` | 1 | Static checks passed; script reported 7 high-or-above advisories; Trivy skipped because no binary or Docker was available. `pnpm audit --audit-level high --json` separately reported 7 high and 2 critical in metadata, including Storybook advisories `GHSA-f2ph-cmg5-wxc8` and `GHSA-px85-f4q5-jh77`. Triage dependencies and the differing aggregate counts; do not call security green. |
| `pnpm test:e2e --concurrency=1` | 1 | Field Station Playwright could not launch: Chromium executable missing. 12 tests marked skipped; Turbo stopped before the two other apps' browser tasks. Mocked E2E, live backend, tablet and full browser coverage are not proven. |
| `pnpm a11y` | 1 | Storybook built; browser/dependency installation failed (apt packages unavailable). No accessibility pass. |

The browser installer accesses external download hosts not available in this sandbox; repeat in the supported CI environment. No live edge, Postgres/Kafka/object-store, device or operational rehearsal was run. Source inspection is not an integrated test. The exact PR head must have a fresh CI evidence bundle; this baseline is not that bundle.

## 2. Operation deltas and contract blockers

All backend facts below refer to `e887c768`, the **inspection** SHA. The backend's [D10](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/docs/program/handoffs/D10-vetting-hold-screen.md), [D11](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/docs/program/handoffs/D11-field-score-sync-state.md) and [D8](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/docs/program/handoffs/D8-document-revision.md) handoffs are useful but do not constitute the complete FE-P0 packet required by the charter. Resolve implementation/prose disagreement at the authority boundary.

| ID / surface | Operation and present seam | Required authority decision / proof before change |
|---|---|---|
| **P0-01: approval and parity** / all | CI `BACKEND_SHA`, `packages/api-client/src/paths.ts`, `tooling/contract-drift/route-manifest.json`, OpenAPI and some surface evidence still reference `b004fca`. Existing parity notes omit request/outcome checks. | Integration authority confirms immutable backend SHA and issues a versioned packet for every affected operation, including permissions, CSRF, full wire/outcome shapes, idempotency, sources and proof. Reconcile all artifacts atomically; run red/green coverage including checkout-SHA identity. No re-pin until confirmation. |
| **P0-02: D10** / officer amber queue and workspace | `listAmberQueue`: `GET /edge/v1/applications/amber-queue`, officer, `adjudication.read`. `adjudicateApplication`: `POST /edge/v1/applications/adjudicate`, officer, `adjudication.decide`, CSRF, non-retryable. Frontend `packages/api-client/src/wire.ts` lacks `heldLanes` and `AdjudicateInput.lane`; `packages/features/adjudication/src/model/amber.ts` and `src/ui/QueuesPage.tsx` classify/display holds. Backend edge projection and [ADR-051](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/docs/architecture/adrs/ADR-051-vetting-hold-resolution.md) use `DOCUMENT`, `CRIMINAL`, `ACADEMIC` lanes and one decision verb. | Packet must enumerate valid request/response fields and current errors, including concurrent/stale and SoD cases, and define decoder behavior. Tests: lane round trips, multi-lane queue and selection, 409 lane-required/stale, 403 four-eyes, denied/cross-agency access, late-verdict replay and live locked transaction. Do not invent a second hold operation. |
| **P0-03: D11** / Field Station `/physical` | `syncFieldScores`: `POST /edge/v1/field-sync/scores`, officer, `field.score.sync`, CSRF, non-retryable. This registry route differs from the D11 prose handoff's `/edge/v1/field-scores/sync`. `physical.tsx` calls `stationActorId()` in `packages/features/field-ops/src/model/field-sync.ts`; `packages/auth/src/session.ts` exposes no subject. Backend rejects a validly signed record whose actor differs from the authenticated officer. `packages/field-ledger/src/sync-mapping.ts` treats reasons as open strings. | Backend/integration authority must deliver an agreed, safe officer-only subject projection on `readSession`, source and response schema, and resolve the path discrepancy in the packet. No JWT, session handle, private key or local invented identity. Tests: match accepted, valid signed mismatch rejected/audited with no write, missing/changed session fail closed, mixed batch, agency, malformed signature and unknown outcomes, plus real edge-to-service proof. Existing local pseudonymous records need an approved disposition, not reassignment. This is a release blocker for scoring. |
| **P0-04: D8** / applicant upload | `uploadMyDocument`: `POST /edge/v1/me/applications/documents`, applicant, CSRF, non-retryable. Frontend `packages/api-client/src/wire.ts` lacks `revision`; applicant document flow consumes this type. Forensics returns revision, but backend identity [gateway](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/document-upload.http-gateway.ts) and [controller](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/http/applicant-documents.controller.ts) rebuild responses without it; refusal relays the error code but not upstream `reason`. The D8 prose therefore does not describe the actual citizen door. | Backend owner must reconcile and ship safe revision and any approved reason propagation, OpenAPI and packet. Establish an actionable reviewed-document correction process; `document.reopen` is not shipped. Tests: first/changed/identical bytes, review lock and case-advanced, concurrent replacement/review, edge leak guards for HMAC and forensics, UI error recovery. Revision alone is not an explicit identical-retry flag. |
| **P0-05: walk-in** / `/walk-in` → `/physical` | `registerWalkIn`: `POST /edge/v1/applications/walk-in/register`, officer, `walkin.register`, CSRF, non-retryable. `packages/features/field-ops/src/routes/walk-in.tsx` displays the returned code; `src/model/ticket.ts` and `packages/field-ledger/src/slot-token.ts` parse structured `USRP-SLOT.v1` claims. Backend [walk-in service](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/application/walk-in.service.ts) issues a random opaque code. The [field score store](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/field-sync-service/src/adapters/field-score-store.pg.ts) compares the supplied value to the issued code; it does not itself verify the full signed slot credential. | Backend and operations authority must sign off one credential, issuer, venue/day/agency binding, issuance/revocation/expiry, admission and score validation, RDF-only behavior and venue context without a fake scheduled reservation. Tests: real registration → vetting → scan → score → projection, tampering, expiry, wrong agency/venue/day, supersession, RNP/RCS refusal and scheduled-pass regression. No frontend-invented pass. |

Existing D10/D11/D8/walk-in code can be investigated and red reproducers designed while awaiting the packet; unsupported behavior cannot be implemented or declared complete. The D0 reconciliation explicitly reports unbuilt `fault-and-recover` and other live proof limits; no frontend result substitutes for that evidence.

## 3. Route and readiness inventory

The table transcribes manifest claims, not newly verified readiness. `E2E` below means the file claims `E2E-PROVEN` with historical test references; it does **not** prove compatibility with `e887c768` or a live backend. Some officer manifests explicitly cite `b004fca`; the others do not record a backend SHA. Recalculate affected claims only when their evidence is rerun against an approved contract. The [surface verifier](../../tooling/surface-contract/src/verify.ts) checks manifest structure and references, not a live system.

| Surface ID | App routes | Recorded rung |
|---|---|---|
| citizen.applications | `/status`, `/applications` | SCREEN-BUILT |
| citizen.apply | `/apply`, `/apply/:step` | E2E |
| citizen.documents | `/applications/:applicationId/documents` | E2E |
| citizen.exam-pass | `/applications/:applicationId/exam-qr` | E2E |
| citizen.home | `/home` | SCREEN-BUILT |
| citizen.sign-in | `/login` | E2E |
| citizen.withdraw | `/my/withdraw` | CLIENT-WIRED, blocked by S10b |
| field.check-in | `/check-in` | E2E |
| field.conflicts | `/conflicts` | E2E |
| field.gate | `/gate` | E2E |
| field.medical | `/medical` | E2E |
| field.physical | `/physical` | E2E |
| field.setup | `/setup` | E2E |
| field.sign-in | `/login` | E2E |
| field.stations | `/stations` | E2E |
| field.supervisor | `/supervisor` | E2E |
| field.walk-in | `/walk-in` | E2E |
| officer.activate | `/activate` | E2E, old pin |
| officer.amber-queue | `/adjudication`, `/adjudication/amber-queue` | E2E, old pin |
| officer.application-workspace | `/applications`, `/applications/:id` | E2E, old pin |
| officer.campaign-studio | `/campaigns`, `/campaigns/new`, `/campaigns/:publicCode` | E2E, old pin |
| officer.dashboard | `/dashboard` | E2E |
| officer.erasure-queue | `/compliance`, `/compliance/erasure-queue` | E2E, old pin |
| officer.field-station-notice | `/field-station`, `/gate`, `/walk-in` | E2E |
| officer.sign-in | `/login` | E2E |
| officer.staff | `/staff` | E2E, old pin |
| officer.verify-invitation | `/scheduling/verify-invitation` | DECLARED, blocked by S08 |

The manifest inventory is not an independent audit of every router mount or redirect. The 68 current registry entries and operation metadata are in [`paths.ts`](../../packages/api-client/src/paths.ts); [surface manifests](../ui-surfaces/) map operations to screens. Permissions must be verified against the approved packet and server, not inferred from frontend guards. Feature locale directories exist for adjudication, applications, campaigns, compliance, field-ops, identity and scheduling; completeness and native-speaker review were not evaluated in this run.

## 4. Remaining FE-P0 exit work

1. Obtain explicit authority confirmation of the exact backend SHA and the complete, source-reconciled FE-P0 packet, including the D11 subject and walk-in decision. Update the blocker register if the agreed SHA changes.
2. For each used operation, compare method/path, session, permission, CSRF, request/response, error union, idempotency/retry and invalidation; upgrade the verifier to fail for missing required coverage rather than interpreting notes as full parity. Reconcile only approved, shipped contracts. Preserve red reproductions and negative security tests.
3. Resolve backend-owned D8 and D11 changes and walk-in contract; remove local actor fabrication only when authenticated subject metadata exists. Update OpenAPI, generated artifacts, registries, client decoders and fixtures as one reviewed unit; do not manually edit generated outputs.
4. Rerun and reconcile affected surface readiness, build, bundle, unit/type/lint/hygiene/contract checks, browser/a11y/security gates, and live integration evidence. Run each against the exact candidate revisions; record skipped or failed checks, CI links and backend/deployment identity.
5. Obtain green required PR-head CI and review. The current baseline has blockers and is **not** a completed FE-P0 or permission to expand features.
