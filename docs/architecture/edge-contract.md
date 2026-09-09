# USRP Edge Contract: Current Authority

**Status:** Current frontend contract, 2026-09-08
**Supersedes:** the earlier multi-BFF specification in this file
**Backend authority:** `docs/architecture/adr/ADR-021-edge-tier.md`
**Frontend authority:** `packages/api-client/src/paths.ts` and `packages/auth/src/edge-client.ts`

This file used to describe separate `citizen-bff`, `agency-bff`, and `admin-bff` deployments. That topology is retired. Backend ADR-021 explicitly chooses **one edge service** under `/edge/v1/**`, with agency derived from the server-side officer session rather than supplied in a request path. Do not implement or document the old multi-BFF shape.

## 1. What is true now

The frontend has a complete, machine-checked consumer contract:

- `EDGE_OPERATIONS` is the single registry of browser operations, exact paths, methods, session kinds, upstream operation ids, and retry policy.
- `createApiClient` accepts an operation id, not an arbitrary URL. It sends cookies, CSRF, and correlation headers, and never sends `Authorization`.
- `createEdgeAuthClient` owns officer login, applicant OTP, session probing, refresh, and logout against the same edge origin.
- `assertPathsMatchContract()` rejects renamed, missing, templated, or unapproved upstream operations.

The backend repository has the edge OpenAPI contract at `services/edge-gateway/openapi/edge-v1.yaml` and the ADR, but the current `main` tree does not yet contain a runnable edge service package or entrypoint. The frontend is therefore contract-ready while the deployment tier remains incomplete.

## 2. Security boundary

The browser receives an opaque edge session handle in an `httpOnly` cookie. Officer JWTs and applicant session tokens stay server-side. The readable CSRF cookie is not a credential and must be echoed in `x-csrf-token` on unsafe requests.

The edge must preserve these invariants:

- no browser `Authorization` header;
- no `nationalIdHash`, upstream token, password, OTP, or client secret in browser responses;
- no generic status PATCH or DELETE operation;
- no retry of a state-changing write;
- no agency supplied by the browser as an authorization input;
- no enrichment of security-sensitive 401/404 responses that would enable enumeration.

Frontend route guards remain presentation only. Authorization and cross-agency isolation belong to the edge, backend services, and PostgreSQL RLS.

## 3. Contract shape

The current edge operation registry is the source of path truth. The edge surface includes:

- anonymous officer login and applicant OTP request/verification;
- session probe, refresh, and logout;
- officer application reads, amber queue, detail/history reads, walk-in operations, identity verification, erasure operations, and four distinct officer transitions;
- applicant-owned application and erasure operations.

Single-record reads use query parameters because the backend exact-path matcher does not support path parameters. The frontend must not invent `/applications/:id`, `/auth/me`, `/auth/login`, or per-agency BFF URLs.

## 4. Implementation status

The following frontend pieces are present and tested as repository code:

- edge operation registry and contract assertion;
- cookie/CSRF-aware auth client;
- operation-based API transport with named retry policy;
- session state machine and route guards;
- zero-dependency proof tooling under `tooling/edge-dev`.

The following remain open and must not be described as shipped:

- runnable backend edge composition and durable shared session storage;
- edge boot in the backend dev-boot proof;
- rate limiting for officer login and applicant OTP;
- the production deployment and readiness checks for the edge tier;
- mounting the six frontend feature slices into the two host routers.

## 5. Verification commands

```bash
# frontend, after install
pnpm --filter @usrp/api-client check:paths
pnpm --filter @usrp/api-client selfcheck
pnpm --filter @usrp/auth selfcheck

# backend edge contract and implementation proof
node --experimental-strip-types tooling/edge-dev/selfcheck/verify-edge.ts
pnpm --filter @usrp/edge-dev check:contracts
```

If this document conflicts with older prose, use backend ADR-021, the backend OpenAPI file, `EDGE_OPERATIONS`, and executable checks. A specification is not a deployed service, and a proof harness is not a production gateway.
