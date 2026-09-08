# Frontend Architecture — USRP UI

**Status:** Rewritten 2026-08-30 · supersedes the 2026-08-06 scaffold document
**Repo:** `usrp-ui/` (sibling to the `usrp/` backend monorepo)
**Backend verified against:** `47d9ad3ab019f6d2f826cfae2136cbff898d733f`, via
`@usrp/contracts` (`VERIFIED_BACKEND_SHA`)
**Proof:** `pnpm verify:fe` — 9 proofs, 2 546 assertions, 7 of 9 runnable with no
`node_modules` at all

---

## How to read this document

The previous version of this file was the most dangerous artifact in the
repository. It read as authoritative and was substantially false: it documented
four backend services that do not exist, an authentication model with no server
to implement it, and URL shapes the transport layer forbids. Nobody lied — it was
written as a design intent and then left in a directory called `architecture/`,
where the next reader reasonably took it for a description.

So this version is split into three parts and they are not interchangeable:

| Section | Status of every claim |
|---|---|
| **§1-§7 What is** | True today, with the file or the proof that backs it named inline. |
| **§8 What is not** | Designed, specced, or wanted. **Not built.** Nothing here may be relied on. |
| **§9 Corrections** | What the old document got wrong, and why, so nobody rediscovers it the expensive way. |

If a claim in §1-§7 has no citation, treat it as a defect in this document.

---

## 1. What this frontend talks to

**There is no BFF.** The backend is eleven hexagonal services behind
`@usrp/shared-http`, and the browser reaches **26 of their 58 operations
directly**. The set is not folklore — it is data:

```ts
import { BROWSER_ROUTES, SERVICE_INTERNAL_ROUTES } from '@usrp/contracts';
```

`packages/contracts/src/generated/routes.ts` is generated from `openapi/*.yaml`,
which was hand-authored from the controllers. 26 routes are `reach: 'browser'`;
32 are `reach: 'service-internal'` and take a system credential the browser does
not have and must never be given.

**Three invariants follow from that, and all three are enforced mechanically.**

### 1.1 Exact-path routing — so the frontend holds no URL strings

`shared-http` matches paths **exactly** and has no parameter syntax (ADR-005).
IDs travel in the POST body or a GET query parameter. A `/resource/${id}` URL is
not a style problem, it is a 404.

The strongest available guarantee is a frontend that contains no URLs to get
wrong. Slices call operations by `operationId` and an adapter resolves the id to a
method and an exact path from `ROUTE_TABLE`:

```ts
transport.call('findApplicationById', { query: { applicationId } });
```

- Port: `packages/features/*/src/api/transport.ts`
- Proof: `packages/testing/proofs/02-exact-path-transport.mjs` — 177 assertions.
  Fails on any `/v1` literal, any interpolated path, any bare `fetch`, and any
  `operationId` that is not in `BROWSER_ROUTES`.
- Rationale: `adrs-fe/ADR-FE-002`

### 1.2 Browser-reachable versus service-internal

`SERVICE_INTERNAL_ROUTES` is exported as data precisely so a check can assert
against it rather than a reviewer remembering. Proof 02 fails if a slice names
one; proof 07 fails if a **mock** is generated for one, because a mock that
answers a system-token route teaches every test that a browser may call it.

### 1.3 Two human credentials, neither of them a cookie

| | Officer | Citizen |
|---|---|---|
| Kind | Ed25519 bearer JWT | **opaque** 32-byte DB session |
| Revocable | No, until expiry, by design (ADR-016) | Yes, live, per request (ADR-018) |
| TTL | `expiresAt` on the token | 30-minute sliding window |
| Refresh | **No refresh token, no refresh endpoint** | Sliding TTL, no refresh call |
| 401 code | `UNAUTHENTICATED` | `INVALID_SESSION` |

