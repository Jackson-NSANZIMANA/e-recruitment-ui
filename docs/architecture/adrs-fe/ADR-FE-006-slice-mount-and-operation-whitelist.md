# ADR-FE-006 — Mounting the feature slices, and making a fictional edge operation a compile error

**Status:** Accepted
**Date:** 2026-09-09
**Extends:** ADR-FE-001 (vertical slices), ADR-FE-002 (operation-id transport)
**Context read before writing:** `EDGE_OPERATIONS` in `packages/api-client/src/paths.ts`, `transport.ts`, all six slice barrels, all six slice `api/` layers, all thirteen slice route modules, both host routers and entrypoints, `packages/i18n/src/config.ts`, and all three `common.json` bundles.

---

## 1. The finding that forced this ADR

`frontend-architecture.md` §3 says the six feature route surfaces "are not yet mounted into those routers", gated behind a green install. That is true, and it is not the blocker.

**Eleven of the twenty-seven edge calls in the six slices named operations that do not exist.**

| slice | real | fictional ids |
|---|---|---|
| identity | 1/4 | `requestApplicantOtp`, `verifyApplicantOtp`, `logoutApplicant` |
| applications | 4/5 | `getApplicationStatusHistory` |
| adjudication | 6/6 | — |
| scheduling | 0/1 | `getSlotInvitationKey` |
| field-ops | 2/6 | `verifyBiometric`, `enrollFieldDevice`, `syncFieldScores`, `resolveFieldConflict` |
| compliance | 3/5 | `listErasureRequests`, `declineErasureRequest` |

Four of the eleven are **upstream** operation ids used as if they were **edge** ids. The edge deliberately renames: upstream `requestApplicantOtp` is `requestOtp` at the edge; upstream `getApplicationStatusHistory` is `getStatusHistory`. The other seven are not renames of anything — `scheduling-service`, `biometric-service` and `field-sync-service` are all scaffolds with no source (000.md §6), so those functions were written against the architecture *diagram* rather than the running system.

Every one throws `Unknown edge operation` from `paths.ts`, at runtime, inside a click handler.

**Why nothing caught it.** Each slice declared its own transport:

```ts
export interface SliceTransport { call<T>(operationId: string, options?: CallOptions): Promise<T> }
```

Six copies, **no implementation in any slice**. `operationId: string` accepts every string in the language, so a typo, a rename and an invention are indistinguishable to the compiler. Same defect class as the twelve fictional `ApplicationStatus` values: plausible, internally consistent, and not there.

## 2. Decision — `EdgeOperationId` is the whitelist

`EDGE_OPERATIONS` was annotated `readonly EdgeOperation[]`, which **erased the id literals to `string`**. Changed to `as const satisfies readonly EdgeOperation[]`: shape still checked, literals survive, union derivable.

```ts
export type EdgeOperationId = (typeof EDGE_OPERATIONS)[number]['id'];
```

Every slice now types its operation list `satisfies readonly EdgeOperationId[]`. A fictional id fails `pnpm typecheck`.

This is the frontend counterpart of the backend's exhaustive Kafka topic map, where an unrouted event type is a compile error rather than a message nobody consumes (000.md §9). Same discipline, same reason: a reviewer comparing two 23-item lists by eye is how eleven of these got in.

`operation()` keeps its runtime guard and `BY_ID` is widened to `ReadonlyMap<string, EdgeOperation>` on purpose, for ids assembled at runtime or reached from JavaScript. The type is the first gate, not the only one.

## 3. Decision — one transport, and the credential boundary is not a suggestion

All six phantom interfaces are deleted. Slices take `ApiClient` from `@usrp/api-client`: the real transport, which cannot be handed a URL and runs `assertPathsMatchContract()` at module load.

**One deletion was a security defect, not a naming one.** `identity/src/api/identity.ts` declared:

```ts
officerLogin -> TokenIssued { token, expiresAt }
verifyOtp    -> { sessionToken, expiresAt }
```

Both assert the browser receives a bearer credential. It does not. Per `edge-contract.md` §2 the browser holds an opaque handle in an `httpOnly` cookie plus a readable CSRF echo that is not a credential; the officer Ed25519 JWT (ADR-016) and the citizen's opaque revocable session token (ADR-018) never leave the server side of the edge. Those were the **upstream** shapes transcribed onto the browser layer.

