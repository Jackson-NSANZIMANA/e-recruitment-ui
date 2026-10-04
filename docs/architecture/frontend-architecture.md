# Frontend Architecture: Current State

**Status:** Authoritative engineering baseline, 2026-10-04
**Repository:** `Jackson-NSANZIMANA/e-recruitment-ui`
**Backend contract baseline:** `Jackson-NSANZIMANA/e-recruitment` at `06d9f9b6b1bc935a20beb8bd87ee8f96bc437aab`
**Detailed reconciliation:** [`cross-repo-contract-reconciliation-2026-10-04.md`](./cross-repo-contract-reconciliation-2026-10-04.md)

This document is implementation guidance, not a historical audit. Older handover and incident documents remain useful as evidence of past drift, but do not override the current pinned contract or executable gates.

## 1. System boundary

The browser calls one edge origin under `/edge/v1/**`. It does not call identity, application, IAM, G2G, or other service ports directly, and it does not send an `Authorization` header. The backend edge gateway is the browser boundary; `tooling/edge-dev` is a development and proof harness, not a production replacement.

The authoritative layers are:

- **Backend edge:** `services/edge-gateway/src/domain/edge-operations.ts` and `services/edge-gateway/src/routes.ts` at the pinned backend SHA.
- **Frontend edge:** `packages/api-client/src/paths.ts`, `packages/api-client/src/transport.ts`, and `packages/auth/src/edge-client.ts`.
- **Service schemas:** `packages/contracts/openapi`, regenerated into `packages/contracts/src/generated`.
- **UI ownership:** `docs/ui-surfaces/*.json`, verified by `tooling/surface-contract`.

Cross-repository drift is a failing condition. The frontend edge registry is compared with the backend registry on exact method/path plus session, composition, and retry policy. The service manifest is compared with the OpenAPI route set and security metadata.

## 2. Credential, agency, and data boundary

The browser receives only the edge session view. Officer credentials and upstream service tokens remain behind the edge. The session cookie is `httpOnly`; the readable CSRF cookie is echoed in `x-csrf-token` for unsafe requests. `createApiClient` owns CSRF, correlation, retry, response redaction, and operation-to-path resolution.

Agency authority comes from the server-side officer session. A React route guard can hide a screen but is not an isolation control. The application client never accepts a caller-provided agency to widen authority, and browser-facing response types do not include `nationalIdHash`.

The typed API client has no arbitrary-header escape hatch. Applicant submission uses the explicit `idempotencyKey` option, which emits the named `idempotency-key` header and leaves the retry lifecycle with the caller. All state-changing writes are non-retryable unless their contract explicitly provides an idempotent protocol.

## 3. Feature and route ownership

There are two host applications:

- `apps/applicant-portal`
- `apps/officer-console`

Domain work is split into feature packages under `packages/features/*`: identity, applications, adjudication, scheduling, field-ops, and compliance. Each feature owns its model, API adapter, UI, route contribution, and locale registration behind a public barrel. Cross-feature imports are rejected by the repository boundary gate.

The first flagship officer surface is explicitly owned by `apps/officer-console`:

- `/applications` — application list, search, result count, loading, populated, empty, filtered-empty, and error states.
- `/applications/:id` — summary, status, history, partial-data notice, forbidden/not-found/error rendering, and action area.
- `ApplicationActions` — pending, success, generic failure, conflict, and destructive confirmation states.

The executable source-of-truth for that surface is [`docs/ui-surfaces/officer.application-workspace.json`](../ui-surfaces/officer.application-workspace.json). A route is not complete merely because its happy path renders: required states, ADS composition, localization, keyboard behavior, and negative security rules are part of its contract.

## 4. HCI state model

Remote state and user intent are modeled separately. A query may be loading, populated, empty, filtered-empty, forbidden, not-found, or failed; a mutation may be idle, pending, succeeded, failed, or conflicted. A partial detail response is not silently promoted to a complete record. Feedback is announced with live semantics without unexpected focus movement.

The list surface uses a programmatic label and description for search, a result count announcement, an ADS `DynamicTable`, and a distinct filtered-empty message. The detail surface keeps status, history, partial-data warning, and officer actions visible together. Destructive actions use an ADS modal with an explicit confirmation step.

Localization includes visible copy, status labels, error copy, action copy, and accessibility text. New user-facing or ARIA text must be added to `en`, `rw`, and `fr` together and must pass i18n parity tests.

## 5. Offline-first boundary

Field workflows are designed as an offline-first product boundary, but the current capability is intentionally honest: `OFFLINE_CAPTURE_CAN_SYNC` is `false`. Edge reachability alone is not durable offline support. No feature may claim capture, encrypted local persistence, replay, or conflict resolution until those mechanics and their conflict UI have executable proof. The field-sync contract does already expose explicit server conflict outcomes for the future implementation.

## 6. ADS and implementation rules

The design-system boundary is Atlassian ADS with compiled extraction. Prefer ADS components and primitives over custom equivalents; use ADS heading levels, `Text`/primitives, `SectionMessage`, modal semantics, and minimum 48 px interactive targets. Raw colour literals, domain vocabulary in the design-system package, arbitrary transport headers, and direct service URLs are violations.

The shared UI boundary owns reusable ADS composition and safe error fallback. Host applications own translation and telemetry policy. Error telemetry must never receive raw National IDs, hashes, session handles, bearer tokens, or unredacted upstream messages.

## 7. Proof contract

Run from the repository root:

```bash
node --experimental-strip-types packages/contracts/scripts/verify.ts
node --experimental-strip-types tooling/contract-drift/src/selftest.ts
node --experimental-strip-types tooling/surface-contract/src/cli.ts
npm exec --yes pnpm@9.15.0 -- --filter @usrp/edge-dev selfcheck
npm exec --yes pnpm@9.15.0 -- typecheck
npm exec --yes pnpm@9.15.0 -- lint
npm exec --yes pnpm@9.15.0 -- test
```

The repository's full pipeline additionally runs generated-mock checks, static hygiene and boundary checks, build, Storybook accessibility, security self-tests, visual proof where configured, and Playwright E2E. A green local subset is not permission to claim the unavailable gates.

Current evidence for this baseline:

- contract drift: **588 assertions, 0 findings**;
- officer surface contract: **42 assertions, PASS**;
- edge-dev real-socket proof: **143 assertions, GREEN**;
- workspace typecheck: **19 packages successful**.

`contracts/scripts/verify.ts` requires zero generated diff. Run it against the committed generated tree in CI or after committing the generated reconciliation.

## 8. Change protocol

Any backend route or edge-operation change updates the backend SHA evidence, OpenAPI, generated artifacts, frontend edge registry and typed operation when browser-reachable, fixtures including negative cases, affected surface manifest, and localized copy in one reviewable unit. Do not fix drift by exposing a service port, accepting arbitrary headers, broadening agency input, or adding blind mutation retries.
