# Frontend release readiness

A frontend release is not production-ready until the exact merge commit has a
real `Quality Gate` result. A merged pull request without check-run evidence is
unverified, not green.

## Required proof

- `pnpm install --frozen-lockfile`
- `pnpm verify:full`
- Playwright E2E with failure artifacts retained
- contract drift against the pinned backend commit
- Trivy CRITICAL/HIGH scan
- live edge smoke tests against the deployed `/edge/v1/session` and auth surfaces
- live edge field-sync smoke tests after the backend runtime promotion

## Current hard boundary

The frontend targets the single edge gateway, not `/api/*`, a BFF, or a service
port. The backend runtime branch is **not** itself a deployment or release
artifact. The edge gateway must be merged, pinned, deployed and smoke-tested
before citizen or officer production traffic is enabled.

Field-sync is implemented on the backend runtime branch but remains disabled in
the frontend contract and tablet queue until the promotion sequence in
`docs/architecture/contract-reconciliation-2026-09-11.md` completes. The
applicant identity verification, document upload and application submission
journeys remain blocked until their edge operations are present in the merged
contract.

## Branch policy

Only `main` is releasable. Feature branches and historical PRs are engineering
evidence, not release evidence. A green branch-local selfcheck does not replace
an exact merged-commit Quality Gate result.