Same status, same service, different meaning: a single 401 handler for both
credential kinds sends an officer to the citizen OTP screen. A **403** is neither
— an officer token on a citizen route is authenticated and forbidden, and
bouncing that person to a login screen makes them re-enter working credentials
and conclude the system is broken.

- Model: `packages/features/identity/src/model/credentials.ts`
- Proof: `credentials.test.ts` (9 tests) via proof 06

The session token lives **in memory for the tab's lifetime**. A revocable
credential parked in `localStorage` is a non-revocable credential in practice and
an XSS-readable one besides. Proof 03 greps every slice for a storage write
carrying `sessionToken`, `token`, `nationalId`, `otp` or `password`, and for any
mention of `document.cookie`.

---

## 2. Vertical feature slices

Two apps, five route files each, all logic inline, plus an
`officer-console/src/components/` escape hatch. That structure had already leaked
at 5 routes. The real surface is **19 statuses × 3 agencies × two document lanes
× a walk-in lane × offline field tablets × a DPO queue**, against ~20 endpoints
with no UI at all. Flat route files do not reach that.

```
packages/features/
  identity/        NID verify, OTP, session, consent
  applications/    wizard, list, detail, status history
  adjudication/    amber queue, document signals, officer decisions
  scheduling/      slots, signed invitations, QR verification
  field-ops/       walk-in, biometric check-in, device enrolment, offline capture, conflicts
  compliance/      erasure requests, DPO queue, self-withdrawal, consent receipts, retention
```

Every slice is `api/ model/ ui/ routes/` behind exactly one public interface:

```
<slice>/
  src/index.ts     THE ONLY IMPORTABLE FILE. package.json exports "." and nothing else.
  src/api/         transport port + one function per operation. Thin. No branching.
  src/model/       pure decisions. Type-only imports from @usrp/contracts.
  src/ui/          ADS components. No policy.
  src/routes/      lazy RouteObject[] the host app spreads into its router.
  locales/{en,rw,fr}.json   slice-scoped translations
```

A slice may import `@usrp/design-system`, `@usrp/contracts`, `@usrp/api-client`,
`@usrp/auth`, `@usrp/i18n`, React, React Router and `@atlaskit/*`. **A slice may
never import another slice** — not through the barrel, not deeply, not
dynamically. Cross-slice needs are composed by the host app, which is the only
place that knows both.

- Rationale: `adrs-fe/ADR-FE-001`
- Proof: `proofs/01-slice-boundaries.mjs` — 356 assertions, zero dependencies
- Graph check: `packages/testing/.dependency-cruiser.cjs` — cycles, transitive
  cross-slice paths, orphans

### 2.1 The model layer takes type-only imports, on purpose

`src/model/**` imports `@usrp/contracts` with `import type` and nothing else at
runtime. That single constraint means the model layer runs under
`node --experimental-strip-types --test` **with no `node_modules` present at
all**, which is why the decisions that hurt when they are wrong stay provable on
a broken lockfile. Proof 01 enforces it per file.

### 2.2 Route-level code splitting per slice

Each slice exports `RouteObject[]` with `React.lazy()` per page, so the officer
console never ships the citizen wizard and the portal never ships the amber
queue. Slices that serve both audiences export two arrays
(`ComplianceOfficerRoutes`, `ComplianceCitizenRoutes`).

---

## 3. Design system — Atlassian ADS, enforced

`@atlaskit` components, `@atlaskit/tokens` for every colour, space and radius,
`@compiled/react` for styling, ADS Primitives (`Box`/`Stack`/`Inline`/`Text`) as
the lowest layer. **Zero raw hex, zero styled raw HTML elements.**

Proof 03 fails on a hex literal, an `rgb()`/`rgba()` literal, or a raw
`<div>`/`<span>`/`<p>`/`<table>`/… in any slice `.tsx`. Status colour is never
chosen by hand: the model maps status → tone and the design system maps tone →
Lozenge `appearance`, so the model layer imports no component library.

