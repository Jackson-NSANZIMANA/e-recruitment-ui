# ADR-FE-002 — The frontend holds no URL strings

**Status:** Accepted · 2026-08-30

## Context

`@usrp/shared-http` matches paths **exactly** and has no parameter syntax
(ADR-005). IDs travel in the POST body or a GET query parameter. Any
`/resource/${id}` URL is a 404, not a style disagreement.

The previous frontend had `{ path: 'applications/:id' }` in its router and an
api-client shaped around path params. Both are the forbidden shape, and a lint
rule against `${` in a template literal is a rule someone silences.

Separately, 32 of the current 59 service operations are `reach: 'service-internal'`:
they take a system credential the browser does not have. Calling one from a tab is
a security incident, not a 403. The 27 browser operations are separately reconciled
with the backend edge registry by gate D.

## Decision

Slices address the backend by **`operationId`** — a key in `@usrp/contracts`
`ROUTE_TABLE` — and the host app injects an adapter that resolves the id to a
method and an exact path:

```ts
export interface SliceTransport {
  call<T>(operationId: string, options?: { body?: unknown; query?: Record<string, string> }): Promise<T>;
}
```

Consequences, all of them wanted:

- `/applications/${id}` is not discouraged, it is **unwritable**: there is no URL
  to interpolate into.
- A typo names an operation that does not exist, and the adapter throws at wiring
  time rather than 404ing in Kigali.
- The adapter is built from `BROWSER_ROUTES`, so a service-internal route cannot
  be reached even by accident.
- `packages/testing/src/msw/transport.ts` is built from the **same generated
  data** as the mocks, so a test cannot pass against a path production would not
  use.

## Enforcement

The current proof is distributed across the api-client selfcheck, contract drift
(gates A-D), and the surface contract: no service URL from a slice, no interpolated
service path, no bare `fetch`/`XMLHttpRequest`/`axios`, every declared operation is
whitelisted, and only browser-reachable operations are exposed. The edge registry
also carries local session operations and exact retry policy.

## Requests

**Agent 2 (`packages/api-client`):** expose the resolver — `createTransport()`
returning the `SliceTransport` shape above, backed by `BROWSER_ROUTES`, attaching cookies, CSRF, correlation, and operation-owned retry policy. No browser
bearer token is attached. The typed `createApiClient` and `createEdgeAuthClient`
are the implemented adapters; new slices must depend on those boundaries.
