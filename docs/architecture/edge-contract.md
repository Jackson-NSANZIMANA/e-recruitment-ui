# The USRP Edge Contract — specification for the BFF the backend must build

**Status:** Specification. The edge does not exist as a deployment.
**Audience:** the backend team who will build `services/citizen-bff` and `services/agency-bff`.
**Verified against:** backend `47d9ad3` (`main`) and `@usrp/contracts` (frontend).
**Proven by:** `tooling/edge-dev` — 143 assertions over real sockets, `node --experimental-strip-types tooling/edge-dev/selfcheck/verify-edge.ts`.

---

## 0. What already exists, and what does not

The frontend documentation says the backend "exposes four BFF services". It does
not. `services/` contains exactly eleven directories and none is a BFF.

But "no BFF exists" is too coarse to plan from, and it is what made this look like
a greenfield design problem. The truth is more useful: **the edge's configuration
contract, cookie primitives and CORS policy are already built and committed.**
What is missing is roughly three files of composition.

| Piece | State | Where |
|---|---|---|
| `loadEdgeSessionConfig` — handle HMAC key, idle TTL, absolute TTL, cookie Secure flag, with cross-field validation | **Built** | `packages/shared-config/src/config.ts` |
| `loadCorsConfig` — exact-match origin allow-list | **Built** | same |
| `loadAgencyDeploymentConfig` — `AGENCY` selector for the one-codebase-three-deployments model | **Built** | same |
| `serializeSetCookie` / `parseCookieHeader` with **enforced** `__Host-` invariants and first-occurrence-wins parsing | **Built** | `packages/shared-http/src/cookies.ts` |
| `HttpResult.cookies` as a first-class field, because a login must emit two Set-Cookie headers | **Built** | `packages/shared-http/src/types.ts` |
| CORS with `Allow-Credentials`, exact origin echo, `Vary: Origin` on rejection, `x-csrf-token` in the allowed-headers list | **Built** | `packages/shared-http/src/cors.ts` |
| `PORT_CITIZEN_BFF=4020`, `PORT_AGENCY_BFF=4021`, `PORT_ADMIN_BFF=4024`, `EDGE_SESSION_*`, `EDGE_COOKIE_SECURE`, `CORS_ORIGINS` | **Committed** | backend `.env.example` |
| A deployment that composes them | **MISSING** | — |

`cors.ts` even carries the comment *"the edge CSRF defence is a double-submit echo
(see the BFF slice)"*, and `cookies.ts` opens with *"the edge (BFF) tier keeps the
upstream credential SERVER-SIDE and hands the browser an opaque handle"*.

**So this document is not proposing a design. It is writing down the design the
backend already encoded in its configuration layer, completing the parts that were
left implicit, and specifying the routes.** Where a decision was already made in
code, this document follows it rather than re-deciding it.

One correction to the brief that shaped this work: **ports 4021–4024 are not
"reserved for nothing"**. They are named, loaded by real loaders, and the
topology behind them (one cross-agency citizen edge, one agency codebase with
three deployments, one admin edge) is already a decision on the record.

---

## 1. Why an edge is REQUIRED, not optional

This is the load-bearing section. If the edge is treated as an optimisation, it
will be dropped under schedule pressure and the SPA will talk to services
directly. That produces a system that appears to work.

### 1.1 The browser must never hold an officer's Ed25519 JWT

Officer tokens are asymmetric bearer JWTs minted by iam-service, the sole
private-key holder, and verified by every other service with the public key alone.
They carry `kind:'officer'`, the agency claim, and roles, and they last one hour.

They are **non-revocable until expiry, by design.** There is no token blacklist,
no introspection endpoint, no `terminated_at`. Nothing in the platform can recall
one.

Put that token where JavaScript can read it and a single XSS anywhere in the
officer console yields a credential that is valid for up to an hour, opens every
officer route across the whole platform, and **cannot be cancelled**. Not by
changing the officer's password, not by disabling their account, not by anything.
The only mitigation is waiting.

### 1.2 The browser must never hold a citizen's session token

This is the sharper argument, because it is about a decision the backend made
deliberately and paid for.

