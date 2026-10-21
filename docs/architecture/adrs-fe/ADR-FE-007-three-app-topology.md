# ADR-FE-007 — Three deployable apps; the gate and the walk-in desk move to `apps/field-station`

**Status:** Accepted · 2026-10-18 (S02)
**Supersedes:** ADR-FE-004 §4 (`apps/admin-console`, "do not scaffold an admin console") — administration lives in `officer-console`.
**Owner decision:** D2 (2026-10-15); field-station port **3002**, domain **`field.<domain>`** (S02 owner answer).

## Context

Until S02 the officer console was also the field tablet. The venue gate (ADR-034) and the RDF walk-in desk (ADR-012) were app-level screens in `apps/officer-console/src/routes`, holding logic the ownership rule says belongs to a feature slice. The field device differs from the desk in every dimension that matters for a release:

| | officer-console | field-station |
|---|---|---|
| Device | agency desktop | managed Android tablet (managed Chrome now, native wrapper later, D3) |
| Threat model | session cookie on a desk | device key, local evidence store, devices get lost |
| Release cadence | continuous | change freeze before exam days, attested build |
| Interaction | data-dense, navigation-heavy | one station, many repetitions, gloves and sunlight |

Keeping both in one app puts desktop administration bundles and (from S08) an offline record log in one service-worker scope.

## Decision

1. **Three apps:** `applicant-portal` (3000), `officer-console` (3001), `field-station` (3002, served from `field.<domain>`). Each owns routing, shell, PWA manifest and auth boot; features own behaviour.
2. **`apps/field-station`** mirrors officer-console's foundations: eager login, `RouteGuard` + `OfficerGuard`, i18n, `AppProvider`, `resolveAdsFeatureFlag`, `StrictMode`, router v7 flags, PWA with `NetworkOnly` for `/edge/v1/**`, the `VITE_EDGE_URL` build guard, landscape manifest, its own bundle budget (`tooling/repo-hygiene/gates.config.json`) and its own CI E2E project. It uses a single-bar `StationShell`, not `@atlaskit/navigation-system`.
3. **Composition boundary:** field-station imports only `@usrp/feature-identity`, `-scheduling`, `-field-ops` and the **model** of `-applications` (never its screens). Enforced by `tooling/repo-hygiene/check-boundaries.mjs` (`lib/app-boundaries.mjs`, tested in `test/app-boundaries.test.mjs`).
4. **The gate and the walk-in desk move into `packages/features/field-ops`** (routes, models, unit tests; their E2E specs move to `apps/field-station/e2e`). The slice exports a route *factory*, `createFieldOpsRoutes({ client })`, so the edge client is injected and no slice reads an app's env. Officer-console redirects `/gate` and `/walk-in` to `/field-station`, a notice that names the new home (link from `VITE_FIELD_STATION_URL`, dev default `http://localhost:3002`).
5. **Identity placeholders (kit item 5): move, not delete.** The officer and citizen sign-in pages move into `features/identity` (`OfficerLoginPage` with a `homePath`, `CitizenLoginPage` with an `edgeBaseUrl`) — one implementation, three apps. The dead route tables `IdentityOfficerRoutes` / `IdentityCitizenRoutes` are deleted; hosts mount the login components directly (eagerly in the officer apps).

## Consequences

- One router copy per bundle: S02 found `@usrp/auth`'s pinned `react-router-dom` producing a second router whose `<Navigate>` threw on every unauthenticated visit to a guarded path; all three Vite configs now `resolve.dedupe` React and the router (regression E2E in officer-console).
- Field-station starts on a permission-derived station picker (ADR-FE-011); S08 adds the remaining stations as slice routes.
- Enforced by: `check-boundaries.mjs`, `surface:verify` (every field-station route has a manifest), `apps/field-station/e2e/*`.
