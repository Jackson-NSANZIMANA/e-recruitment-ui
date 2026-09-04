# ADR-FE-002 — The frontend holds no URL strings

**Status:** Accepted · 2026-08-30

## Context

`@usrp/shared-http` matches paths **exactly** and has no parameter syntax
(ADR-005). IDs travel in the POST body or a GET query parameter. Any
`/resource/${id}` URL is a 404, not a style disagreement.

The previous frontend had `{ path: 'applications/:id' }` in its router and an
api-client shaped around path params. Both are the forbidden shape, and a lint
rule against `${` in a template literal is a rule someone silences.

Separately, 32 of 58 operations are `reach: 'service-internal'`: they take a
system credential the browser does not have. Calling one from a tab is a security
incident, not a 403.

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

`proofs/02-exact-path-transport.mjs`, 177 assertions: no `/v1` literal anywhere in
a slice, no absolute URL, no interpolated path, no bare `fetch`/`XMLHttpRequest`/
`axios`, every declared or called `operationId` present in `ROUTE_TABLE` and
`reach: 'browser'`, and `verifyIdentity` still recorded as unreachable.

## Requests

**Agent 2 (`packages/api-client`):** expose the resolver — `createTransport()`
returning the `SliceTransport` shape above, backed by `BROWSER_ROUTES`, attaching
the officer bearer token or the opaque applicant session per the route's `auth`
kind. Until it exists, apps must wire their own; the port is stable.