ADR-018 records owner decision D5: the citizen session is a 32-byte crypto-random
opaque token in `public_core.applicant_sessions`, **not** a JWT. The first reason
given is immediate revocation — `terminated_at` kills a session at its next
request, proven live (logout → 401, erasure → 401). The ADR states the motivation
plainly: *"Citizens lose phones; a stateless token can't be recalled before
expiry."*

The platform gave up statelessness — a DB read on every authenticated citizen
request, forever — to buy revocability.

**A revocable token stored in `localStorage` is a revocable token that has already
been copied.** Revocation cancels the row; it does not un-exfiltrate the string.
The property the backend paid for is only worth something if the token lives
somewhere script cannot reach, and in a browser there is exactly one such place: an
`httpOnly` cookie the SPA cannot read.

So an edge is not a convenience layer over a REST API. **It is the component that
makes ADR-018's central decision mean anything.** Without it, the platform accepted
a permanent per-request database cost for a security property it then discarded in
the client.

### 1.3 There are two credential kinds and neither is a cookie

| | Officer | Citizen |
|---|---|---|
| Form | Ed25519 bearer JWT | opaque 32-byte random |
| Store | stateless, signed | `applicant_sessions` row |
| Lifetime | 1 hour fixed | 30-min **sliding** |
| Revocable | **no** | yes, immediately |
| Verified by | `shared-auth`, public key | identity-service, own table |
| Failure code | `401 UNAUTHENTICATED` | `401 INVALID_SESSION` |

Same status, different codes, different services, different mechanisms. A frontend
that models "the JWT" has already lost the distinction that matters, and the
distinction is what stops an applicant session reaching an officer route.

### 1.4 Three browser-needed routes are system-token-only

`GET /v1/applications/by-applicant`, `POST /v1/applications/withdraw-own` and
`POST /v1/identities/verify` are `kind:'system'`. A browser cannot hold a system
token — it opens **every** system door platform-wide (ADR-016 follow-on #2: per
-service scopes do not exist yet), and the credential store that mints them is
readable by `usrp_iam_service` alone precisely so that workers cannot harvest
minting material.

Somebody has to authenticate the human and then call those routes as a machine.
identity-service already does this for `me/applications` and ADR-018 calls it
dogfooding ADR-016. The edge inherits that pattern. **There is no version of this
system where the browser reaches those routes directly.**

### 1.5 Exact-path routing is not a browser-shaped API

`shared-http` matches paths exactly and has no param syntax (ADR-005). Single-record
reads are `?applicationId=`. `list-applications.controller.ts` says it outright:
*"Restoring REST ergonomics for the browser is the edge tier's job, not the
service's."* The service has already assigned this work to a component that does
not exist.

### 1.6 Deployment shape forces it too

`CORS_ORIGINS` is an exact-match allow-list and credentialed requests forbid `*`.
Eleven services each emitting correct credentialed CORS for two SPA origins is
eleven places to get it wrong. `cors.ts` already says an internal microservice
*"should emit no CORS headers at all"*.

---

## 2. Topology

Already decided in `.env.example`, and this document does not revisit it.

```
apps/applicant-portal  :3000 ──────────► citizen-bff        :4020   ONE deployment, cross-agency
                                              │
apps/officer-console   :3001 ──────────► agency-bff (RDF)   :4021   ONE codebase,
                                         agency-bff (RNP)   :4022   THREE deployments,
                                         agency-bff (RCS)   :4023   AGENCY selects
                                              │
                                         admin-bff          :4024   named, no routes yet
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                         ▼                         ▼
             iam-service :4011      identity-service :4001    application-service :4006
                                        (+ eight more)
```

**citizen-bff is ONE cross-agency deployment.** `.env.example` gives the reason:
`GET /v1/applicants/me/applications` unions all three ops schemas, and ADR-014's
accept-lock means a citizen inherently spans agencies. A per-agency citizen edge
could not serve its own core route.

**agency-bff is ONE codebase with three deployments.** Also from `.env.example`:
*"Three codebases would be three places to forget the same security fix."* Each
deployment sets `AGENCY` and its own `PORT_AGENCY_BFF`.

