# ADR-FE-008 — Atlassian Design System retained; the licence question is an owner-accepted risk

**Status:** Accepted · 2026-10-18 (S02)
**Owner decision:** D1 (2026-10-15) — keep ADS as-is. This overrides baseline §1.1 decision 11.

## Context

The national baseline asked for a façade over the design system so the platform could leave ADS later. The owner decided against building one: the AGENTS.md composition ladder (ADS component → its props → ADS primitives → a token-backed component in `@usrp/design-system` / `@usrp/ui`) stays the rule, and features keep importing `@atlaskit/*` directly.

ADS packages are published by Atlassian under their own licence terms, written for building on Atlassian's platform. Whether those terms cover a sovereign recruitment platform that is not an Atlassian app has not been confirmed by counsel.

## Decision

1. ADS stays the UI foundation in all three apps. No façade layer is built.
2. The licence question is recorded as an **owner-accepted risk**, not resolved by engineering:
   - **Risk:** the ADS licence may not permit this use; a negative answer forces a component-library migration.
   - **Mitigation already in place:** tokens only (no copied ADS CSS), the composition ladder, and generic primitives in `@usrp/design-system`, which keep a migration mechanical rather than a rewrite.
   - **Review date:** **2027-01-31**, or before the first production deployment (S07), whichever comes first. Owner: programme owner, with legal.
3. Self-hosted Atlassian fonts stay under their OFL-1.1 notices (`apps/*/public/licenses/atlassian-fonts`).

## Consequences

No engineering work is planned against this risk until the review. If counsel's answer is negative, a new ADR replaces this one and plans the migration slice by slice behind the existing ladder.