A type is a specification. Anyone building on that signature writes `const { token } = await officerLogin(...)` and then has to put the token somewhere a browser can hold it — localStorage, a store, an `Authorization` header. The declaration was an invitation to break the credential boundary, and the security scan's browser-storage check would only have caught the last step of it, after the design error was already load-bearing.

`@usrp/auth` already owns officer login, the citizen OTP pair, session probe, refresh and logout, and returns a session view with **no token**. identity consumes it and does not wrap it, because a wrapper is a third name for one flow and the first place a future reader looks for the token that does not exist.

## 4. Decision — `allowImportingTsExtensions` in the host apps

The slices are consumed as TypeScript **source** (`exports: './src/index.ts'`) and use explicit `.ts` / `.tsx` specifiers internally. `compilerOptions` are per-**program**, so once a slice barrel enters a host program its specifiers are checked under the host's options. Without the flag, `tsc -p tsconfig.json --noEmit` fails **TS5097** on the first slice import and the build stops before Vite runs.

Both apps are already `noEmit: true` — Vite owns emit — which is exactly the condition the flag requires. So this is semantically correct rather than a workaround: it declares "this program reads TypeScript source with explicit extensions", which is what it does. It is reversible by rewriting roughly forty slice specifiers to extensionless form.

Recorded because it is a real coupling: the slices' internal import convention is now part of the host's compiler contract.

## 5. Decision — mount only what the edge serves, and never shadow a working screen

**Mounted.**

| app | path | slice | guard |
|---|---|---|---|
| officer-console | `adjudication/amber-queue` | adjudication | `OfficerGuard` |
| officer-console | `compliance/erasure-queue` | compliance | `OfficerGuard` |
| officer-console | `field/walk-in`, `field/check-in`, `field/conflicts` | field-ops | `OfficerGuard` |
| officer-console | `scheduling/verify-invitation` | scheduling | `OfficerGuard` |
| applicant-portal | `my/withdraw` | compliance | `ApplicantGuard` |

**Not mounted, and this is the judgement call in this branch.**

`ApplicationsRoutes` declares `path: 'applications'`. officer-console already serves `applications` with a real `DynamicTable` driven by `useApplicationList`, with search, status lozenges and per-row navigation. The slice's `list.tsx` renders one line of text. React Router ranks two identical paths and **silently picks one**, so mounting it risks an officer losing the queue they work all day while every check stays green.

`IdentityOfficerRoutes` (`login`) and `IdentityCitizenRoutes` (`sign-in`) duplicate login pages rewritten onto the real credentials — National ID plus a six-digit OTP against a five-minute scrypt-digested challenge, because **no citizen password exists anywhere in the platform**. Two sign-in surfaces is one too many places for that correction to be forgotten.

**Mounting a slice is not automatically progress.** Parity work, in order: give `applications/list.tsx` the table from `apps/officer-console/src/routes/applications.tsx`; give `detail.tsx` `useApplicationDetail` + `useStatusHistory`; then move the app routes to delegate to the slice and delete them. Only then does the slice replace the app page. Neither slice is declared as an app dependency until that lands — an undeclared dependency is the cheapest guard against someone importing it back without reading this section.

### Why the mounted stubs are not the same problem

With namespaces registered, those screens render their **locale copy**, and that copy is honest and useful. adjudication explains the amber queue holds two different things and that adjudication holds carry no document to look at. compliance states that any authenticated officer can decline an erasure request because there is no DPO role check and the queue is not agency-scoped. scheduling tells a citizen plainly that the platform cannot yet give them a venue or a time.

Those are informational surfaces that tell an officer the truth about a gap. They are not fake tables over endpoints that 404, which is the line this branch draws.

## 6. Decision — collisions and missing namespaces fail at startup

`assertUniqueRoutePaths()` runs at module load in each app and throws naming both owning slices. `assertNamespaceRegistered()` runs in each entrypoint.

Both are **runtime** assertions rather than lint rules, because the route tables are values composed from several packages and the namespace set is chosen by the entrypoint. A static scan of six barrels is the same hand-maintained list this repository has already been bitten by twice — the Turbo env allowlist and the pnpm workspace glob were both exactly this shape. An assertion over the real composed value cannot drift from it.

