# `@usrp/contract-drift`

**Machinery instead of vigilance.** Two repositories each hand-maintained a
separate `@usrp/shared-types` and nothing kept them honest. This tool is the
thing that keeps them honest.

```bash
pnpm --filter @usrp/contracts drift                       # gate A only
pnpm --filter @usrp/contracts drift -- --backend ../e-recruitment   # + B and C
pnpm --filter @usrp/contracts drift:selftest              # prove it can go red
```

## Three gates

| | compares | needs a backend checkout |
|---|---|---|
| **A** | `packages/contracts/src/generated/routes.ts` ↔ `route-manifest.json` | no |
| **B** | `route-manifest.json` ↔ live backend source | yes |
| **C** | every exported `*_PATH` ↔ what `main.ts` actually mounts | yes |
| **D** | `packages/api-client/src/paths.ts` ↔ backend `edge-operations.ts` (method, path, session, retry, composition) | yes |
| **E** | contract parity v2 (S02, ADR-FE-012): request and response schemas, 409/422 outcome unions, Idempotency-Key requirement and scope — frontend source ↔ backend `edge-v1.yaml` | yes |

`route-manifest.json` is the middle term: hand-mined backend facts, pinned to a
SHA. Neither gate can be green while the other is stale — a backend change
applied to the manifest but not the OpenAPI fails A, and one applied to both but
not the backend fails B.

Fails on: a **missing** route, an **extra** route, a **changed method**, a
**changed auth kind**, a **system-token route marked browser-reachable**, a
**renamed path constant**, a **readiness probe that stopped checking anything**,
and a route that is **built and never mounted**.

## Gate E — contract parity v2

`src/parity.ts` reads the backend's `services/edge-gateway/openapi/edge-v1.yaml`
(with `src/yaml-lite.ts`, which accepts the flow style that document uses) and
compares, per operation matched by method + path:

| dimension | frontend side (read from source) | fails when |
|---|---|---|
| request | the `wire.ts` interface named in `PARITY_TABLE` | a required field is missing or optional; an extra field meets `additionalProperties: false` |
| response | the `wire.ts` interface named for a 2xx | the frontend requires a field the backend never sends |
| outcomes | the union / const named in `PARITY_TABLE` | a documented 409/422 code is not handled |
| idempotency | the api-client call site passes `idempotencyKey` | the backend requires a key the client does not send, or the reverse; or the documented replay scope stops naming actor, operation, key and body |

`PARITY_TABLE` only names WHICH symbol answers for an operation, never a
field. `KNOWN_DIVERGENCES` downgrades a matching finding to a note with its
reason and owner; an entry that matches nothing fails the gate. The permission
dimension waits for the backend's `x-usrp-permission` (S04). The selftest plants
a failing fixture for each dimension (`src/parity-selftest.ts`).

## Why gate C exists

A route that is built and never passed to `startHttpServer` is unreachable dead
code that answers the transport's own 404. That is not hypothetical here:
`by-id` and `status-history` sat finished-but-invisible in the backend tree, and
`document-forensics-service/src/main.ts` carries a comment about exactly this.
*"The controller exists"* and *"the endpoint exists"* are different claims, and
only the second is worth anything to a client.

## Why the extractor reads text, not types

It runs in the frontend repo's CI against a checkout of a **different**
repository whose `node_modules` is absent. A type-aware pass would turn *"did the
route table change"* into *"can we install the backend"*. The facts it needs — an
exported `*_PATH` constant, a `{ method, path }` pair, the `kind` argument to
`withAuth` — are all syntactically local.

It is **conservative on purpose**: anything it cannot resolve is reported as a
problem, never guessed and never dropped. An extractor that silently skips what
it does not understand converges on finding nothing, and a checker that finds
nothing is green forever.

## `selftest.ts`

Reproduces every syntactic shape the real controllers use (`withAuth` with a
single kind and with an array kind, unwrapped public routes, opaque-session
routes guarded by a local `authenticate()`, two methods on one constant, a route
declared inline in `main.ts`, an orphaned controller, a commented-out
registration), then **plants each kind of drift and asserts the gate goes red**.

A drift checker nobody has watched fail is indistinguishable from a no-op that
prints OK.