Each agency-bff deployment **must** have its own hostname in production
(`rdf.usrp.gov.rw`, `rnp.usrp.gov.rw`, …). With `__Host-` cookies this makes a
session cookie physically unable to cross deployments — the browser will not send
it. That is a stronger boundary than any check the edge could perform, and it is
free.

The port map is published, as data, at `tooling/edge-dev/PORTS.md`.

---

## 3. The session cookie

### 3.1 Shape

```
Set-Cookie: __Host-usrp_session=<32 bytes base64url>; Path=/; Max-Age=1800; SameSite=Strict; Secure; HttpOnly
Set-Cookie: __Host-usrp_csrf=<32 bytes base64url>;    Path=/; Max-Age=1800; SameSite=Strict; Secure
```

Two cookies per login. This is why `HttpResult.cookies` is a first-class field
rather than a header: a `Record<string, string>` header map can express exactly one
`Set-Cookie`, so the header map cannot represent a correct login response at all.

| Attribute | Why |
|---|---|
| `__Host-` | Host-locks the cookie. **`*.gov.rw` is ONE site for cookie purposes**, so without this prefix any other Rwandan government host could set a `Domain=.gov.rw` cookie that shadows ours. The prefix makes our cookie unwritable by any host but the exact one that set it. |
| `HttpOnly` | The session cookie only. See §3.2 for why the CSRF cookie is not. |
| `Secure` | Required by `__Host-`. `serializeSetCookie` **throws** if it is missing, because browsers silently drop such a cookie and a silent auth failure is the worst failure mode available. |
| `Path=/` | Required by `__Host-`. |
| no `Domain` | **Forbidden** by `__Host-`. That host-locking is the entire reason for the prefix. |
| `SameSite=Strict` | Necessary, insufficient. See §4. |
| `Max-Age=1800` | Tracks the sliding idle window; re-issued on refresh so the cookie does not lapse while the server session lives. |

The value is an **opaque handle** and nothing else. Not a JWT, not encrypted state,
not a signed blob. A handle carries no information, so no client-side parsing can
ever be attempted, and rotating the store's contents does not change the client
contract.

**Dev exception, and only this one:** `EDGE_COOKIE_SECURE=false` over plain-http
localhost means the `__Host-` prefix must be dropped, because a browser would
silently discard the cookie. The dev edge uses `usrp_session_dev` /
`usrp_csrf_dev` and **prints why on every boot**. The backend's production guard
already refuses to boot with `EDGE_COOKIE_SECURE=false`.

### 3.2 The CSRF cookie is readable, on purpose

`__Host-usrp_csrf` has no `HttpOnly`. That is not an oversight: the SPA must read
it to build the `x-csrf-token` header, which is the entire double-submit mechanism.

It is not a credential. On its own it authenticates nothing and is useless without
the session cookie. A cross-site attacker can cause the session cookie to be sent
but cannot read the CSRF cookie to build the header, because reading it requires an
XHR from our origin and CORS refuses that.

### 3.3 Storage: keyed hash, not the handle

Store `HMAC-SHA256(EDGE_SESSION_HMAC_KEY, handle)`, never the handle. A leaked
database dump is then not a set of replayable sessions, because the key lives in
the process (an HSM in production) and not in the table. Exactly the posture the
platform applies to `NATIONAL_ID_HMAC_KEY`.

Note this makes the edge **stricter than identity-service**, whose own session
token is stored verbatim today — ADR-018 follow-on #2. Worth closing there too.

### 3.4 Two TTLs, because one is a bug

```
EDGE_SESSION_IDLE_TTL_SECONDS=1800       sliding, refreshed on activity
EDGE_SESSION_ABSOLUTE_TTL_SECONDS=43200  hard ceiling, never extended
```

The idle window matches ADR-018's 30 minutes. The ceiling exists because **a
sliding TTL alone is an immortal session**: a thief's own traffic keeps it alive
forever. `loadEdgeSessionConfig` already cross-validates that the ceiling is not
below the idle window, and refuses to boot otherwise.

Order of evaluation matters: check the ceiling **before** sliding, so a request
arriving at the ceiling cannot extend past it.

The two limits need **different UX**. "You were away too long" and "sessions end
after 12 hours regardless of activity" are different sentences, and showing the
wrong one makes the product look broken. The edge must therefore distinguish them
in `GET /edge/v1/session` **before** expiry — never in the 401 after it, which
stays uniform.