**i18next returns the key for a missing namespace.** It does not throw and does not warn in production. `config.ts` registered exactly one namespace, `common`, while all six slices call `useTranslation('identity' | 'applications' | 'adjudication' | 'scheduling' | 'field_ops' | 'compliance')`. Mounting before this fix would have rendered the literal string `identity.officer.title` to a citizen on a national government portal — a screen that looks finished and communicates nothing, which is worse than a blank page because a blank page gets reported.

Note `field_ops` carries an underscore while the package is hyphenated. They are different identifiers and only the JSON root key matters at runtime.

`registerNamespace` is a function the host calls, not a side effect of import: `@usrp/i18n` cannot import the slices (they already depend on it, and `.dependency-cruiser.cjs` would reject the cycle), and a side effect would tie bundle loading to module evaluation order and pull every bundle into any chunk that touched one.

## 7. Consequences

- A fictional edge operation is a compile error.
- Eight known-unserved operations are recorded in `*_UNSERVED_BY_EDGE` constants typed `readonly string[]` — deliberately **not** `EdgeOperationId` — each naming the backend work it waits on.
- Eleven workspace importers changed. **`pnpm install --frozen-lockfile` will correctly refuse until `pnpm-lock.yaml` is regenerated.** One command, registry access required, never hand-edited.
- The host apps' compiler options are now coupled to the slices' import convention (§4).
- `scheduling` has no callable operation at all; `field-ops` has three of seven. Stated in code, not hidden.
- The shared `common` locale bundle now carries the 19 real statuses and the 11 real document types, and `auth.email` is gone — `officer_accounts` has `login_handle varchar(128)` and no email column, so every officer in all three agencies was being asked for a credential that does not exist.

## 8. Verification status — what has NOT been run

**Nothing in this branch has been executed.** No registry access was available in the environment where it was written.

| check | status |
|---|---|
| `pnpm install` / lockfile regeneration | **NOT RUN** — required before anything else |
| `pnpm typecheck` | **NOT RUN** |
| `pnpm lint` | **NOT RUN** |
| `pnpm build` | **NOT RUN** |
| `pnpm verify` | **NOT RUN** |
| locale three-way key parity, 107 keys each | **RUN** — passed |
| twelve fictional statuses absent from all three locales | **RUN** — passed |
| `{{agencyName}}`, `{{name}}`, `{{maxSize}}` intact in all three | **RUN** — passed |
| no empty value in any locale | **RUN** — passed |
| slice operation ids diffed against `EDGE_OPERATIONS` | **RUN** — 11 of 27 fictional, all corrected or recorded |

The repository's standard is "prove it, don't assert it". The honest form of that when the proof cannot be run is to name the proof that is missing. **Do not treat this branch as green until `pnpm verify` passes on it.**

### Highest-risk unverified items, in order

1. **`NamespaceBundles` assignability** of a `resolveJsonModule` import in the six `src/locales.ts` files. If `tsc` rejects it, the fix is an explicit `NamespaceBundle` annotation or a `satisfies` clause at each import — **not** a cast, which would defeat the check that all three locales are present.
2. **`as const satisfies readonly EdgeOperation[]`** on `EDGE_OPERATIONS`, and the `ReadonlyMap<string, EdgeOperation>` widening of `BY_ID` that it requires. If the literal inference misbehaves, `EdgeOperationId` degrades to `string` and silently stops gating — so this is worth asserting in the api-client selfcheck, not just typechecking.
3. **`allowImportingTsExtensions`** interacting with `declaration: true` inherited from `tsconfig.base.json`. `noEmit` should win, but it is untested here.
4. **Route spreading** `[...OFFICER_SLICE_ROUTES]` into a `RouteObject[]` children array under `exactOptionalPropertyTypes`.

## 9. Follow-on work, in priority order

1. Regenerate the lockfile and get `pnpm verify` green. Nothing else counts until then.
2. Make `Quality Gate` a required branch-protection check on `main`. It was RED and correct for eleven hours while work continued on top of it; the missing part was never a gate.
3. Assert `EdgeOperationId` really is a literal union in the api-client selfcheck (see §8 item 2).
4. Bring `applications/list.tsx` and `detail.tsx` to parity, then delegate and delete the app routes (§5).
5. Calibrate the provisional 700 KB / 1200 KB bundle ceilings against a real `dist`.
6. Typecheck `@usrp/edge-dev`. Every script runs through `node --experimental-strip-types`, which erases types without checking them, and it is the process that terminates the session cookie and brokers system tokens.