**One documented exception:** `apps/applicant-portal/vite.config.ts` sets
`manifest.theme_color: "#0052CC"`. A PWA web manifest is consumed by the OS and
cannot take a CSS custom property, so a literal is correct here. It should be
sourced from the ADS token's resolved value with a comment, not typed by hand.

---

## 4. i18n — Kinyarwanda, English, French, with no gaps

A recruitment portal for Rwandan citizens that silently falls back to English
excludes the applicants it exists to serve. So completeness is a **gate**, not an
aspiration.

Bundles are **slice-scoped** (`packages/features/*/locales/{en,rw,fr}.json`), so
a slice cannot be complete while its translations are not. Proof 05 (597
assertions) asserts three-way key parity, no empty or `TODO` values, and that
**every `t('…')` key a component asks for is declared**.

It also enforces the no-enumeration rule **in translations**: the OTP request
returns one identical `202` across at least four input classes, and UI copy is
the last place that leak can happen — and the easiest place to do it by accident,
out of helpfulness, in any of three languages. Phrases like "no such applicant"
and "no phone on record" are banned from OTP copy in all three bundles.

**Audit, reported not failed:** `packages/i18n/src/locales/*/common.json` still
labels 12 invented statuses (`UNDER_REVIEW`, `SHORTLISTED`, `EXPIRED`, …) and no
`WALK_IN_*` state, and labels the officer login field `auth.email` when the wire
field is `loginHandle`. That package is outside this job's owned paths, so proof
05 emits a `WARN` and files it as a request rather than failing another agent's
file.

---

## 5. Offline-first — the applicant portal and the field tablet

Already built, in `apps/applicant-portal/vite.config.ts`: Workbox via
`vite-plugin-pwa`, `NetworkFirst` for `/api/*` with a 10-second network timeout,
`CacheFirst` for `/audio/*` Kinyarwanda guidance, app shell precached.

Added here:

- **Wizard draft persistence** with a schema version, and a sanitiser that strips
  `nationalId`, `nationalIdHash`, `otp` and `sessionToken` before anything reaches
  disk. A draft from an older schema is **discarded, not migrated by hope** — a
  half-restored shape submits a body the backend answers with a 400 the citizen
  cannot act on. `packages/features/applications/src/model/draft.ts`
- **Invitation-key caching** so an officer can verify a signed QR at a venue with
  no signal, keyed by `keyId` so a rotation is a new entry rather than a stale hit.
  `packages/features/scheduling/src/model/invitation.ts`
- **Signed offline capture queue** — an unsigned record never enters the queue,
  because the device signature is the integrity gate and an unsigned record fails
  the entire batch with a 400.
  `packages/features/field-ops/src/model/conflict.ts`

See `adrs-fe/ADR-FE-005`.

---

## 6. The three responses that look like success and are not

These are the reason the model layer exists, and each is pinned by a contract
fixture, a model test and an e2e case.

1. **`POST /v1/field-sync/scores` → `200 { status: 'SYNCED' }` with every record
   `REJECTED` for `BAD_SIGNATURE`.** Correct batch semantics. A success toast over
   it tells a field officer on exam day that scores are saved when none are.
   `summarizeSync()` returns a verdict derived from the per-record array and
   exposes `safeToShowSuccess`, which is only ever true for `ALL_SAVED`.
2. **`POST /v1/biometric/verify` → `200 { verified: false }`.** The transport
   succeeded; the person may be an impostor. An `assertOk`-shaped client waves
   them through the door at a national security recruitment venue.
3. **`NO_CHANGE` on every transition and on self-withdrawal is a `200` and a
   success.** A client that treats only `APPLIED`/`WITHDRAWN` as success shows an
   error for a double-clicked button that did exactly what was asked.

And the inverse, which is equally load-bearing: **`AGE_PENDING` is the only
retryable 409 in the platform** (the age verdict rides the Kafka backbone and may
not have landed). Every other 409 is a decision, and a Retry button on one
teaches officers to hammer a refusal.

