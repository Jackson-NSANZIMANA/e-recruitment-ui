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
