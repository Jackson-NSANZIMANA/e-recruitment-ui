# ADR-FE-001 — Vertical feature slices, with mechanically enforced boundaries

**Status:** Accepted · 2026-08-30 · **Supersedes:** the flat `apps/*/src/routes` layout

## Context

Two apps, five route files each, all logic inline, plus an
`apps/officer-console/src/components/` directory holding `AppShell` and
`ApplicationActions`. That directory is the evidence: shared component code had
already escaped `packages/ui` into an app, at five routes.

The real surface is 19 statuses × 3 agencies × two document lanes (green/amber) ×
an RDF-only walk-in lane × offline field tablets × a DPO queue, against ~20
browser-reachable endpoints that have no UI at all. A flat route file per page
does not reach that, and a `components/` escape hatch scales it in the wrong
direction: the next shared thing lands next to the last one, and the boundary
becomes a code-review habit instead of a property of the build.

## Decision

Six vertical slices under `packages/features/`, one per domain — **not per
service**. `GET /v1/applicants/me/applications` lives on identity-service and
belongs to the `applications` slice, because the slice boundary follows the work,
not the deployment topology.

Each slice is `api/ model/ ui/ routes/` behind exactly one public interface,
`src/index.ts`, and `package.json` exports `"."` and `"./locales/*"` only. A deep
import is not discouraged, it is unresolvable.

**A slice may never import another slice.** Cross-slice needs go through the host
app, which is the only place that legitimately knows about two domains at once.

### No shared kernel

The transport port is a six-line interface duplicated verbatim in all six slices
rather than shared from a `features/_kernel` package. A kernel every slice must
import is the seam coupling grows through: it starts as a type, acquires a helper,
then a constant, then a store, and the boundary is decorative. Six copies of six
lines is the cheaper mistake, and proof 01 makes the alternative impossible to
introduce quietly.

### The model layer takes type-only imports

`src/model/**` imports `@usrp/contracts` with `import type` and imports no
component library. That single constraint means the model layer runs under
`node --experimental-strip-types --test` with **no `node_modules` at all**, so the
decisions that hurt when they are wrong stay provable on a broken lockfile. Where
a model needs a runtime constant from the contract, exhaustiveness is asserted
twice: `satisfies Record<ApplicationStatus, …>` at compile time, and proof 04
against the contract read as data.

## Enforcement

- `packages/testing/proofs/01-slice-boundaries.mjs` — 356 assertions, zero
  dependencies, blocks CI. Allowlisted imports, no cross-slice, no deep imports,
  no relative import climbing out of a slice, four layers present, one entry
  point, type-only contracts in `model/`, `node:` builtins only in test files.
- `packages/testing/.dependency-cruiser.cjs` — the real module graph: cycles,
  **transitive** cross-slice paths, orphans, and any import of the deprecated
  `@usrp/shared-types`.

Two checks with different blind spots beat one. If they disagree,
dependency-cruiser is right about the graph and proof 01 needs a rule.

## Consequences

- Adding a status, a lane or an agency is a change inside one slice.
- The officer console stops shipping the citizen wizard (route-level splitting per
  slice).
- Migrating `packages/ui` composites into slices is blocked on Agent 3's map; the
  destinations exist and the ledger is in ADR-FE-004 §3.
- Six duplicated port interfaces. Accepted, deliberately, above.