---

## 7. Proof — `pnpm verify:fe`

One command, mirroring the backend's `pnpm verify`. Reports pass/fail per proof,
fails fast, exits non-zero. **The same script a developer runs and CI runs**, per
`ci-quality-gate.md` — no CI-only reimplementation to drift.

| # | Proof | Assertions | Needs install |
|---|---|---|---|
| 01 | slice boundaries | 356 | no |
| 02 | exact-path transport, reachability | 177 | no |
| 03 | PII, storage and ADS invariants | 611 | no |
| 04 | status maps exhaustive, 4 transitions real | 156 | no |
| 05 | rw/en/fr completeness, no leaked copy | 597 | no |
| 06 | slice model logic (`node:test`) | 161 (55 tests) | no |
| 07 | generated MSW handlers match contracts | 448 | no |
| 08 | component + a11y (vitest, RTL, axe) | 16 static | **yes** |
| 09 | Playwright critical paths | 24 static | **yes** |
|  | **Total** | **2 546** | |

For scale: the backend's gate is 8 proofs and ~130 assertions against live
infrastructure; `@usrp/contracts` is 6 gates and 1 188. Assertion counts are not
comparable across those units — a live RLS isolation proof is worth more than a
hundred greps — so the number here is reported for movement, not for bragging.

**Mocks are generated, never handwritten.** MSW handlers come from `ROUTE_TABLE`
(method + exact path) and `packages/contracts/fixtures` (bodies, verbatim). The
only hand-authored file is
`packages/testing/src/msw/operation-fixtures.json`, which chooses *which fixture
represents which outcome* and contains no bodies at all. Proof 07 fails if any
browser route is unmocked, if any service-internal route is mocked, if any body
diverges from its fixture by a byte, or if an `expect: 'reject'` fixture is ever
served — those encode responses the platform must never emit, and mocking one
asserts the opposite of what it was written for.

```bash
pnpm verify:fe                              # everything
pnpm --filter @usrp/testing verify:fast     # proofs 01-07, no install needed
pnpm --filter @usrp/testing generate:mocks  # regenerate handlers from contracts
```

---

## 8. What is NOT built

Nothing in this section may be relied on. Each item is either designed, specced
under `packages/contracts/openapi/proposed/`, or named as a gap.

### 8.1 No BFF, and two citizen journeys are blocked by its absence

Ports 4021-4024 are reserved for nothing. `apps/applicant-portal/vite.config.ts`
proxies `/api` to `http://localhost:4020`, which nothing serves.

The consequence is larger than a proxy target, and it is the most important
finding in this rewrite:

| The citizen needs to | Endpoint | Reach | So today |
|---|---|---|---|
| Verify their National ID | `POST /v1/identities/verify` | **service-internal** | impossible from a browser |
| File an application | `POST /v1/applications` | **service-internal** | impossible from a browser |
| Upload a document | `POST /v1/documents/upload` | **service-internal** | impossible from a browser |

All three need a caller holding a client-credentials system token (the ADR-016
pattern). **The applicant portal cannot submit an application today.** Its real
browser surface is: OTP in/out, read own applications, withdraw own application,
file and read an erasure request. The `test.fixme` cases in
`apps/applicant-portal/e2e/citizen-journey.spec.ts` state this rather than
stubbing a green test for a flow the platform cannot perform.

### 8.2 Surfaces designed here and not yet wired into an app

The slices exist, pass their proofs, and are not yet mounted in a router, because
`apps/**/src` is outside this job's owned paths. Each is a one-line spread into
the host app's route array.

