# Frontend ADRs

Numbered `ADR-FE-*` to stay distinct from the backend's `ADR-0xx`. Every ADR names
the proof that keeps it true; a decision with no gate is a preference.

| ADR | Decision | Enforced by |
|---|---|---|
| [001](./ADR-FE-001-vertical-feature-slices.md) | Vertical feature slices, no shared kernel, boundaries fail CI | proofs 01, `.dependency-cruiser.cjs` |
| [002](./ADR-FE-002-operation-id-transport.md) | The frontend holds no URL strings; it addresses `operationId` | proof 02 |
| [003](./ADR-FE-003-proof-harness.md) | `pnpm verify:fe`; generated mocks; 7 of 9 proofs need no install | proofs 03-07 |
| [004](./ADR-FE-004-missing-surfaces.md) | The surfaces with no UI, and `apps/admin-console` | proofs 02, 09 |
| [005](./ADR-FE-005-offline-first.md) | Offline-first as a constraint, not a feature | proofs 03, 06, 09 |
| [006](./ADR-FE-006-slice-mount-and-operation-whitelist.md) | Slice mount tables; a fictional edge operation is a compile error | `EdgeOperationId`, `assertUniqueRoutePaths` |
| [007](./ADR-FE-007-three-app-topology.md) | Three apps; gate and walk-in move to `apps/field-station`; logins live in `features/identity` | `check-boundaries.mjs`, field-station E2E |
| [008](./ADR-FE-008-ads-retained.md) | ADS retained; licence question is an owner-accepted risk (review 2027-01-31) | owner review |
| [009](./ADR-FE-009-readiness-ladder.md) | Readiness ladder in surface manifests; production mounts SCREEN-BUILT and above | `surface:verify` (+ `--selftest`), `vite-readiness.ts`, officer/field E2E |
| [010](./ADR-FE-010-field-ledger.md) | `@usrp/field-ledger`: signed local-first record log, storage and signer ports, sync state machine | `packages/field-ledger/test` |
| [011](./ADR-FE-011-station-model.md) | Permission-derived stations, venue/day session, degraded-gate rung | `stations.test.ts`, `stations.spec.ts` |
| [012](./ADR-FE-012-contract-parity-v2.md) | Contract parity v2 (schemas, outcomes, idempotency) and the evidence bundle | contract-drift gate E + selftest |
| [013](./ADR-FE-013-citizen-stage-projection.md) | Citizen stage is a pure projection over the canonical status enum | S10b exhaustive test |
| [014](./ADR-FE-014-spa-serving-image.md) | One Caddy serving image per app: strict headers, /edge never the shell, signed and scanned | `tooling/images/verify-spa-image.mjs`, `spa-images` job |
| [020](./ADR-FE-020-national-identity-layer.md) | National identity layer: GoR theme seed, statutory colours, emblems with provenance, official-document anatomy, no gamification | `national.test.ts`, `security-print.test.mjs`, `check-boundaries.mjs`, Storybook a11y |
