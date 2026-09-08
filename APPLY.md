# Applying Agent 2's prepared work

This bundle is a file overlay for the UI repository, branch `feat/edge-and-auth`.
It contains only these owned paths:

- `docs/architecture/edge-contract.md`
- `packages/auth/**`
- `packages/api-client/**`
- `tooling/edge-dev/**`

It deliberately excludes `packages/contracts/**`, `packages/ui/**`,
`packages/design-system/**`, `packages/features/**`, `apps/**`, and `.github/**`.

Verify the destination branch and working tree before applying. Copy the bundle
contents into the repository root, verify the checksums, run the proofs, inspect
`git diff`, then commit only the listed paths.