| Surface | Slice | Endpoint |
|---|---|---|
| Amber adjudication queue, with forensic signals | adjudication | `GET /v1/applications/amber-queue` |
| The four officer transitions | adjudication | accept, adjudicate, medical-review, final-decision |
| DPO erasure queue with mandatory decline grounds | compliance | `GET/POST /v1/identities/erasure-requests(/decline)` |
| Citizen self-withdrawal | compliance | `POST /v1/applicants/me/applications/withdraw` |
| Biometric check-in | field-ops | `POST /v1/biometric/verify` |
| Device enrolment, score sync, conflict resolution | field-ops | `POST /v1/field-sync/*` |
| QR invitation verification | scheduling | `GET /v1/slots/invitation-key` |

### 8.3 `apps/admin-console` — proposed, not built

`superadmin-bff` was reserved and never built, and there is **no superadmin
principal**: RLS is `FORCE`d on every ops schema and no principal kind bypasses
it. Cross-agency reads exist only for `kind: 'system'` on specific routes, never
for a human. So an admin console cannot be "the console that sees everything".

What it could legitimately hold today: officer and service-client administration,
the audit trail, invitation key rotation, and platform health across the eleven
services. See `adrs-fe/ADR-FE-004 §4`.

### 8.4 Named gaps, with owners

1. **The transition trail is officer-only.** `GET /v1/applications/status-history`
   requires an officer credential. This platform's own Procedural Justice surface,
   and the rejected applicant — the one person with an interest in it — cannot
   read it. `GET /v1/applicants/me/status-history` is proposed, not built.
2. **`SLOT_ASSIGNED` tells the citizen nothing.** No endpoint returns their venue
   or time. The scheduling slice renders an honest "you have a slot, we cannot yet
   tell you where" state, because a blank venue field reads as a system fault to
   the person who most needs the answer.
3. **Officer login returns no identity.** `{ token, expiresAt }` and nothing else
   — no user, no agency, no roles, and no `GET /v1/auth/officer/me`. The console
   cannot render "you are an RDF reviewer" without decoding a JWT it is not
   supposed to interpret.
4. **Any officer can decide an erasure request.** No DPO role exists, and the
   erasure queue is the only officer read in the platform that is not
   agency-scoped. The UI carries a banner saying so in all three languages,
   because a frontend cannot fix authorisation but it can refuse to look like a
   DPO-only console.
5. **The per-agency medical mode is unpublished.** `BOARD` versus `CERTIFICATE`
   (ADR-013) appears only in a 422 `reason` string. The UI does not guess; it
   submits and shows the reason verbatim. A hard-coded guess would 422 for a third
   of the country's officers with no way to discover why.
6. **No dashboard metrics endpoint exists.** `useDashboardMetrics` in
   `@usrp/api-client` has no route behind it in `ROUTE_TABLE`. The
   exception-based dashboard must be derived client-side from
   `GET /v1/applications` and `GET /v1/applications/amber-queue`, or an endpoint
   must be added.
7. **`zustand@4.5.5` is a dependency of both apps and is imported nowhere.** In a
   government dependency tree an unused package is attack surface, not
   optionality. Removal is a one-line change in each app manifest — outside this
   job's owned paths, so it is filed as a request.
8. **`@usrp/shared-types` is still a dependency of both apps.** It ships 12
   invented statuses and 5 of 6 invented document types. Deprecated by
   `@usrp/contracts`; `.dependency-cruiser.cjs` already forbids importing it.

---

## 9. Corrections — what the previous document got wrong

Recorded so the next reader does not have to rediscover any of it, and so the
failure mode is visible: **every one of these was plausible, internally
consistent, and written before the backend was read.**