---

## 4. CSRF: `SameSite=Strict` is necessary and NOT sufficient

Three reasons, all concrete:

1. **It is a browser-enforced control, not a server-side assertion.** A caller that
   is not a browser does not honour it. The edge asserts nothing by setting it.
2. **It does not address same-site attackers.** `*.gov.rw` is one site. Every other
   Rwandan government host on that registrable domain is same-site: RDF, RNP, RCS,
   and every unrelated ministry. A stored XSS on any of them can cause requests
   that carry our cookie. `__Host-` stops such a host **writing** our cookie;
   nothing stops it **causing a request** that sends it.
3. **One shim voids it silently.** A method-override helper or a legacy-client
   carve-out, added by someone who has not read this document.

So the edge performs **two independent server-side checks on every unsafe method**.

### 4.1 Origin pinning

`Origin` must **exactly** equal an entry in `CORS_ORIGINS`. Exact string equality
against a list — never prefix, suffix or substring matching, which is how
`evil-gov.rw.attacker.com` gets in.

**A missing `Origin` on an unsafe method is a rejection, not a pass.** "Absent" is
the one value an attacker can always arrange, and on a government write path the
default must be refusal. Safe methods are exempt: a `GET` with no `Origin` is an
ordinary top-level navigation.

### 4.2 Double submit, bound to the session

The `x-csrf-token` header must match the value **bound to this session in the
store**, compared in constant time.

Bound to the session, not merely cookie-against-header: a bare cookie/header
comparison accepts any pair an attacker can set both halves of. Comparing against
the server-side session means a forged pair belongs to no session.

`cors.ts` already lists `x-csrf-token` in its allowed request headers.

### 4.3 Both, not either

Origin pinning fails open when an intermediary strips headers. Double-submit fails
open against script running on our own origin. **Neither covers the other**, so
both are required, and both are asserted in `verify-edge.ts`.

### 4.4 Cookie-jar determinism is a precondition

`parseCookieHeader` is first-occurrence-wins. A duplicate cookie name is the
classic shadowing trick, and a **deterministic** jar is what makes the double-submit
comparison mean anything at all. Already implemented; do not "fix" it to
last-wins.

---

## 5. Mapping one browser session onto two backend credentials

```
browser                     edge                                  backend
────────────────────────────────────────────────────────────────────────────────
opaque handle    ──────►    session store
(httpOnly cookie)           handleHash ──► { kind:'officer',   ──► Authorization:
                                              token, agency,        Bearer <Ed25519 JWT>
                                              roles, expiresAt }

                                        ──► { kind:'applicant', ──► Authorization:
                                              token, expiresAt }     Bearer <opaque 32B>

                                        ──► SystemTokenProvider ──► Authorization:
                                            (client credentials,      Bearer <system JWT>
                                             15-min TTL, cached)
```

One cookie shape, three upstream credential kinds, and the browser can distinguish
none of them. That is the point: **the browser's credential is a handle with no
type**, so it cannot be misused as the wrong kind.

### 5.1 Officer login

```
POST /edge/v1/auth/officer/login   { loginHandle, password }
  → iam-service POST /v1/auth/officer/login
  → 200 { token, expiresAt }
  → mint handle, store the JWT server-side
  ← 204 + two Set-Cookie
```

**`loginHandle`, not email.** `officer_accounts.login_handle` is a `varchar(128)`
and there is no email column in the credential store.

**204, with no body.** There is nothing safe to return; the contract's negative
fixtures already reject a user object on the officer login response. The SPA then
calls `GET /edge/v1/session`.

**One rejection.** iam-service returns one 401 `INVALID_CREDENTIALS` for unknown
handle, wrong password **and disabled account**. The edge must not widen it and
neither may the UI. A single "no account with that handle" turns a deliberate
non-enumeration property into a user-enumeration oracle for the national security
services' staff directory.

The edge reads the JWT's `agency`/`roles` claims **without verifying the signature**,
only to label the session for the UI. This must stay commented or someone will
"fix" it into a security control: the token was just minted by iam-service over a
trusted channel, every downstream service verifies it on every call, and if this
parse is wrong RLS still refuses the rows.

