# Backend Edge Runtime Handoff

**Status:** Backend engineering handoff, not a frontend implementation
**Date:** 2026-09-13
**Prepared by:** Incoming primary frontend systems architect
**Frontend repository:** `Jackson-NSANZIMANA/e-recruitment-ui`
**Backend repository:** `Jackson-NSANZIMANA/e-recruitment`
**Backend commit reviewed:** `2b1814fd5ef1ea8d71625d2b58e9b75a16c3155e`

## Executive decision

The frontend must **not** call backend service ports directly. The browser boundary
is one edge origin under `/edge/v1/**`, with credentials held server-side and
agency derived from the authenticated officer session.

The frontend is contract-ready. The backend edge runtime is not deployment-ready.
In the reviewed backend tree, `services/edge-gateway/` contains `openapi/` only:
there is no `package.json`, runnable entrypoint, route composition, durable shared
session store, readiness surface, or executable edge selfcheck.

This is a backend implementation blocker. It is deliberately documented here for
handoff to the engineer who owns the backend. No backend code is changed by this
handoff.

## Evidence

The following frontend records independently identify the same boundary and gap:

- `docs/architecture/edge-contract.md`
- `docs/architecture/frontend-architecture.md`
- `docs/architecture/contract-reconciliation-2026-09-11.md`
- `docs/architecture/release-readiness.md`
- `packages/api-client/src/paths.ts`
- `packages/auth/src/edge-client.ts`
- `tooling/edge-dev/`

The backend source confirms that the upstream services exist independently. In
particular, the reviewed backend commit contains these field-sync controllers:

| Capability | Backend source | Upstream route |
|---|---|---|
| Device enrolment | `services/field-sync-service/src/adapters/http/enroll-device.controller.ts` | `POST /v1/field-sync/devices` |
| Score synchronisation | `services/field-sync-service/src/adapters/http/sync-scores.controller.ts` | `POST /v1/field-sync/scores` |
| Conflict resolution | `services/field-sync-service/src/adapters/http/resolve-conflict.controller.ts` | `POST /v1/field-sync/conflicts/resolve` |

These are not browser routes. They need an edge adapter that authenticates the
browser session, obtains the appropriate server-side credential, forwards only
an allowed request shape, maps the response, and preserves the security rules
below.

## Required backend outcome

Deliver one runnable edge service, not a collection of per-agency BFFs.

The service must:

1. Mount the corrected `/edge/v1/**` contract.
2. Compose the existing IAM, identity, application, scheduling, field-sync and
   other service clients behind that boundary.
3. Own officer login, applicant OTP, session probe, refresh and logout.
4. Store upstream officer and applicant credentials server-side only.
5. Issue an opaque `httpOnly` edge session cookie to the browser.
6. Issue and validate a readable CSRF cookie plus `x-csrf-token` on unsafe calls.
7. Derive agency from the verified officer session, never from a browser path,
   query parameter, body, or client-controlled header.
8. Forward only operation IDs and schemas present in the approved edge contract.
9. Provide readiness, liveness, correlation ID and structured audit integration.
10. Expose a deterministic dev boot and a production deployment artifact.

## Non-negotiable security invariants

- Never accept or emit a browser `Authorization` header.
- Never return an upstream JWT, applicant session token, password, OTP, client
  secret, private key, or `nationalIdHash`.
- Never accept agency as an authorization input from the browser.
- Never expose raw National ID in a response, URL, log, telemetry event, or
  persisted browser state.
- Never implement a generic status `PATCH` or `DELETE`; transitions remain
  separate typed POST operations.
- Never retry a state-changing transition, walk-in registration, vetting, device
  enrolment, score sync, or conflict resolution automatically.
- Preserve anti-enumeration responses byte-for-byte for OTP and protected reads.
- Preserve officer-visible states such as `409 AGE_PENDING` and `409 NO_CONFLICT`.
- Enforce cross-agency isolation in backend authorization and PostgreSQL RLS;
  frontend route guards are presentation only.

## Contract reconciliation required before implementation

The backend engineer must reconcile the edge OpenAPI before writing the runtime.
The frontend reconciliation record identifies these known stale shapes:

### Identity verification

The running controller accepts:

```json
{ "nationalId": "<16 digits>", "channel": "WALK_IN" }
```

The response is:

```json
{ "status": "CREATED", "applicantId": "<uuid>" }
```

or:

```json
{ "status": "ALREADY_EXISTS", "applicantId": "<uuid>" }
```

Do not restore an older `{ verified, fullName }` response. It would leak PII and
contradict the running controller.

### Walk-in registration

The running controller expects `applicantId`, `category`, and optional
`nesaIndexNumber` / `hecRegistrationNumber`. It does not expect browser-supplied
`nationalId`, `postCode`, `nationalIdHash`, or agency.

