# `@usrp/contracts`

**The only legal source of domain types in this frontend.**

OpenAPI 3.1 documents hand-authored from the backend controllers and
selfchecks, plus the per-agency divergence model that no OpenAPI document can
express.

Verified against backend SHA
[`18e468a`](https://github.com/Jackson-NSANZIMANA/e-recruitment/commit/18e468a2afe779a4c2402e81ed8eda92b756e7e4)
(`main`, PR #3, gate 38/38).

---

## Read this before you use it

**This package is incomplete, and the table below is the honest state.** Two of
eleven services are authored. Nothing here has been through `tsc` yet, and
there is no `verify` harness, so the compile-time guarantees in `src/agency.ts`
are *designed and unproven*. Do not take them on trust; run `pnpm typecheck`
first.

The backend's own doctrine
([`ci-quality-gate.md`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/main/docs/architecture/ci-quality-gate.md))
is that a green-but-hollow gate is worse than no gate. A contract package that
implies more coverage than it has is the same failure, so the ledger lives at
the top of the file rather than the bottom.

### Status ledger

| Artifact | State |
|---|---|
| `src/agency.ts` — divergence model | **Written.** Never compiled. |
| `openapi/application-service.yaml` | **Written.** 5 read routes + 2 probes verbatim; 8 write routes path/method/auth verified, bodies pending. |
| `openapi/document-forensics-service.yaml` | **Written.** Upload route verbatim; analyze route pending. |
| iam-service | Not authored |
| identity-service | Not authored |
| eligibility-service | Not authored |
| biometric-service | Not authored |
| field-sync-service | Not authored |
| scheduling-service | Not authored |
| audit / background-vetting / notification | Not authored (`routes: []`, probes only) |
| `scripts/generate.ts` — OpenAPI → Zod → TS | Not built |
| `tooling/contract-drift` | Not built |
| Response fixtures mined from selfchecks | Not built |
| `scripts/verify.ts` | Not built |
| **Assertions proven** | **0.** The backend's bar is ~130 across 38 gates. |

Every operation carries `x-usrp-verified`, so the gap is machine-readable:

- `controller-verbatim` — request and response shapes transcribed from the named
  controller, field by field.
- `pending-controller-read` — path, method and auth kind verified; bodies
  derived from selfcheck output and commit messages. **Must be transcribed
  before generating a client for that route.**

A contract that guesses is worse than one that admits a gap, because a guess
type-checks.

---

## Why this package exists

Both repos hand-maintained a separate `@usrp/shared-types`. The frontend copy
drifted until it described a different system:

| | Frontend `shared-types` | Reality |
|---|---|---|
| Application statuses | 17, of which **5 exist** | **19** |
| Invented statuses | 12 (`UNDER_REVIEW`, `SHORTLISTED`, `PHYSICAL_PASSED`, `VETTING_IN_PROGRESS`, `EXPIRED`, …) | — |
| Missing statuses | 14, including the whole green/amber lane, all four `WALK_IN_*`, and `ADJUDICATION_REVIEW` | — |
| `TERMINAL_STATUSES` | contains `EXPIRED` (never existed), omits `WALK_IN_REJECTED` (real) | 4 for RDF, 3 for RNP/RCS |
| `DocumentType` | 6, of which **1 exists**, modelled as agency-agnostic | **11**, genuinely **per-agency** |
| `gender` | `MALE \| FEMALE \| OTHER` | `MALE \| FEMALE` — `OTHER` is unrepresentable end to end |
| `PaginatedResult<T>` | used everywhere | **nothing in the platform paginates** |
| `OfficerRole` | 5 roles incl. `SUPERADMIN` "no RLS" | token carries `roles: string[]`, RLS is FORCE'd, no bypass principal exists |

In this domain a drifted type is not a rendering bug. Nineteen statuses, three
agencies with divergent enums, and RLS-enforced isolation add up to a citizen
wrongly rejected from a career in the national security services.

**`packages/shared-types` is deprecated and slated for deletion.** It is not
deleted yet: its consumers migrate in a later job. Do not add to it, and do not
import it in new code.

---

## The six invariants this package encodes

1. **Exact-path routing only.** `shared-http` matches paths exactly and has no
   param syntax (ADR-005). IDs travel in the request body (POST) or a query
   param (GET, `?applicationId=`). Any `/resource/${id}` URL is a bug — the
   frontend's `GET /applications/${id}` and `PATCH /applications/${id}/status`
   cannot route at all. Restoring REST ergonomics for the browser is the edge
   tier's job.
2. **The raw National ID is request-only**, and `nationalIdHash` is an internal
   cross-service key that must never reach the browser. The old `useWalkIn`
   asked the browser to *compute* it.
3. **Agency isolation is Postgres RLS.** Frontend guards are presentational and
   must never be documented as security.
4. **Two human credential kinds, not interchangeable.** Officers carry an
   Ed25519 bearer JWT (non-revocable until expiry, by design); citizens carry an
   opaque 32-byte revocable DB session (ADR-018). Neither is a cookie today.
   Both JWT kinds fail `401 UNAUTHENTICATED`; the session kind fails
   `401 INVALID_SESSION` — same status, different code, same service.
5. **Browser-reachable vs service-internal is load-bearing.** Getting it wrong
   exposes a system-token route to a citizen, so it is modelled
   (`x-usrp-reach`) rather than left to reviewer memory.
6. **No-enumeration is a designed property.** Both single-record 404s are
   deliberately bare: a sibling agency's real application ID and a nonexistent
   one return byte-identical responses. Adding a detail field turns 404 into a
   cross-agency existence oracle. The OTP request returns one identical `202`
   across four different input classes. **UI copy must not leak what the API
   refused to leak.**

---

## Using the divergence model

```ts
import { type Agency, type StatusFor, isTerminal } from '@usrp/contracts/agency';

declare function lozengeFor<A extends Agency>(agency: A, status: StatusFor<A>): Appearance;

lozengeFor('RDF', 'WALK_IN_REGISTERED');  // ok
lozengeFor('RNP', 'WALK_IN_REGISTERED');  // compile error — the whole point
```

`rnp_ops` and `rcs_ops` carry no `WALK_IN_*` values. This is why the backend
compares `status::text` instead of casting to an enum: an enum-cast comparison
against `WALK_IN_REJECTED` is a hard error for two agencies out of three and
works fine for RDF, so it passes every test run against RDF fixtures and fails
in production for RNP and RCS. The frontend equivalent is a
`WALK_IN_ON_SITE_VETTING` lozenge rendering in the RNP console.

Adding a status without classifying it as shared or RDF-only fails the build.

---

## Nine endpoints the designed UI still needs

Three landed in PR #3. Six remain. All follow the `?applicantId=` precedent:
query param on GET, exact path, no path params.

| | Endpoint | Status |
|---|---|---|
| 1 | `GET /v1/applications/by-id?applicationId=` | ✅ **landed** |
| 2 | `GET /v1/applications/status-history?applicationId=` | ✅ **landed** |
| 3 | `POST /v1/documents/upload` | ✅ **landed** (multipart, not the presigned-URL flow originally proposed) |
| 4 | `GET /v1/applications/documents?applicationId=` | needed — `document_records` is written and never read |
| 5 | `GET /v1/auth/officer/me` | needed — **nothing tells an officer who they are.** Login returns `{token, expiresAt}` and no user object, so the console cannot render a name, an agency badge, or a role-gated menu |
| 6 | `GET /v1/applicants/me/slot?applicationId=` | needed — `SLOT_ASSIGNED` is projected onto the row and **the citizen cannot see where or when to show up.** Arguably the most consequential gap for an actual applicant |
| 7 | `GET /v1/applicants/me/profile` | needed — must exclude name, DOB and phone (encrypted at rest; invariant 2 forbids the hash) |
| 8 | `GET /v1/applications/search?processingCode=` | needed — the list caps at 100 with no filter, so past ~100 rows an officer cannot find a specific application |
| 9 | `GET /v1/applications/metrics` | **blocked on a decision.** Only `pendingReview` is derivable (from `amber-queue`); `requiresAction`, `scheduledToday` and `acceptedThisWeek` have no source in any schema and cannot be specced until someone defines them |

---

## Live backend inconsistencies found while reading

Recorded verbatim in the documents rather than silently normalised, because a
contract that smooths over a real inconsistency hides it from the only people
who can fix it.

1. **`analyze-document.controller.ts` keys business outcomes on `error`, not
   `status`** — unique among fifteen controllers. On that route a client cannot
   distinguish a business outcome from a transport fault. **Zero frontend
   consumers today, so this is the cheapest it will ever be to re-key.**
2. **Same file: `mapOutcome` has no `default`/`assertNever`.** Add an outcome
   variant and it compiles, returns `undefined` as an `HttpResult`, and the
   transport answers `200` with an empty body.
3. **`officer-transitions.controller.ts` header says "Three OFFICER-authenticated
   write endpoints"** and lists three; the file exports **four** and the factory
   returns four. Stale doc on the most safety-critical controller in the
   platform.
4. **`self-withdrawal.controller.ts:87`: `mapDomainError` throws** inside a
   function declared `: HttpError`, called as `throw mapDomainError(err)`.
   Behaviour is accidentally identical to every sibling; the declared contract
   is violated and the return path is dead.
5. **`walk-in.controller.ts` builds codes by upper-casing field names**, yielding
   `MISSING_APPLICANTID` and `INVALID_NESAINDEXNUMBER` where every other
   controller emits `MISSING_APPLICANT_ID`. Two spellings of the same code on
   one service.
6. **`runTransition` erases per-command outcome narrowing.** medical-review,
   final-decision and accept share one `mapOutcome`, so at the type level every
   one can emit `422 INVALID_MEDICAL_INPUT` and `409 CROSS_AGENCY_LOCKED`. The
   selfcheck proves the real narrowing. The HTTP layer is strictly looser than
   the behaviour it implements.
7. **Every 5xx/503 `detail` string is written and silently discarded**
   (`HttpError.expose = status < 500`). `NIDA_UNAVAILABLE`,
   `SCANNER_UNAVAILABLE`, `OBJECT_STORE_UNAVAILABLE` and five others pass
   caller-facing hints nobody receives. Either `expose: true` or delete them —
   the error UI depends on which.
8. **403 has three incompatible bodies platform-wide:**
   `{error:'FORBIDDEN', detail}` from `withAuth`, `{error:'FORBIDDEN'}` from
   outcome branches, `{status:'AGENCY_MISMATCH'}` from biometric-service. No
   single discriminated union covers 403.
9. **`POST /v1/field-sync/scores` returns `200 {status:'SYNCED'}` even when every
   record was `REJECTED` for `BAD_SIGNATURE`.** Correct batch semantics; means
   an `assertOk`-shaped client reads a wholly-forged upload as success.
10. **`NOT_A_CITIZEN → 422` on `/v1/identities/verify` is unproven** — no
    selfcheck exercises it and the NIDA mock has no non-citizen fixture. An
    unproven branch on the route that gates eligibility.
11. **`biometric-service` registers no readiness probe**, so `GET /ready` always
    answers `200` regardless of dependency health. A liveness check wearing a
    readiness name; an orchestrator will route traffic to a service whose
    matcher is down.

---

## Two decisions needed before the next pass

1. **Item 6** — narrow `mapOutcome` per command, or accept that the contract
   documents a wider union than any single route can emit?
2. **Item 7** — are the 502/503 `detail` strings wanted (`expose: true`) or
   dead? The wire shape differs either way, and the error UI is built on the
   answer.

---

## Scripts

```bash
pnpm --filter @usrp/contracts typecheck   # the only one that runs today
pnpm --filter @usrp/contracts generate    # not built
pnpm --filter @usrp/contracts verify      # not built
```

`generate` and `verify` are deliberately zero-dependency beyond `zod`: a
contract tool that pulls a supply chain into a national deployment is the wrong
trade for a few hundred lines of parsing.