### 5.2 Citizen OTP

```
POST /edge/v1/auth/applicant/otp/request  { nationalId, channel }
  → identity-service, retried on a 503 G2G fault
  ← 202 { status: 'CHALLENGED' }   ← BYTE-IDENTICAL, always

POST /edge/v1/auth/applicant/otp/verify   { nationalId, otp, channel }
  → identity-service
  → 200 { sessionToken, expiresAt }       ← the token DIES AT THE EDGE
  ← 204 + two Set-Cookie
```

The 202 must be byte-identical across all four input classes: real send, unknown
NID, unverified identity, phoneless NIDA record. Status, body, `content-type`, and
every header the edge controls. A response-size or timing difference is a NIDA
lookup oracle for anyone with a list of national ID numbers, and in this domain
that list identifies people applying to the security services.

The 5-attempt lockout and 5-minute TTL are **not observable**: every verify
failure — no challenge, expired, locked, wrong code, replay — is one identical
401. The client must therefore *track* both locally and must never claim to have
detected which. See `packages/auth/src/otp-machine.ts`.

### 5.3 System-token brokering

Client credentials against `POST /v1/auth/service/token`, 15-minute TTL, cached
and refreshed with 60 seconds of margin so an in-flight request cannot straddle
expiry. A failure here is `502 EDGE_SYSTEM_TOKEN_UNAVAILABLE` — **never a 401**,
because the edge's broken machine identity is not the citizen's fault and must not
ask them to sign in again.

### 5.4 The refusal list

Service-internal routes the edge must **never** expose, brokered or otherwise.
Enforced as data in `tooling/edge-dev/src/upstream-routes.ts` and checked against
the contract.

| Operation | Why refused |
|---|---|
| `submitApplication` | Browser-reachable, it would let anyone submit for any `applicantId`, bypassing the ADR-018 identity binding entirely. This is the dangerous one, because it looks like the obvious thing a portal should call. |
| `listApplicationsByApplicant` | identity-service already brokers it behind `me/applications`; a second door would skip the session check. |
| `withdrawOwnApplication` | The citizen door derives `applicantId` from the session instead of trusting a body field. |
| `checkAge/Education/DegreeEligibility` | A caller who can invoke these can probe eligibility for arbitrary applicants. |
| `analyzeDocument` | Returns forensic scores — a forgery-tuning oracle. |
| `uploadDocument` | System write; a citizen upload must bind to the session. |

**`verifyIdentity` is the one declared exception**: the contract marks it
service-internal, and ADR-012 D1 widened `withAuth` to accept officer principals so
a field officer can establish identity at a venue. The edge forwards the
**officer's own** credential, not a system token, so the audit trail attributes the
walk-in registration to the officer rather than to the edge.

The sweep that matters: **every service-internal operation must be either
explicitly brokered or explicitly refused.** Silence is not a decision.

---

## 6. Agency scoping: asserted at the edge, ENFORCED by RLS

> The edge asserts the agency. **PostgreSQL enforces it.** The SPA does neither.

- **PostgreSQL** — FORCE'd row-level security, per-agency NOLOGIN group roles, no
  bypass principal anywhere in the platform. This is the control. An officer who
  reaches another agency's data gets zero rows, from the database engine.
- **The edge** — asserts that the session's agency matches this deployment's
  `AGENCY` and returns `403 WRONG_AGENCY_DEPLOYMENT` otherwise. **Defence in depth
  and a clear error message.** Without it the officer sees an empty list and files
  a bug.
- **The SPA** — `AgencyGuard` is routing and presentation. It can be defeated with
  developer tools in seconds and that is fine, because it defends nothing.

This ordering must be stated in exactly this way in code comments and
documentation, because the failure mode is specific: describe a presentational
guard as a security boundary, and a later reader deletes the real control as
redundant. `frontend-architecture.md` §6.2 got close enough to this to be
dangerous, and `packages/auth/src/guards.tsx` now carries the correction.

There is **no superadmin escape hatch.** RLS is FORCE'd, `officer_accounts` carries
`roles: string[]`, and no cross-agency principal exists. A "SUPERADMIN, no RLS"
role is not merely absent from the platform — it is unrepresentable.

