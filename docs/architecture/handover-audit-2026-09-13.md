# Handover audit — incoming frontend architect, 2026-09-13

**Status:** findings of record. Written on takeover, before feature work.
**Method:** every claim below cites the file that proves it.
**Predecessors:** `handover-audit-2026-09-08.md`, `frontend-architecture.md` §9.

---

## Why this document exists

This project runs on one instrument: a corrections table that records what the
previous document got wrong and names how each error was found.
`frontend-architecture.md` §9 recorded twelve false claims; the 2026-09-08 audit
turned the same instrument on the state *it* inherited. This is the third turn.

Three sections, and they are **not interchangeable**:

| Section | Status of every claim |
|---|---|
| **§1 Broken** | Verified by reading files in these two repositories. Cited inline. |
| **§2 Fixed** | Corrected on `fix/fe-handover-truth-and-tablet-offline`. |
| **§3 Unverified** | Suspected, **not proven.** No install, no build, no CI log. Nothing here may be relied on. |

Backend commit read: `2b1814f`. Frontend commit read: `69e74d2`.

---

## 1. Broken

### 1.1 Three operations recorded as fiction are implemented upstream

**THE FINDING THAT OUTRANKS THE OTHERS**, because it is a defect in the
project's own truth-keeping method rather than in its code.

`packages/features/field-ops/src/api/transport.ts` stated that
`enrollFieldDevice`, `syncFieldScores` and `resolveFieldConflict` were "invented"
against an architecture diagram, and that `field-sync-service` is a **SCAFFOLD**
with "directory exists, no source", citing `000.md` §6.

All three are implemented. Read in the backend tree at `2b1814f`:

| Operation | Controller | Route |
|---|---|---|
| `enrollFieldDevice` | `services/field-sync-service/src/adapters/http/enroll-device.controller.ts` | `POST /v1/field-sync/devices` |
| `syncFieldScores` | `services/field-sync-service/src/adapters/http/sync-scores.controller.ts` | `POST /v1/field-sync/scores` |
| `resolveFieldConflict` | `services/field-sync-service/src/adapters/http/resolve-conflict.controller.ts` | `POST /v1/field-sync/conflicts/resolve` |

The service also has `device-registry.pg.ts` and `field-score-store.pg.ts`
adapters, a domain layer, an application layer, `main.ts`, and a `selfcheck`. Its
own manifest describes it as *"enrolls field tablets, verifies device-signed
score records, merges them with vector clocks (hybrid conflict resolution)"*.