| # | The old document said | Reality | How it was found |
|---|---|---|---|
| 1 | "The USRP backend exposes four BFF services" (`rdf-bff`, `rnp-bff`, `rcs-bff`, `superadmin-bff`) | **No BFF exists.** Eleven services, no aggregation tier. | `ROUTE_TABLE`: 58 operations across 11 services, none of them a BFF |
| 2 | "The frontend never talks to individual microservices … all calls go through the agency BFF" | Exactly inverted: the frontend can **only** talk to individual services | `BROWSER_ROUTES` |
| 3 | "The JWT is stored in an httpOnly, SameSite=Strict cookie set by the BFF on `/auth/login`" | **No service sets a cookie.** No `/auth/login`. `POST /v1/auth/officer/login` returns `{ token, expiresAt }` in the body | `iam-service` `officer-login.controller.ts`; fixture `token-issued` |
| 4 | "`AuthProvider` calls `/auth/me` on mount … the only source of truth for auth state" | **`/auth/me` does not exist.** Login returns no user, agency or roles | fixture `token-rejects-user-object` |
| 5 | "`{ path: 'applications/:id' }`", and an api-client with path-param helpers | `shared-http` has **no path parameters**. IDs go in the body or a query param | ADR-005; contracts loader rejects a templated path |
| 6 | "Home page asks only for NID, calls `/identity/verify-nida`, pre-fills name" | No such path. The real route, `POST /v1/identities/verify`, is **service-internal** — the citizen's browser cannot call it, and it returns no name | `ROUTE_TABLE` reach; fixture `identity-rejects-nida-pii` |
| 7 | "17 application statuses", 5 of which were real | **19**, and per-agency: RNP and RCS carry no `WALK_IN_*` value. The shared `packages/i18n` bundle still labels the 12 invented ones | `agency.ts`, cross-checked against the three `*_ops` enums |
| 8 | "`ApplicationDetailPage` shows full event history with actor, timestamp and note" as the Procedural Justice implementation | The history endpoint is **officer-only**. The applicant cannot read their own trail | `getApplicationStatusHistory`, `auth: ['officer']` |
| 9 | "Zustand … reserved for UI state" | Installed in both apps, imported nowhere, for four months | code search: zero matches |
| 10 | "`useNidaVerification` fires on NID field blur; green ✓ shown immediately" | Fires at a service-internal endpoint with no credential, and would have 400'd anyway: `channel` is required and the hook omitted it | fixture `verify-request-rejects-missing-channel` |
| 11 | "`PaginatedResult<T>` used everywhere" (in the api-client it described) | **Nothing in the platform paginates.** Reads cap at 100 and return a bare array | fixture `list-rejects-pagination-envelope` |
| 12 | Silent on it | `GET /v1/applications/by-id` and `GET /v1/applications/status-history` **do exist** — the system brief says they do not. `officer-transitions.controller.ts` exposes **four** routes while its own header says three | `ROUTE_TABLE`, proof 04 |

**What the old document got right, and this one keeps:** SPA over SSR for an
offline-first PWA; `@compiled/react` and ADS tokens as non-negotiable; React
Router with `React.lazy`; TanStack Query for server state; and — the important
one — **"`AgencyGuard` is presentational only; data access is enforced by RLS at
the DB engine."** That sentence was correct and load-bearing, and proof 03 now
fails any file that describes a frontend guard as security.

---

## 10. Getting started

```bash
pnpm install

pnpm dev                                     # both apps
pnpm typecheck                               # ultra-strict, zero-error gate
pnpm verify:fe                               # every proof, fail fast
pnpm --filter @usrp/testing verify:fast      # proofs 01-07, no install required
pnpm --filter @usrp/contracts verify         # the contract's own 6 gates
```

Per-app environment: **do not** set `VITE_BFF_URL` and expect it to work. There
is no BFF. Until an edge tier exists, point the dev proxy at the individual
service ports listed in the backend's compose files.

---

## Related

- `docs/architecture/adrs-fe/` — the frontend ADRs, starting at ADR-FE-001
- `packages/contracts/README.md` — the wire truth and its 1 188 assertions
- `packages/testing/README.md` — the proof harness
- Backend: `docs/architecture/identity-service-http-slice.md` (the transport
  template every service follows), `ci-quality-gate.md` (the quality contract),
  ADR-005, ADR-006, ADR-016, ADR-018, ADR-020