---

## 7. Fan-out and aggregation

### 7.1 One browser request may become several upstream calls

The officer detail screen needs `by-id` **and** `status-history`; no single
endpoint provides both. `GET /edge/v1/applications/detail?applicationId=` issues
both concurrently and returns one body.

### 7.2 `Promise.all` is wrong for an aggregate read

Use `Promise.allSettled` and classify:

- **PRIMARY** read fails → the response fails. A detail screen with no application
  is not a screen.
- **SECONDARY** read fails → that panel is `null` and the response names it in
  `partial: ['history']`.

```json
{ "application": { "agency": "RDF", "application": { ... } },
  "history": null,
  "partial": ["history"] }
```

With `Promise.all`, one 404 on a side panel discards a perfectly good primary
payload and renders a blank error page. Naming the gap lets the UI render what
exists and say honestly which panel is missing — which is also the only honest way
to present a Procedural Justice surface that is partly unavailable.

### 7.3 Status codes pass through unchanged

The edge removes credentials and internal keys. It does **not** re-interpret
outcomes. A `409 CROSS_AGENCY_LOCKED` flattened into a generic 400 costs the
officer the one fact that explains what happened; a `422 INVALID_MEDICAL_INPUT`
flattened costs them the reason naming their agency's mode; a
`501 UNSUPPORTED_AGENCY` flattened turns a permanent answer into an infinite retry.

### 7.4 Response scrubbing (invariant 2)

Every body crossing to a browser is walked and these keys are dropped at any
depth: `nationalIdHash`, `nationalId`, `rawNationalId`, `sessionToken`, `token`,
`accessToken`, `clientSecret`, `password`, `registeredPhoneNumber`, `phoneNumber`,
`phoneNumberHash`, `otp`.

This is a **belt**. The braces are the contract's 44 negative fixtures. The belt
exists because the edge outlives any one schema version: a field added upstream
tomorrow ships to production before anyone regenerates a client.

It **counts and logs** what it strips, and the count is asserted in the selfcheck.
A silent filter is how a leak becomes permanent — the leak stops being *visible*
without ever being *fixed*.

### 7.5 Retry: named G2G 503s only

Retry a `503` whose code is one of `NIDA_UNAVAILABLE`, `NESA_UNAVAILABLE`,
`RIB_UNAVAILABLE`, `HEC_UNAVAILABLE`, `SCANNER_UNAVAILABLE`,
`ELIGIBILITY_STORE_UNAVAILABLE`, `UPSTREAM_UNAVAILABLE`, on an operation declared
retryable, twice, with full-jitter backoff.

Everything else fails once:

| | Why not retried |
|---|---|
| `500` | A persistence fault may have committed before failing. A retried transition could apply twice, and `status_history` is append-only. |
| `502` | An unreachable dependency is indistinguishable from one that half-completed. |
| `409` | State disagreement; retrying cannot change it. `AGE_PENDING` is the **officer's** retry while the candidate stands at the desk, not a silent client retry that hides a state they need to see. |
| `401` | Retrying with the same dead session is a loop. |
| unrecognised `503` | Not evidence of a transient foreign system. Treating it as one turns a real outage into a thundering herd. |

**No write is ever retried.** `POST /v1/field-sync/scores` already proves this
platform can answer `200 {status:'SYNCED'}` on a batch where every record was
rejected for `BAD_SIGNATURE`; an `assertOk`-shaped client with retries on top is
how a field officer is told their exam-day scores are saved when none of them are.

Full jitter, not fixed backoff: three tabs of one console retrying in lockstep is a
small DDoS against a G2G tunnel that is already struggling.

---

## 8. Correlation-id propagation

**Inherit `x-correlation-id`. Do not reinvent it.**

`shared-http` already takes the inbound `x-correlation-id` or mints a fresh one,
echoes it on the response, mints a separate always-fresh `x-request-id`, and seeds
the correlation id into the Kafka event context — so an HTTP request and every
event it causes share one trace id.

The edge's obligations:

1. **Accept** an inbound `x-correlation-id` from the browser.
2. **Mint** one when absent.
3. **Forward it verbatim** to every upstream call in the fan-out. Generating a
   fresh id per hop severs exactly the join that makes the trail readable.
