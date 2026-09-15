# Frontend/backend contract reconciliation

**Amended:** 2026-09-15
**Status:** Current contract boundary; runtime-branch promotion pending
**Repositories:** `e-recruitment-ui` + `e-recruitment`

## Decision

The browser calls one `/edge/v1/**` origin. It never calls a service port, sends
`Authorization`, sends `nationalIdHash`, or receives an upstream credential.

The backend `feat/edge-gateway-runtime` branch now contains a substantive edge
runtime: route composition, session storage, CSRF handling, upstream clients,
field-sync controllers, OpenAPI generation, and branch-local contract/security
proofs. That is meaningful progress, not release evidence. The branch is not
merged, the frontend still pins the older backend commit, and the current
frontend `EdgeOperationId` intentionally remains the authority for callable
browser operations.

## Verified promotion delta

The runtime branch adds these edge operations:

| Browser operation | Edge path | Status in frontend |
|---|---|---|
| `enrollFieldDevice` | `POST /edge/v1/field-sync/devices` | pending promotion |
| `syncFieldScores` | `POST /edge/v1/field-sync/scores` | pending promotion |
| `resolveFieldSyncConflict` | `POST /edge/v1/field-sync/conflicts/resolve` | pending promotion |

Frontend metadata records the exact runtime commit and paths in
`packages/api-client/src/paths.ts` and
`packages/features/field-ops/src/api/transport.ts`. These ids are deliberately
not part of `EdgeOperationId`, so no UI can call a route that the pinned
contract does not expose.

## Promotion sequence

1. Merge the backend runtime branch to the backend release line.
2. Pin the merged backend SHA in frontend CI, not the feature-branch SHA.
3. Regenerate frontend contract artifacts from the merged backend source.
4. Promote the three ids into `EDGE_OPERATIONS` only after contract drift passes.
5. Add typed field-sync request/response schemas generated from the merged edge
   OpenAPI. Do not hand-transcribe the per-record result shape.
6. Enable device enrolment, signed score sync, and human conflict resolution
   behind an explicit tablet feature flag.
7. Run live smoke tests through `/edge/v1/**`, including CSRF, wrong-session-kind,
   replay/idempotency, forged-record outcomes, batch limits, and `409 NO_CONFLICT`.
8. Enable the durable tablet queue only after those proofs and the offline E2E
   pass against the built PWA.

## Security invariants that remain mandatory

- No `nationalIdHash` or raw National ID in browser responses, storage, logs, or telemetry.
- No upstream token or `Authorization` header in the browser.
- Agency comes from the verified server-side session.
- No automatic retry for device enrolment, score sync, conflict resolution,
  walk-in registration, or vetting.
- Signed payloads are forwarded byte-for-byte; the edge must not rewrite signed fields.
- Per-record sync outcomes remain explicit. Partial success is not “all saved”.
- Conflict resolution remains human-directed and capped at 50 characters.
- Offline capture must remain local until the promotion sequence completes.

This document is a promotion checklist, not a production-readiness claim.