Success is:

```json
{
  "status": "REGISTERED",
  "applicationId": "<uuid>",
  "processingCode": "<code>",
  "qrInvitationCode": "<opaque ticket>"
}
```

### Field-sync operations

The upstream field-sync controllers are implemented, but there is no browser
edge route yet. The edge engineer must decide and document the approved browser
operation IDs and exact mappings for:

- device enrolment -> `POST /edge/v1/...` to upstream `POST /v1/field-sync/devices`
- score sync -> `POST /edge/v1/...` to upstream `POST /v1/field-sync/scores`
- conflict resolution -> `POST /edge/v1/...` to upstream `POST /v1/field-sync/conflicts/resolve`

Do not expose these by inventing raw service URLs in the frontend. The frontend
must add operation IDs only after the edge OpenAPI and runnable implementation
exist and contract drift passes.

## Required implementation sequence

### Phase 1: Contract authority

- Reconcile `services/edge-gateway/openapi/edge-v1.yaml` with running backend
  controllers and selfchecks.
- Remove stale multi-BFF language from backend docs and environment names.
- Pin the exact backend commit used to generate frontend contract artifacts.
- Generate, do not hand-edit, client and server contract artifacts.
- Add explicit field-sync edge operation definitions only when the runtime
  mapping and authorization policy are approved.

### Phase 2: Runtime composition

- Create the edge service package and entrypoint under `services/edge-gateway/`.
- Implement route registration from the approved operation registry.
- Implement server-side session persistence with expiry, refresh rotation and
  logout revocation.
- Implement CSRF validation on every unsafe browser request.
- Implement upstream service clients with timeouts, bounded payloads, correlation
  propagation, safe error mapping and no automatic retries for writes.
- Implement rate limiting for officer login and applicant OTP.
- Implement readiness checks that distinguish edge readiness from upstream
  dependency health.

### Phase 3: Verification

Required tests are not optional documentation:

- Contract test: every edge operation maps to one approved upstream operation.
- Auth test: browser receives only opaque session state; no upstream credential
  crosses the boundary.
- CSRF test: unsafe requests without the correct token are rejected.
- Isolation test: an officer cannot read or mutate another agency's records,
  including by tampering with IDs, query parameters or headers.
- Anti-enumeration test: OTP and protected-read failures have identical external
  shapes where required.
- Retry test: writes are never retried automatically.
- Field-sync test: malformed batches return the agreed edge error; forged records
  retain per-record outcomes; concurrent captures reach explicit conflict state.
- Live smoke test: login, session probe, refresh, logout, identity verification,
  walk-in registration/vetting and protected reads through `/edge/v1/**`.
- Dev-boot test: the complete stack starts with no port collision and proves the
  edge process is listening on the canonical port.
- Security scan: secrets, credential leakage, unsafe logs and dependency risk.

## Definition of done

The backend edge handoff is complete only when all of these are true:

- `services/edge-gateway/` contains a runnable package and production entrypoint.
- The corrected OpenAPI is the source of truth and passes contract drift.
- Shared session storage is durable, expiring, revocable and observable.
- Browser requests never need service ports or `Authorization` headers.
- Field-sync routes are either brokered through the edge or explicitly excluded
  from the approved browser contract with a documented reason.
- Backend typecheck, lint, tests, selfchecks and dev boot are green.
- Frontend generated contracts are regenerated from the pinned backend commit.
- Frontend live edge smoke tests pass against the deployed edge.
- Deployment readiness and rollback procedures exist.

## Explicit frontend boundary

Until this handoff is completed by the backend owner, frontend engineering must:

- keep `OFFLINE_CAPTURE_CAN_SYNC = false`;
- keep field-sync operations out of `EdgeOperationId` unless brokered by the edge;
- keep the tablet UI honest that captured scores remain on-device;
- avoid direct calls to ports `4009`, `4006`, `4001`, or any other service port;
- avoid hand-editing generated contract wire types;
- avoid claiming production readiness or live E2E coverage.

The frontend team may continue with UI architecture, accessibility, i18n,
feature-slice mounting, proof harnesses, local models, contract fixtures and
mocked E2E. It must not paper over the absent edge runtime with a second client
path.

## Handoff to backend engineer

Start with this document and the following frontend records:

- `docs/architecture/contract-reconciliation-2026-09-11.md`
- `docs/architecture/edge-contract.md`
- `docs/architecture/release-readiness.md`
- `docs/architecture/handover-audit-2026-09-13.md`

**Do not treat this handoff as evidence that the edge is implemented.** It is a
precise statement of the work required to make the browser boundary real.
