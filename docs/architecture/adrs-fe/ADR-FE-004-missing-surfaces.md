# ADR-FE-004 — The surfaces with no UI, and `apps/admin-console`

**Status:** Proposed · 2026-08-30

## 1. The gap, measured

The officer console has 5 routes. The browser-reachable surface is **26
operations**. Everything below existed in the backend before this repo did and had
no caller.

| Surface | Slice | Why it matters |
|---|---|---|
| Amber adjudication queue | adjudication | Two kinds of hold in one array: document holds carry forensic signals, `ADJUDICATION_REVIEW` holds carry **all nulls**. A table reading `row.documentType` renders blanks for half the queue, and a blank cell in a rejection workflow reads as "clean". |
| The four officer transitions | adjudication | The controller's own header says three. Its factory returns four. |
| DPO erasure queue + mandatory decline grounds | compliance | A refusal with no stated ground is a 400 on the wire and a rights violation in the file. |
| Citizen self-withdrawal | compliance | The citizen can start an application and cannot stop one. |
| Biometric check-in | field-ops | A failed match is a **200**. |
| Device enrolment, score sync, conflict resolution | field-ops | `SYNCED` can mean nothing was saved. |
| QR invitation verification | scheduling | Must work with no signal, at a venue. |

## 2. The ADR-020 authority gap, surfaced in the UI on purpose

The erasure queue and the decline route are guarded by `officer`, with **no DPO
role check anywhere**: any authenticated officer of any agency can read the queue
and decline a citizen's erasure request today. The queue is also the only officer
read in the platform that is not agency-scoped.

A frontend cannot fix that (INVARIANT 3: guards are presentational). What it can
do is refuse to look like a DPO-only console, so nobody mistakes the absence of a
check for the presence of one. `DPO_AUTHORITY_GAP` carries a banner rendered in
all three locales on both the queue and the decline dialog.

**Request (backend):** add a DPO role claim and enforce it in `withAuth`.

## 3. `packages/ui` migration ledger

Agent 3 owns `packages/design-system`. Proposed destinations:

| Component | Destination | Why |
|---|---|---|
| `ApplicationStatusBadge` | **delete** | Replaced by `applications` slice `StatusLozenge` + the tone map. The old one was built on 17 statuses, 5 of them real. |
| `DashboardMetricCard`, `AgencyLogo`, `RouterLink`, `ErrorBoundary`, `OfflineIndicator`, `AudioTooltip` | **stay** in design-system | Generic, no domain knowledge. |
| `WizardLayout` | design-system | Layout, not policy. |
| `BiometricConsent` | **move** to `features/identity` | Consent copy and receipt semantics are domain. |
| `QrScanner` | **move** to `features/field-ops` | Camera + haptics + venue procedure. |
| `DocumentUpload` | **move** to `features/applications` | Slots must be driven by `AGENCY_DOCUMENT_TYPES`; the wrong slot is a 422 the citizen cannot act on. |

**Request (Agent 3):** confirm, then delete the three moved components from
`packages/ui`. The slice-side destinations exist. Nothing was deleted from your
paths by this job.

## 4. `apps/admin-console` — proposed

`superadmin-bff` was reserved and never built, and **there is no superadmin
principal**: RLS is `FORCE`d on every ops schema and no principal kind bypasses
it. Cross-agency reads exist only for `kind: 'system'` on specific routes, never
for a human. An admin console therefore cannot be "the console that sees
everything", and a UI shaped around that idea would be a UI whose main screen
cannot be built.

What it can legitimately hold today: officer and service-client administration,
the audit trail, invitation key rotation, and health/readiness across the eleven
services (`GET /health`, `GET /ready` — noting `biometric-service` registers no
readiness probe, so its `/ready` always answers 200).

**Recommendation:** do not scaffold it yet. It needs endpoints that do not exist,
and a third app is a third dependency tree to keep patched. Revisit when the
audit-service and iam-service admin surfaces are exposed.

## 5. The two citizen steps that cannot exist

`POST /v1/identities/verify`, `POST /v1/applications` and
`POST /v1/documents/upload` are all `service-internal`. **The applicant portal
cannot verify a National ID, file an application, or upload a document today.**
All three need an edge tier holding a client-credentials token (ADR-016). This is
the single largest blocker in the frontend and it is not a frontend bug.

The e2e specs state it as `test.fixme` with a `BLOCKED:` reason. Proof 09 fails
any `test.fixme` without one, because an unexplained skip is silent coverage loss.
