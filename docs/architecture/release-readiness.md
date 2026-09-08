# Frontend release readiness

A frontend release is not production-ready until the exact merge commit has a real `Quality Gate` result. A merged pull request without check-run evidence is unverified, not green.

## Required proof

- `pnpm install --frozen-lockfile`
- `pnpm verify:full`
- Playwright E2E with failure artifacts retained
- contract drift against the pinned backend commit
- Trivy CRITICAL/HIGH scan
- live edge smoke tests against the deployed `/edge/v1/session` and auth surfaces

## Current hard boundary

The frontend targets the single edge gateway, not `/api/*`, a BFF, or a service port. The edge gateway itself must be deployed and smoke-tested before citizen or officer production traffic is enabled. The applicant identity verification, document upload, and application submission journeys remain blocked until the backend brokers those service-internal operations.

## Branch policy

Only `main` is releasable. Stale branches that are behind `main` must not be rebased into release work; create a fresh branch from `main` instead. Historical PRs remain audit records and are not release evidence.
