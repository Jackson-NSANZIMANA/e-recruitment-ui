# `@usrp/contracts`

**The only legal source of domain types in this frontend.**

OpenAPI 3.1 documents hand-authored from the backend controllers, Zod schemas
generated from those documents, TypeScript types inferred from those schemas, the
per-agency divergence model no OpenAPI document can express, and a drift checker
that fails the build when any of it stops matching the backend.

Verified against backend SHA
[`47d9ad3`](https://github.com/Jackson-NSANZIMANA/e-recruitment/commit/47d9ad3ab019f6d2f826cfae2136cbff898d733f)
(`main`).

```bash
pnpm --filter @usrp/contracts verify     # 6 gates, 1188 assertions
pnpm --filter @usrp/contracts generate   # openapi -> zod -> types
pnpm --filter @usrp/contracts typecheck
pnpm --filter @usrp/contracts drift -- --backend ../e-recruitment
```

---

## State: proven, with two named exceptions

| Artifact | State |
|---|---|
| `openapi/*.yaml` — 11 documents, 58 operations, 208 schemas | **Authored.** Every operation `controller-verbatim` except one, marked `proxy-derived` and named below. |
| `src/generated/**` — 24 files | **Generated.** Deterministic; `verify` asserts a zero diff. |
| `src/agency.ts` — divergence model | **Compiles** under the workspace's ultra-strict config. Previously written and never compiled. |
| `src/narrow.ts` — wire types x agency | **Compiles**, and the compile error was observed firing. |
| `tooling/contract-drift` | **Built**, with a selftest that proves it goes red. |
| Fixtures | **148 cases**, 44 of them negative. |
| **Assertions proven** | **1188** across 6 gates, plus `tsc` clean. |

**The two exceptions, stated plainly:**

1. **Drift gates B and C did not run in the authoring environment** — they need
   an `e-recruitment` checkout on disk. Gate A (OpenAPI vs pinned manifest, 177
   assertions) ran green. Run `pnpm --filter @usrp/contracts drift -- --backend
   ../e-recruitment` before treating the drift check as complete.
2. **`GET /v1/applicants/me/applications` is `proxy-derived`.** Its envelope is
   verbatim; its array element is `application-service`'s
   `ApplicantApplicationSummary`, asserted rather than re-read, because this pass
   did not open `adapters/applications.http-gateway.ts`. Everything else is
   transcribed field by field.

A contract that guesses is worse than one that admits a gap, because a guess
type-checks.

---

## Why this package exists

Both repos hand-maintained a separate `@usrp/shared-types`. The frontend copy
drifted until it described a different system:

| | Frontend `shared-types` | Reality |
|---|---|---|
| Application statuses | 17, of which **5 exist** | **19** |
| Invented statuses | 12 (`UNDER_REVIEW`, `SHORTLISTED`, `EXPIRED`, ...) | — |
| `TERMINAL_STATUSES` | contains `EXPIRED` (never existed), omits `WALK_IN_REJECTED` (real) | 4 for RDF, 3 for RNP/RCS |
| `DocumentType` | 6, of which **1** exists, modelled agency-agnostic | **11**, genuinely per-agency |
| `gender` | `MALE\|FEMALE\|OTHER` | `MALE\|FEMALE` — `OTHER` is unrepresentable end to end |
| `PaginatedResult<T>` | used everywhere | **nothing in the platform paginates** |
| `OfficerRole` | 5 roles incl. `SUPERADMIN` "no RLS" | `roles: string[]`; RLS is FORCE'd, no bypass principal exists |

In this domain a drifted type is not a rendering bug. Nineteen statuses, three
agencies with divergent enums and RLS-enforced isolation add up to a citizen
wrongly rejected from a career in the national security services.

**`packages/shared-types` is DEPRECATED and slated for deletion.** It is not
deleted yet — its consumers migrate in a later job. Do not add to it and do not
import it in new code.

---

## The layers, and why they are separate

```
openapi/*.yaml           WIRE TRUTH, hand-authored from controllers
   | generate
src/generated/*.zod.ts   Zod schemas (runtime validators)
   | z.infer
src/generated/*.types.ts TypeScript types
src/agency.ts            WHICH VALUES ARE LEGAL FOR WHICH AGENCY
src/narrow.ts            the JOIN — makes an unreachable status a COMPILE ERROR
```

Types are inferred from the schemas, never written beside them. One description
of each wire shape, so a schema that is wrong is wrong in both places at once and
cannot pass one gate while failing the other.

```ts
import { type Agency, type StatusFor, narrowRow } from '@usrp/contracts';

declare function lozengeFor<A extends Agency>(agency: A, status: StatusFor<A>): Appearance;

lozengeFor('RDF', 'WALK_IN_REGISTERED');  // ok
lozengeFor('RNP', 'WALK_IN_REGISTERED');  // TS2345 — the whole point
```

`rnp_ops` and `rcs_ops` carry no `WALK_IN_*` values. This is why the backend
compares `status::text` instead of casting to an enum: an enum-cast comparison
against `WALK_IN_REJECTED` is a hard error for two agencies out of three and
works fine for RDF, so it passes every test run against RDF fixtures and fails in
production for RNP and RCS. Adding a status without classifying it as shared or
RDF-only fails the build.

Generated schemas are **namespaced per service** — eleven services independently
name a schema `Uuid`, and three genuinely different bodies share the name
`Forbidden403`. A flat barrel would have to pick a winner and would silently hand
callers the wrong 403.

---

## The six invariants this package encodes

1. **Exact-path routing only.** `shared-http` matches paths exactly and has no
   param syntax (ADR-005). IDs travel in the request body (POST) or a query param
   (GET, `?applicationId=`). The loader **rejects** a templated path outright.
2. **The raw National ID is request-only**, and `nationalIdHash` is an internal
   cross-service key that must never reach the browser. Referenced by request
   bodies and by no response anywhere in these documents.
3. **Agency isolation is Postgres RLS.** Frontend guards are presentational and
   must never be documented as security.
4. **Two human credential kinds, not interchangeable.** Officers carry an
   Ed25519 bearer JWT (non-revocable until expiry, by design); citizens carry an
   opaque 32-byte revocable DB session with a sliding TTL (ADR-018). Neither is a
   cookie. Both JWT kinds fail `401 UNAUTHENTICATED`; the session kind fails
   `401 INVALID_SESSION` — same status, different code, same service.
5. **Browser-reachable vs service-internal is load-bearing.** Getting it wrong
   exposes a system-token route to a citizen, so it is modelled (`x-usrp-reach`,
   exported as `SERVICE_INTERNAL_ROUTES`) rather than left to reviewer memory.
   Drift gate A fails if a system-token route is marked browser-reachable.
6. **No-enumeration is a designed property.** Both single-record 404s are
   deliberately bare: a sibling agency's real application ID and a nonexistent one
   return byte-identical responses. The OTP request returns one identical `202`
   across at least four input classes. **UI copy must not leak what the API
   refused to leak.** Negative fixtures pin each of these.

---

## Fixtures: the negatives are the proof

`fixtures/*.fixtures.json` — 148 cases, **44 of them `"expect": "reject"`**. A
schema of `z.unknown()` accepts every positive fixture ever written, so a suite
of valid examples proves close to nothing. The negatives encode specific bugs
that shipped and specific invariants that must hold:

- `nationalIdHash` / raw NID / NIDA PII in a response — **rejected**
- the twelve invented statuses, including `EXPIRED` — **rejected**
- the `PaginatedResult` envelope — **rejected**
- a forensics score on the citizen upload response (the forgery-tuning oracle) — **rejected**
- venue and datetime on the citizen's application list (they exist nowhere) — **rejected**
- a user object on the officer login response — **rejected**
- `detail` on a 5xx (`expose = status < 500` discards every one) — **rejected**
- `detail` on the bare 404 (it would become a cross-agency existence oracle) — **rejected**
- the two `NOT_FOUND` shapes (`{error}` on reads, `{status}` on writes) crossed over — **rejected**
- the underscored / un-underscored `MISSING_APPLICANT_ID` spellings crossed over — **rejected**

Every case runs through **both** the zero-dependency structural validator and the
generated Zod schema, and `verify` fails if the two readers disagree.

---

## Two deliberate omissions in the generated output

**No `.datetime()` on any response timestamp.** The backend does not validate the
format of any timestamp it *returns*, so asserting one client-side would be a
constraint the platform never promised — and a validator that rejects real server
data is an outage with our name on it. Constraints the backend genuinely enforces
on the way *in* (UUID patterns, the NESA/HEC regexes, the length bounds) **are**
emitted. Two fixtures pin this so nobody "fixes" it by accident.

**`.strict()` on every closed object.** An unexpected key means the wire grew a
field this package has never read. That is the drift being hunted; it should fail
loudly, in development, on the first response that carries it.

---

## Live backend inconsistencies recorded, not smoothed over

Each is documented verbatim in the relevant operation and pinned by a fixture.

1. **`analyze-document.controller.ts` keys business outcomes on `error`, not
   `status`** — unique among fifteen controllers, so a client there cannot tell a
   business outcome from a transport fault. **Zero frontend consumers today, so
   re-keying it is the cheapest it will ever be.**
2. **Same file: `mapOutcome` has no `default`/`assertNever`.** Add an outcome
   variant and it compiles, returns `undefined` as an `HttpResult`, and the
   transport answers `200` with an empty body.
3. **`officer-transitions.controller.ts` header says "Three OFFICER-authenticated
   write endpoints"** and lists three; the file exports **four** and the factory
   returns four. Stale doc on the most safety-critical controller in the platform.
4. **`self-withdrawal.controller.ts:87`: `mapDomainError` throws** inside a
   function declared `: HttpError`, called as `throw mapDomainError(err)`. The
   declared contract is violated and the return path is dead code.
5. **`walk-in.controller.ts` builds codes by upper-casing field names**, yielding
   `MISSING_APPLICANTID` where every other controller emits
   `MISSING_APPLICANT_ID`. Two spellings of one code on one service.
6. **`runTransition` erases per-command outcome narrowing.** All four transitions
   share one `mapOutcome`, so at the type level every one can emit
   `422 INVALID_MEDICAL_INPUT` and `409 CROSS_AGENCY_LOCKED`. These documents
   record the real per-route narrowing; the HTTP layer is strictly looser than the
   behaviour it implements.
7. **Every 5xx/503 `detail` string is written and silently discarded.**
   `NIDA_UNAVAILABLE`, `SCANNER_UNAVAILABLE`, `ELIGIBILITY_STORE_UNAVAILABLE` and
   five others pass caller-facing hints nobody receives. Either `expose: true` or
   delete them — the error UI depends on which.
8. **403 has three incompatible bodies platform-wide:** `{error:'FORBIDDEN',
   detail}` from `withAuth`, `{error:'FORBIDDEN'}` from outcome branches, and
   `{status:'AGENCY_MISMATCH'}` from biometric-service. **No single discriminated
   union covers 403**, which is why `BiometricForbidden403` is an untagged
   `oneOf`.
9. **`POST /v1/field-sync/scores` returns `200 {status:'SYNCED'}` even when every
   record was `REJECTED` for `BAD_SIGNATURE`.** Correct batch semantics; means an
   `assertOk`-shaped client reads a wholly forged upload as success and tells a
   field officer their exam-day scores are saved when none of them are.
10. **`NOT_A_CITIZEN -> 422` on `/v1/identities/verify` is unproven** — no
    selfcheck exercises it and the NIDA mock has no non-citizen fixture. An
    unproven branch on the route that gates eligibility.
11. **`biometric-service` registers no readiness probe**, so `GET /ready` always
    answers `200` regardless of dependency health. Drift gate B asserts this fact,
    so the day it changes, the manifest goes red.
12. **`enroll-device.controller.ts` has no `try/catch` and no `mapDomainError`**,
    unlike every sibling, so a persistence fault surfaces as the transport's
    generic 500 with no service-specific code.

## Two decisions still needed

1. **Item 6** — narrow `mapOutcome` per command, or accept that the HTTP contract
   documents a wider union than any single route can emit?
2. **Item 7** — are the 502/503 `detail` strings wanted (`expose: true`) or dead?
   The wire shape differs either way, and the error UI is built on the answer.

---

## `openapi/proposed/` — endpoints that do not exist

Six specced operations the designed UI needs, **deliberately outside the loader's
glob** so nothing there can generate a client. `verify`'s proposed-isolation gate
asserts it on every run. A generated client for a nonexistent endpoint is worse
than no client: it type-checks, it looks finished, and it 404s in production.

See `openapi/proposed/README.md`. The two that hurt most:

- **`GET /v1/applicants/me/status-history`** — the transition trail is *this
  platform's own Procedural Justice surface* and it is **officer-authenticated**.
  The rejected applicant, the one person with an interest in it, cannot read it.
- **`GET /v1/applicants/me/slot`** — `SLOT_ASSIGNED` is projected onto the row and
  **no endpoint tells the citizen where or when to show up.**
