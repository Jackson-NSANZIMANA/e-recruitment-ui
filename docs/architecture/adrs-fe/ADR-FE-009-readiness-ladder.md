# ADR-FE-009 — The readiness ladder: every route declares a rung, and production mounts only built screens

**Status:** Accepted · 2026-10-18 (S02)
**Owner decision:** placeholder routes stay visible in development behind a "not built" banner (S02 answer).

## Context

Seven placeholder screens (one-line title components) were reachable in production builds. Readiness lived in prose that went stale within days.

## Decision

1. **Every mounted route in all three apps has a surface manifest** in `docs/ui-surfaces/*.json` (schema v2, `tooling/surface-contract/surface-contract.schema.json`) with `routes[].app` and a `readiness` block: `{ rung, evidence: { e2e[], contract?, a11y?, signoff? }, blockedBy[] }`.
2. **The ladder**, each rung including every check below it, enforced by `pnpm surface:verify`:

   | Rung | Evidence `surface:verify` requires |
   |---|---|
   | DECLARED | the manifest is valid and names what it is blocked by |
   | EDGE-AVAILABLE | every listed operation is active in `packages/api-client/src/paths.ts` |
   | CLIENT-WIRED | every operation has a typed api-client call site (undecoded ones are reported as notes) |
   | SCREEN-BUILT | the route source is not a placeholder, at least one state group is evidenced in source, every literal i18n key exists in en, rw and fr |
   | E2E-PROVEN | every referenced spec exists, declares tests and contains no `fixme`/`skip` |
   | LOAD-PROVEN, OPERATIONALLY-READY | a sign-off reference (`evidence.signoff`); signed off outside this repo, not verified here |

   Below SCREEN-BUILT a manifest must list `blockedBy`. Coverage is checked both ways: a route an app mounts with no manifest, or a manifest route no app mounts, fails.
3. **Production mounts only SCREEN-BUILT and above**, with two locks:
   - *runtime:* each app passes its route table through `mountByReadiness` (`@usrp/ui`), reading the manifests' `id`/`routes`/`readiness` at build time (`apps/*/src/routes/readiness.ts`). Undeclared routes are not mounted (fail closed); a `*` route shows `NotFoundPage`.
   - *build:* `tooling/surface-contract/src/vite-readiness.ts` replaces the source module of every below-floor route with an empty component during `vite build`, so the placeholder's code is not shipped.
4. **Development** mounts every route; those below the floor carry `NotBuiltBanner` (testid `readiness-not-built`).
5. "Zod decode" in the plan's CLIENT-WIRED definition is relaxed to *a typed call site*: the api-client decodes with hand-written narrowing (`decode.ts`, `gateResultFromRefusal`, `decodeCampaignCommand`), and most typed ops are not decoded yet. The verifier reports undecoded operations so the gap stays visible.

## Consequences

- At S02 the routes below the floor — absent from production — are the amber queue, the DPO queue, verify-invitation, citizen withdraw, field check-in and field conflicts; the retired officer `/field/*` paths now 404. `surface:verify` prints the current table; this ADR does not restate it.
- `surface:verify --selftest` plants a violation of every rung's rule and asserts it is caught (hygiene job).
- An owning session raises its route's rung in the same PR that builds it; the verifier refuses a rung its evidence does not support.
