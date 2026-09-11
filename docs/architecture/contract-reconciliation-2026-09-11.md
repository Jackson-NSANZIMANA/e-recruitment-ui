# Frontend/backend contract reconciliation

**Date:** 2026-09-11
**Status:** Baseline recorded, edge-spec correction required before edge runtime implementation
**Repositories:** `e-recruitment-ui` + `e-recruitment`

## Decision

The frontend must be unified with **running backend controllers and their self-checks**, not with an older edge OpenAPI draft that has not been reconciled with those controllers.

The browser boundary remains the single `/edge/v1/**` origin. The browser never calls a service port, never sends `Authorization`, never sends `nationalIdHash`, and never receives an upstream credential.

## Verified truth from backend source

### Identity verification

Backend source:

- `services/identity-service/src/adapters/http/verify-identity.controller.ts`
- `services/identity-service/src/application/verify-identity.service.ts`

Request:

```json
{ "nationalId": "<16 digits>", "channel": "WALK_IN" }
```

The controller accepts the authenticated `system` or `officer` principal, validates the channel against backend `APPLICATION_CHANNELS`, and returns only:

```json
{ "status": "CREATED", "applicantId": "<uuid>" }
```

or:

```json
{ "status": "ALREADY_EXISTS", "applicantId": "<uuid>" }
```

Failure outcomes are `NOT_FOUND_IN_NIDA` or `NOT_A_CITIZEN`; neither returns PII. The raw National ID and internal `nationalIdHash` are not response data.

The frontend `IdentityVerifyResponse` and `verifyIdentity` operation match this controller. The older edge OpenAPI description claiming `{ verified, fullName }` is stale and must not drive frontend changes.

### Walk-in registration

Backend source:

- `services/application-service/src/adapters/http/walk-in.controller.ts`
- `services/application-service/src/application/walk-in.service.ts`

Request:

```json
{
  "applicantId": "<uuid>",
  "category": "<known application category>",
  "nesaIndexNumber": "<optional>",
  "hecRegistrationNumber": "<optional>"
}
```

The service derives agency and database role from the verified officer principal. It rejects RNP/RCS walk-ins, validates that the category belongs to the officer's agency, requires a verified identity, resolves a walk-in campaign, persists `WALK_IN_REGISTERED`, emits `APPLICANT_SUBMITTED` with channel `WALK_IN`, and emits an audit event.

Success:

```json
{
  "status": "REGISTERED",
  "applicationId": "<uuid>",
  "processingCode": "<code>",
  "qrInvitationCode": "<opaque ticket>"
}
```

The frontend `WalkInRegisterInput` and `WalkInRegisterResponse` match this controller. The older edge OpenAPI body claiming `{ nationalId, postCode }` is stale. Do not reintroduce `postCode` or `nationalIdHash` into the browser.

### Walk-in vetting

Request:

```json
{ "applicationId": "<uuid>" }
```

The expected `409 AGE_PENDING` is an officer-visible state and must not be hidden by transport retry. `APPLIED` and `NO_CHANGE` are successful responses; `NOT_APPLICABLE`, `NOT_FOUND`, `FORBIDDEN`, and `UNSUPPORTED_AGENCY` remain explicit outcomes.

## Operation-id rule

These names are intentionally different layers:

| Layer | Example |
|---|---|
| Browser edge id | `requestOtp`, `verifyOtp`, `getStatusHistory` |
| Upstream operation id | `requestApplicantOtp`, `verifyApplicantOtp`, `getApplicationStatusHistory` |

`packages/api-client/src/paths.ts` owns the browser ids and maps them to upstream ids. A slice must call the browser id, never the upstream id. `EdgeOperationId` is the compile-time whitelist.

## Contract gaps that block edge deployment

1. The backend edge OpenAPI draft must be updated so walk-in registration uses `applicantId` and `category`, not `nationalId` and `postCode`.
2. The edge OpenAPI identity response must be changed to `{ status, applicantId }`, not `{ verified, fullName }`.
3. Edge OpenAPI channel enums must be reconciled against backend `APPLICATION_CHANNELS`. `WALK_IN` is the value used by the current walk-in flow; the draft currently lists `FIELD`.
4. The edge gateway has no runnable implementation in the backend `main` tree. The OpenAPI document is a design contract, not a deployed service.
5. The frontend `packages/api-client/src/wire.ts` still contains hand-transcribed response interfaces. Replace them with generated contract types only after the edge OpenAPI is corrected and generated artifacts are regenerated.
6. The frontend and backend must share one pinned backend commit in the contract provenance. A stale frontend baseline such as `47d9ad3` must not be presented as current after backend source changes.

## Security invariants that must survive reconciliation

- No `nationalIdHash` in browser code, request bodies, URLs, logs, or events.
- No raw National ID in a response, persisted browser storage, or telemetry.
- No upstream officer JWT or applicant session token in browser memory, storage, or headers.
- No agency in a browser request as an authorization input. Agency comes from the officer session.
- No generic status PATCH. Transitions remain separate, typed POST operations.
- No retry of state-changing transitions or walk-in registration/vetting.
- No applicant-facing document-forensics score, lane, or flags.
- Preserve byte-identical anti-enumeration responses for OTP and protected reads.
- Preserve `409 AGE_PENDING` as an explicit officer action state.

## Required verification sequence

1. Reconcile and update backend `services/edge-gateway/openapi/edge-v1.yaml` from the actual controllers.
2. Regenerate backend/frontend contract artifacts; do not hand-edit generated files.
3. Run backend `pnpm typecheck` and `pnpm verify`.
4. Run frontend frozen install, `pnpm typecheck`, lint, tests, contract drift, and build.
5. Add live edge smoke tests for auth, session, identity verification, walk-in registration/vetting, protected reads, and CSRF.
6. Only then mount additional feature slices or claim production readiness.

This document is intentionally a blocker record, not a claim that the edge is already deployed.