**The predecessor read a planning document instead of the tree** — the exact
error his own audit §3.2 warns about (*"a zero result is not evidence of
absence"*). And the sting is that his **conclusion was right**: capture must not
sync. So a reviewer who spot-checks the stated reason, finds field-sync alive,
and concludes the note is stale will flip `OFFLINE_CAPTURE_CAN_SYNC` to `true`
and point a queue at a route that does not exist.

The real blocker is one level out: `services/edge-gateway/` contains **only**
`openapi/`. No `package.json`, no entrypoint. An implemented upstream controller
with no edge route in front of it is unreachable from a browser, because the
browser may only call `/edge/v1/**`.

`verifyBiometric` is **not** reclassified. `biometric-service` has a populated
`src` tree and a selfcheck, but no controller in it was read, so promoting it on
a directory listing would repeat the defect being corrected.

### 1.2 The field tablet had no offline layer at all

`ADR-FE-005` names two offline problems and calls the field tablet the harder
one: *"No signal for hours, exam-day scores captured for hundreds of applicants."*

Every offline mechanism in the repository was in the other app.
`apps/applicant-portal/vite.config.ts` has `VitePWA`, Workbox runtime caching, a
manifest, `workbox-window`, `workbox-build`. `apps/officer-console/vite.config.ts`
had **none of it**. No service worker, no precached shell, no manifest. The tablet
could not load its own application without a network.

`tooling/repo-hygiene/gates.config.json` compounded it, justifying that app's
looser 1200 KB ceiling as *"institutional desktop clients on agency networks"*.
The budget rationale had the wrong device class for the app it governs.

### 1.3 ADR-FE-005 documented a caching configuration that does not exist

The ADR described the portal's Workbox layer as *"`NetworkFirst` for `/api/*`
with a 10-second network timeout"*. `apps/applicant-portal/vite.config.ts` says
`NetworkOnly` for `/edge/v1/*`, and always has.

Three errors in one sentence, in the document an engineer reads *before* touching
offline behaviour:

- `NetworkFirst` **caches** authenticated responses. On a shared venue tablet
  that serves one officer's data to the next. The ADR made the vulnerable
  handler look like the accepted decision.
- `/api/*` is the pre-ADR-021 path shape `edge-contract.md` retired.
- `NetworkOnly` has nothing to time out to, so the 10 seconds were invented.

### 1.4 The a11y and colour gates never scanned the product

`gates.config.json > touchTargets.roots` and `hexScan.roots` were limited to
`packages/design-system` (plus `eslint-config` and `tooling/repo-hygiene`).

So the 48px floor — justified *in that same file* by gloved hands and outdoor
one-handed use — was never applied to `apps/`, `packages/ui`, or any feature
slice. Not one component an officer or applicant touches.

The proof that this was inert rather than merely narrow: the `hexScan` comment
**described** raw colour literals in `apps/applicant-portal/vite.config.ts`, said
each *"should carry a `hygiene-allow-hex` marker"*, and then omitted `apps/` from
the roots. It documented a violation it was configured not to see.

Meanwhile `packages/ui/src/components/AudioTooltip/index.tsx` hardcodes
`minWidth: "48px"` while `packages/design-system/src/a11y/index.ts` exports
`TOUCH_TARGET_TOKEN_PX` *"so components never reach for a raw dimension string of
their own choosing"*.

### 1.5 The authoritative port map described the rejected topology, and omitted the real one

`tooling/edge-dev/src/ports.ts` listed five BFF entries — `citizen-bff`, three
`agency-bff` deployments, `admin-bff` — the topology ADR-021 rejected and which
`edge-contract.md` §0 explicitly forbids documenting. The **edge gateway itself
had no entry**.

That produced a checked-in contradiction. `PORTS.md` instructed
applicant-portal → **4020**; `apps/applicant-portal/vite.config.ts` proxies
`/edge` → **4021**, as does the officer console. The code was right — one edge
origin means both SPAs proxy the same port — and anyone who had aligned the code
to the map would have implemented a rejected architecture on the authority of a
stale table, in the file that calls itself authoritative.

### 1.6 Three mutually exclusive answers about the Node target

| Source | Answer |
|---|---|
| `.node-version` | 22 |
| `package.json > engines.node` | `>=20 <=25` |
| `package.json > @types/node` | `^26.5.0` |

Types for Node 26 against a runtime pinned to 22 typechecks code against APIs
that do not exist at runtime. The engines range simultaneously permitted 25 (EOL)
and 20 (not described by those types). CI, `nvm`, and `tsc` were each entitled to
a different answer.

Also split across the graph: `@playwright/test` (`^1.62.1` at root vs `^1.47.0`
in applicant-portal) and `eslint` (exact `9.39.5` in applicant-portal vs `^9.9.0`
everywhere else).

### 1.7 The officer shell was untranslatable, under a Kinyarwanda lang attribute

`apps/officer-console/index.html` declared `lang="rw"`. Every string in
`src/components/AppShell/index.tsx` was hardcoded English ("Dashboard",
"Applications", "Walk-in", "Collapse navigation").

WCAG 3.1.1, and worse than a missing attribute: it instructs a screen reader to
apply Kinyarwanda pronunciation to English text. `app.tsx` corrects
`documentElement.lang` on mount, so the served document was wrong and then
silently fixed — which is why nobody saw it.

The keys already existed. `packages/i18n/src/locales/{en,rw,fr}/common.json` all
carry a complete `nav.*` block at three-way parity. This was a wiring gap, not a
translation gap.

### 1.8 E2E tested source, not the shipped bundle — and never saw a tablet

`apps/officer-console/playwright.config.ts` ran `webServer.command: "pnpm dev"`.
The 2026-09-08 audit §1.11 #4 recorded *"e2e declared `needs: build` and never
downloaded the artifact — it tested source, not the bundle that ships"* and
listed it as **fixed**. It was not fixed here.

This matters more now than when it was written: a service worker does not exist
in a dev server the way it exists in a build, so offline behaviour is untestable
against source by construction.

The config also declared exactly one project, `Desktop Chrome`. Zero tablet
viewport, zero touch, zero offline — for the application that runs on a tablet. A
48px touch floor cannot be proven by a mouse pointer.

Its header comment also still said *"All BFF calls are intercepted"*, naming the
retired topology.

### 1.9 The repository's entry point described someone else's product

Root `llms.txt` was Atlassian's ADS `llms.txt` copied verbatim, linking to
`llms-tokens.txt`, `llms-primitives.txt`, `llms-components.txt`,
`llms-styling.txt` and `llms-a11y.txt` — none of which exist in this repository.

The file an agent or a new engineer reads first, on a national system, contained
zero USRP context and five broken relative links.

---

## 2. Fixed

All on `fix/fe-handover-truth-and-tablet-offline`.

| Finding | Fix |
|---|---|
| 1.1 false scaffold claim | `transport.ts` rewritten: per-entry provenance (`upstreamPath`, `evidence`, `reason`), verified controller citations, `verifyBiometric` marked `upstream-unverified`. `OFFLINE_CAPTURE_CAN_SYNC` stays `false` with the real reason, plus `fieldSyncIsReachable()` so the flag flips on a checked fact rather than by hand. Slice manifest note corrected. |
| 1.2 no tablet offline layer | `VitePWA` on officer-console: precached shell, `autoUpdate`, `navigateFallback` with an `/edge/` denylist, landscape standalone manifest, `NetworkOnly` on `/edge/v1/**`. New `ConnectionStatus` renders the offline state and the standing sync limitation. |
| 1.3 ADR described absent config | ADR-FE-005 Context corrected with the correction recorded inline, not silently edited. Server-side caps (50-char `resolution`, batch-400 / per-record-200) now cite the controllers. |
| 1.4 inert gates | `touchTargets.roots` and `hexScan.roots` widened to `apps` and `packages`. `AudioTooltip` keeps its extractable literal but gains a compile-time assertion against `TOUCH_TARGET_TOKEN_PX`. Both PWA manifests carry `hygiene-allow-hex` with the reason. `boundaries.roots` deliberately **not** widened. |
| 1.5 port map | `EDGE_PORTS` is one `edge-gateway` on 4021. `RETIRED_EDGE_PORTS` keeps 4020/4022/4023/4024 reserved and out of `ALL_PORTS`; `assertNoRetiredAllocation()` refuses to boot on reuse. `PORTS.md` regenerated. |
| 1.6 toolchain | Settled on Node 22: `engines.node` `>=22 <23`, `@types/node` `^22.15.0`. Playwright and ESLint converged. |
| 1.7 untranslated shell | `AppShell` uses `nav.*` / `a11y.*`; `lang="en"` as an honest pre-hydration default. Three keys added at exact en/rw/fr parity: `a11y.collapse_nav`, `a11y.expand_nav`, `offline.sync_unavailable`. |
| 1.8 E2E | `webServer` runs `pnpm preview` against the built `dist` on port 3001 (`preview.strictPort` added to both apps); new `field-tablet` project on Galaxy Tab S4 landscape; stale BFF comment removed. |
| 1.9 entry point | Root `llms.txt` is now a real map of this repository. ADS material moved to `docs/vendor/atlassian-design-system.md` as canonical links, not a mirror. |

**One thing deliberately NOT done.** The multi-BFF env var `PORT_AGENCY_BFF` is
recorded as legacy rather than renamed to `PORT_EDGE_GATEWAY`. Renaming it here
changes nothing about what the backend reads; it would only make this map wrong
in a new way. The rename belongs in the backend `.env.example`, its config
loaders and `verify-dev-boot.sh`, in one commit.

---

## 3. Unverified — nothing here may be relied on

I had no install, no build, no test run and no CI log. Everything below is a
prediction.

### 3.1 The lockfile still must be regenerated, and this branch adds to the reason

Still the top blocker, unchanged from audit §3.1. This branch **adds** two
dependencies to officer-console (`vite-plugin-pwa`, `workbox-window`,
`workbox-build`) and one to `@usrp/ui` (`@usrp/design-system`), so
`--frozen-lockfile` **will** fail until:

```bash
pnpm install
git add pnpm-lock.yaml
git commit -m 'chore: regenerate lockfile for tablet PWA and design-system dependency'
```

Never hand-edit it.

### 3.2 Widening `hexScan` may go red on files I could not grep

I read `AudioTooltip` and both vite configs and marked the manifests. I could not
grep the rest of `apps/**` and `packages/**` — GitHub code search returns
`incomplete_results: true` for this repository, and audit §3.2 is right that a
zero result there is not evidence of absence.

If the boundaries gate goes red, **read the named file before assuming the rule
is wrong.** A raw literal outside a web manifest is a real violation.

### 3.3 The `@compiled` extraction risk in `AudioTooltip`

I kept the `48px` literal inline in `cssMap` precisely because a cross-package
imported binding is not a safe bet for build-time extraction, and added a
type-level assertion instead. That is the conservative choice, but
`verify:extraction` has never run on a completed build, so it is unproven.

### 3.4 `Galaxy Tab S4 landscape` is a Playwright device descriptor I did not execute

The project will fail to start if that descriptor name is wrong in the installed
Playwright version. Verify on the first run; the fallback is an explicit
`viewport` + `hasTouch: true`.

### 3.5 `apps/officer-console` has no `public/` directory

The manifest I added references `/icons/icon-192.png` and `/icons/icon-512.png`,
and `index.html` has always referenced `/favicon.svg`. **No `public/` directory
exists in that app.** The build will not fail, but the PWA is not installable and
the favicon 404s. Populating `apps/officer-console/public/` is a required
follow-up, not an optional polish.

### 3.6 Bundle budgets are still uncalibrated, and officer-console just grew

A service worker and a workbox chunk have been added to an app whose 1200 KB
ceiling was never measured. Recalibrate on the first green build — and this time
with the field tablet as the device class, not a desk on a LAN.

---

## 4. The thing worth carrying forward

The 2026-09-08 audit's closing lesson was that a proof nobody reads has already
failed. This audit's is narrower and sharper:

**A correct conclusion resting on a false reason is more dangerous than an
obvious error**, because it survives review. `OFFLINE_CAPTURE_CAN_SYNC = false`
was right. Its stated justification was wrong. The next engineer to check the
justification would have found it false and flipped the flag — doing damage by
doing diligence.

So: cite the file, not the plan. `000.md` is a planning document. The tree is the
system.

And the standing request from the previous audit is still outstanding and still
first: **make `Quality Gate` a required, branch-protected check on `main`.**