4. **Echo** it to the browser, and expose it via
   `Access-Control-Expose-Headers` — already the default in `cors.ts`.
5. **Mint a distinct `x-request-id`** per edge request.

One user action gets **one** correlation id even when it fans out to several
services. `@usrp/api-client` lets a caller pass a `correlationId` explicitly so
that a three-call walk-in flow is one trace instead of three unrelated ones.

The result is a chain a support engineer can actually walk:

```
browser click → edge request → 2 upstream calls → domain events → Kafka → audit_log
                     one x-correlation-id, end to end
```

---

## 9. The edge surface

Exact paths, ids in bodies or query params. The edge does **not** restore
`/applications/:id` ergonomics, deliberately: if it did, `@usrp/api-client` would
grow interpolated URLs, the build guard would have to permit them, and that guard
is the only thing standing between this codebase and the class of bug invariant 1
exists to prevent. One rule everywhere beats a rule with an exception.

### 9.1 Both deployments

| Method | Path | Notes |
|---|---|---|
| `GET` | `/edge/v1/session` | Session metadata. **No token.** Replaces the `/auth/me` fiction. |
| `POST` | `/edge/v1/session/refresh` | Slides the idle window and re-issues the cookies. |
| `GET` | `/edge/health` | Liveness. |
| `GET` | `/edge/ready` | Readiness — **checks the upstreams**. An edge that is "up" while iam-service is unreachable serves nothing but 502s, and reporting that as ready is how a rollout completes into an outage. |

### 9.2 agency-bff

| Method | Path | Upstream |
|---|---|---|
| `POST` | `/edge/v1/auth/officer/login` | `officerLogin` |
| `POST` | `/edge/v1/auth/officer/logout` | — (clears; always succeeds) |
| `GET` | `/edge/v1/applications` | `listApplications` |
| `GET` | `/edge/v1/applications/amber-queue` | `listAmberQueue` |
| `GET` | `/edge/v1/applications/by-id` | `findApplicationById` |
| `GET` | `/edge/v1/applications/status-history` | `getApplicationStatusHistory` |
| `GET` | `/edge/v1/applications/detail` | **aggregate** of the two above |
| `POST` | `/edge/v1/applications/medical-review` | `recordMedicalReview` |
| `POST` | `/edge/v1/applications/final-decision` | `recordFinalDecision` |
| `POST` | `/edge/v1/applications/accept` | `acceptApplication` |
| `POST` | `/edge/v1/applications/adjudicate` | `adjudicateApplication` |
| `POST` | `/edge/v1/applications/walk-in/register` | `registerWalkIn` |
| `POST` | `/edge/v1/applications/walk-in/vet` | `vetWalkIn` |
| `POST` | `/edge/v1/identities/verify` | `verifyIdentity` (brokered, officer credential) |
| `GET` | `/edge/v1/identities/erasure-requests` | `listErasureRequests` |
| `POST` | `/edge/v1/identities/erasure-requests/decline` | `declineErasureRequest` |
| `POST` | `/edge/v1/identities/erasure` | `eraseIdentity` |

