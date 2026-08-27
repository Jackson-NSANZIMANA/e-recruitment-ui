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

`route-manifest.json` is the middle term: hand-mined backend facts, pinned to a
SHA. Neither gate can be green while the other is stale — a backend change
applied to the manifest but not the OpenAPI fails A, and one applied to both but
not the backend fails B.

Fails on: a **missing** route, an **extra** route, a **changed method**, a
**changed auth kind**, a **system-token route marked browser-reachable**, a
**renamed path constant**, a **readiness probe that stopped checking anything**,
and a route that is **built and never mounted**.

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
