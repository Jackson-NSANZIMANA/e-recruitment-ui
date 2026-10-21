# ADR-FE-012 — Contract parity v2 and the CI evidence bundle

**Status:** Accepted · 2026-10-18 (S02, W0-06)

## Context

Contract drift compared routes (gates A–D: method, path, auth, session, composition, retry). Mocked E2E proved the screen sends what *we* think the contract is; W1-09 showed that can be wrong while every check is green.

## Decision

1. **Gate E** (`tooling/contract-drift/src/parity.ts`) compares, per operation matched by method + path, the frontend's source against the backend's `services/edge-gateway/openapi/edge-v1.yaml` at the pinned checkout:
   - **request schema** — required fields sent and not optional; no field a closed schema refuses;
   - **response schema** — no frontend-required field the backend never sends;
   - **outcome union** — every documented 409/422 code is handled by the frontend union mapped for that operation;
   - **idempotency** — a required Idempotency-Key is sent, an undeclared one is not, and the documented replay scope still names actor, operation, key and body.
   `PARITY_TABLE` only names which frontend symbol answers for an operation; fields are read from `packages/api-client/src/wire.ts` and outcome unions from source. `KNOWN_DIVERGENCES` downgrades a matching finding to a note with reason and owner, and fails when it matches nothing.
2. **Permission parity** waits for the backend to emit `x-usrp-permission` (S04).
3. **The selftest plants a failing fixture for each new dimension** (`src/parity-selftest.ts`), run by `drift:selftest` in CI before the gate is trusted.
4. **Evidence, not prose.** The CI evidence bundle (S00, `tooling/ci/evidence-bundle.mjs`) is the record of counts and SHAs; it now expects E2E reports from all three apps. Docs cite the artefact and do not restate counts.

## Consequences (found at S02, pinned `df80f65`)

- **Known divergence:** `edge-v1.yaml` documents `submitMyApplication` without `campaignCode` (closed schema) while the edge controller requires it. The frontend follows the controller; backend ask.
- Notes, not failures: the backend documents fewer walk-in refusals than its controller returns (`NO_WALK_IN_CAMPAIGN` and three more); `submitMyApplication` and `verifyDocumentAtVenue` outcomes have no declared frontend union yet.