**FOUR transitions, not three.** `accept` is ADR-014's cross-agency lock — the
write that stops one citizen being accepted by two agencies, and the only route
that emits `409 CROSS_AGENCY_LOCKED`. Ship the console without it and the console
cannot complete a recruitment; the first person who needs it will hand-roll a raw
`fetch`, putting the most safety-critical write in the platform outside the typed
layer. (`officer-transitions.controller.ts`'s own header says "Three
OFFICER-authenticated write endpoints" and then exports four.)

### 9.3 citizen-bff

| Method | Path | Upstream |
|---|---|---|
| `POST` | `/edge/v1/auth/applicant/otp/request` | `requestApplicantOtp` |
| `POST` | `/edge/v1/auth/applicant/otp/verify` | `verifyApplicantOtp` |
| `POST` | `/edge/v1/auth/applicant/logout` | `logoutApplicant` — **revoke upstream first** |
| `GET` | `/edge/v1/me/applications` | `listMyApplications` |
| `POST` | `/edge/v1/me/applications/withdraw` | `withdrawMyApplication` |
| `GET` | `/edge/v1/me/erasure-request` | `getMyErasureRequest` |
| `POST` | `/edge/v1/me/erasure-request` | `fileMyErasureRequest` |

Logout revokes upstream **before** dropping the edge session. The other order
leaves a live citizen session in identity-service that nothing can now reach — the
exact opposite of what ADR-018 bought.

### 9.4 Error shape

The edge emits the backend's own shapes: `{ error, detail? }` for transport and
infrastructure faults, `{ status, ... }` passed through for business outcomes,
and `detail` only on 4xx (`expose = status < 500`).

Every session rejection is **one** `401 {"error":"NO_SESSION"}` — no cookie,
unknown handle, idle timeout, absolute ceiling, revoked. An applicant session on
an officer route is also 401, **not 403**: a 403 would confirm to a citizen that
the route exists.

---

## 10. What the backend must build

1. `services/citizen-bff` and `services/agency-bff`, on `@usrp/shared-http` with
   `cors` supplied and the routes in §9.
2. A **durable, shared** session store — Postgres or Redis. An in-process map
   cannot survive a restart or be shared across instances. Handles stored
   keyed-hashed (§3.3).
3. Wire the three existing loaders (`loadEdgeSessionConfig`, `loadCorsConfig`,
   `loadAgencyDeploymentConfig`). They are built and nothing calls them.
4. `assertProductionSecrets()` as the first statement of `main()`, like the other
   eleven services.
5. `scripts/verify-dev-boot.sh` must boot the edges too, on their own ports, so
   this surface joins the gate. **A surface no proof executes will drift** — that
   is the lesson `dev-boot-and-env-contract.md` was written to record.
6. **Rate limiting.** ADR-018 follow-on #1 and the officer-login follow-on both
   flag per-NID and per-IP throttling as absent platform-wide. The edge is the
   right place for it, and OTP request is an SMS-cost amplifier as well as a
   brute-force surface.
7. A selfcheck in the house style, registered as a gate section. `verify-edge.ts`
   is a working template: 143 assertions over real sockets.

---

## 11. Deliberately out of scope

- **admin-bff routes.** `PORT_ADMIN_BFF` is named; nothing in the platform serves
  a superadmin surface, and RLS admits no bypass principal, so specifying routes
  for it would be inventing a role the database refuses to honour.
- **File upload through the edge.** `uploadDocument` is a system-token multipart
  route and needs its own decision about how a citizen upload binds to a session.
- **USSD.** ADR-018's session row carries `ussd_state`; the menu machine does not
  exist. A USSD session is not a cookie session and must not be modelled as one.
- **mTLS between edge and services.** ADR-016 follow-on #3. Worth doing; a
  hardening step, not a substitute for anything here.

---

## 12. Proof

```bash
# 143 assertions over real sockets, contract mocks, no infrastructure required
node --experimental-strip-types tooling/edge-dev/selfcheck/verify-edge.ts

# 124 assertions: OTP machine, sliding-TTL planner, session union, copy non-leakage
pnpm --filter @usrp/auth selfcheck

# 96 assertions: error normalisation over the real bodies, retry refusals, invalidation map
pnpm --filter @usrp/api-client selfcheck

# the exact-path build guard, self-tested in both directions
pnpm --filter @usrp/api-client check:paths

# drift: this contract's upstream route table vs @usrp/contracts
pnpm --filter @usrp/edge-dev check:contracts
```

What the socket-level proof asserts, in the backend's spirit — the negatives are
the point:

- officer login → scoped list, and unknown handle / wrong password / **disabled
  account** are byte-identical 401s;
- OTP request is byte-identical across **all four** input classes, in status, body
  and `content-type`;
- the lockout at 5 is real: the correct code fails afterwards, identically;
- session revocation → **401 on the very next request**;
- no token and no `nationalIdHash` is reachable from anything the browser sees, and
  the scrubber's strip **count** is asserted so the belt is proven to have engaged
  rather than assumed;
- a correlation id sent by the browser is the same id the upstream observed;
- a write is attempted **exactly once**; a G2G 503 is retried exactly twice;
- the absolute ceiling ends a continuously-active session;
- the transport **refuses** a templated route, and the port map **detects** a
  collision.
