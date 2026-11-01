# FE-P0 — operation inventory and integration blockers

**Status: investigation only; FE-P0 blocked.** Frontend base `2b9fe322f8b7a3c225b51f68e3d495d3f03a4eeb`; backend inspection target `e887c768989acd2bca9824a15e8f6d0fab50178c`; frontend pin remains `b004fca840af12435bbc84ec0e365c513c788c36`. The inspection target is **not an approved contract revision**. Approval and an immutable FE-P0 packet remain pending. No source, contract, pin or readiness changes are proposed here.

## Method, interpretation and limits

The inventory deliberately includes **all 68 frontend registry entries**, a conservative superset of operations used by mounted screens. Rows link the browser edge registry to the inspection-target edge handler and owning service controller, frontend wrapper and declared surface. Where no surface is declared, the consumer column identifies the best observed path or says unverified/registry-only; a wrapper or manifest is not proof that a production route calls it. `requestOtp`, `verifyOtp`, `applicantLogout` and `getStatusHistory` are frontend aliases for different backend operation IDs, mapped by method/path. `getApplicationDetail` and `decideErasureRequest` are composed, with every listed upstream shown.

Sources: frontend [`paths.ts`](../../packages/api-client/src/paths.ts), [`operations/`](../../packages/api-client/src/operations/), [`queries/`](../../packages/api-client/src/queries/), [`surface manifests`](../ui-surfaces/), [`auth edge client`](../../packages/auth/src/edge-client.ts); inspection-target backend [edge registry](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/domain/edge-operations.ts), [handler composition](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/routes.ts), [upstream registry](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/domain/upstream-operations.ts), [guards](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/guards.ts) and [edge OpenAPI](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/openapi/edge-v1.yaml). Downstream controller candidates were joined by upstream method/path to the existing **old-pin** route manifest and checked for file existence at the inspection target; mounting and deeper cross-service calls still need inspection-target live/source verification. Never call an upstream path from the browser.

`permission` and CSRF below are registry observations, not institutional ratification or proof of service enforcement. `alsoPermission` is an any-of rule; server session controls agency. A dash for permission means no explicit edge permission, **not** no authorization (session, token, ownership and other guards may apply). All POSTs require CSRF in the inspected registry. `retry` is a registry bit, not permission to retry writes under frontend AGENTS.md.

### Frontend and backend source key

- **F1**: [`packages/api-client/src/operations/admin-reads.ts`](../../packages/api-client/src/operations/admin-reads.ts)
- **F2**: [`packages/api-client/src/operations/applicant.ts`](../../packages/api-client/src/operations/applicant.ts)
- **F3**: [`packages/api-client/src/operations/applications.ts`](../../packages/api-client/src/operations/applications.ts)
- **F4**: [`packages/api-client/src/operations/campaign-control.ts`](../../packages/api-client/src/operations/campaign-control.ts)
- **F5**: [`packages/api-client/src/operations/campaigns.ts`](../../packages/api-client/src/operations/campaigns.ts)
- **F6**: [`packages/api-client/src/operations/documents.ts`](../../packages/api-client/src/operations/documents.ts)
- **F7**: [`packages/api-client/src/operations/exam-invitation.ts`](../../packages/api-client/src/operations/exam-invitation.ts)
- **F8**: [`packages/api-client/src/operations/field-sync.ts`](../../packages/api-client/src/operations/field-sync.ts)
- **F9**: [`packages/api-client/src/operations/gate.ts`](../../packages/api-client/src/operations/gate.ts)
- **F10**: [`packages/api-client/src/operations/identity.ts`](../../packages/api-client/src/operations/identity.ts)
- **F11**: [`packages/api-client/src/operations/ops-reads.ts`](../../packages/api-client/src/operations/ops-reads.ts)
- **F12**: [`packages/api-client/src/operations/session.ts`](../../packages/api-client/src/operations/session.ts)
- **F13**: [`packages/api-client/src/operations/staff.ts`](../../packages/api-client/src/operations/staff.ts)
- **F14**: [`packages/auth/src/edge-client.ts`](../../packages/auth/src/edge-client.ts)
- **B1**: [`services/application-service/src/adapters/http/biometric-evidence.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/http/biometric-evidence.controller.ts)
- **B2**: [`services/application-service/src/adapters/http/campaign-control.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/http/campaign-control.controller.ts)
- **B3**: [`services/application-service/src/adapters/http/campaign-public-read.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/http/campaign-public-read.controller.ts)
- **B4**: [`services/application-service/src/adapters/http/document-checklist.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/http/document-checklist.controller.ts)
- **B5**: [`services/application-service/src/adapters/http/list-applications.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/http/list-applications.controller.ts)
- **B6**: [`services/application-service/src/adapters/http/officer-transitions.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/http/officer-transitions.controller.ts)
- **B7**: [`services/application-service/src/adapters/http/operational-read.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/http/operational-read.controller.ts)
- **B8**: [`services/application-service/src/adapters/http/walk-in.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/http/walk-in.controller.ts)
- **B9**: [`services/biometric-service/src/adapters/http/biometric-evidence.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/biometric-service/src/adapters/http/biometric-evidence.controller.ts)
- **B10**: [`services/edge-gateway/src/adapters/http/applicant-auth.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/applicant-auth.controller.ts)
- **B11**: [`services/edge-gateway/src/adapters/http/biometric-evidence.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/biometric-evidence.controller.ts)
- **B12**: [`services/edge-gateway/src/adapters/http/campaigns.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/campaigns.controller.ts)
- **B13**: [`services/edge-gateway/src/adapters/http/citizen.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/citizen.controller.ts)
- **B14**: [`services/edge-gateway/src/adapters/http/document-checklist.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/document-checklist.controller.ts)
- **B15**: [`services/edge-gateway/src/adapters/http/exam-invitation.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/exam-invitation.controller.ts)
- **B16**: [`services/edge-gateway/src/adapters/http/field-sync.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/field-sync.controller.ts)
- **B17**: [`services/edge-gateway/src/adapters/http/fleet.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/fleet.controller.ts)
- **B18**: [`services/edge-gateway/src/adapters/http/gate-admission.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/gate-admission.controller.ts)
- **B19**: [`services/edge-gateway/src/adapters/http/identity-read.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/identity-read.controller.ts)
- **B20**: [`services/edge-gateway/src/adapters/http/identity.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/identity.controller.ts)
- **B21**: [`services/edge-gateway/src/adapters/http/officer-admin.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/officer-admin.controller.ts)
- **B22**: [`services/edge-gateway/src/adapters/http/officer-auth.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/officer-auth.controller.ts)
- **B23**: [`services/edge-gateway/src/adapters/http/officer-reads.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/officer-reads.controller.ts)
- **B24**: [`services/edge-gateway/src/adapters/http/officer-transitions.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/officer-transitions.controller.ts)
- **B25**: [`services/edge-gateway/src/adapters/http/operational-reads.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/operational-reads.controller.ts)
- **B26**: [`services/edge-gateway/src/adapters/http/session.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/session.controller.ts)
- **B27**: [`services/edge-gateway/src/adapters/http/walk-in.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/walk-in.controller.ts)
- **B28**: [`services/field-sync-service/src/adapters/http/enroll-device.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/field-sync-service/src/adapters/http/enroll-device.controller.ts)
- **B29**: [`services/field-sync-service/src/adapters/http/manage-fleet.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/field-sync-service/src/adapters/http/manage-fleet.controller.ts)
- **B30**: [`services/field-sync-service/src/adapters/http/resolve-conflict.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/field-sync-service/src/adapters/http/resolve-conflict.controller.ts)
- **B31**: [`services/field-sync-service/src/adapters/http/sync-scores.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/field-sync-service/src/adapters/http/sync-scores.controller.ts)
- **B32**: [`services/iam-service/src/adapters/http/officer-admin.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/iam-service/src/adapters/http/officer-admin.controller.ts)
- **B33**: [`services/iam-service/src/adapters/http/officer-login.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/iam-service/src/adapters/http/officer-login.controller.ts)
- **B34**: [`services/identity-service/src/adapters/http/applicant-auth.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/http/applicant-auth.controller.ts)
- **B35**: [`services/identity-service/src/adapters/http/applicant-documents.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/http/applicant-documents.controller.ts)
- **B36**: [`services/identity-service/src/adapters/http/erasure-request.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/http/erasure-request.controller.ts)
- **B37**: [`services/identity-service/src/adapters/http/erasure.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/http/erasure.controller.ts)
- **B38**: [`services/identity-service/src/adapters/http/gate-admission.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/http/gate-admission.controller.ts)
- **B39**: [`services/identity-service/src/adapters/http/own-identity.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/http/own-identity.controller.ts)
- **B40**: [`services/identity-service/src/adapters/http/verify-identity.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/http/verify-identity.controller.ts)
- **B41**: [`services/scheduling-service/src/adapters/campaign-session.controller.ts`](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/scheduling-service/src/adapters/campaign-session.controller.ts)

## A. Operation → actual source, consumer and authorization

`U` lists upstream method/path and controller key. Surface names link to their manifests, which identify route source and referenced test files. These are *declared* associations, not proof that each test covers the operation. `—` means none located by this search, not proven absence.

| Frontend ID · method · edge path | Backend edge handler → U | Session / permission / CSRF / retry | Frontend wrapper → observed or declared consumer |
|---|---|---|---|
| `officerLogin` · POST `/edge/v1/auth/officer/login` | B22 `officerLoginHandler` → POST `/v1/auth/officer/login` (B33) | anonymous; `—`; CSRF true; retry false | F12, F14 → [field.sign-in](../ui-surfaces/field.sign-in.json), [officer.sign-in](../ui-surfaces/officer.sign-in.json) |
| `officerLogout` · POST `/edge/v1/auth/officer/logout` | B22 `officerLogoutHandler` → edge-local | officer; `—`; CSRF true; retry false | F12, F14 → auth API; no surface control established |
| `beginApplicantOnboarding` · POST `/edge/v1/auth/applicant/identity` | B10 `beginApplicantOnboardingHandler` → POST `/v1/applicants/auth/onboarding/begin` (B34) | anonymous; `—`; CSRF true; retry false | F12, F14 → [citizen.sign-in](../ui-surfaces/citizen.sign-in.json) |
| `listCampaigns` · GET `/edge/v1/campaigns` | B12 `listPublicCampaignsHandler` → GET `/v1/campaigns` (B3) | anonymous; `—`; CSRF false; retry true | F5 → [citizen.apply](../ui-surfaces/citizen.apply.json) |
| `getCampaignDetail` · GET `/edge/v1/campaigns/detail` | B12 `publicCampaignDetailHandler` → GET `/v1/campaigns/detail` (B3) | anonymous; `—`; CSRF false; retry true | F5 → [citizen.apply](../ui-surfaces/citizen.apply.json) |
| `createCampaign` · POST `/edge/v1/campaigns` | B12 `createCampaignHandler` → POST `/v1/campaigns` (B2) | officer; `campaign.create`; CSRF true; retry false | F4 → [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json) |
| `createCampaignPolicy` · POST `/edge/v1/campaigns/policy` | B12 `createCampaignPolicyHandler` → POST `/v1/campaigns/policy` (B2) | officer; `campaign.policy.create`; CSRF true; retry false | F4 → [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json) |
| `configureCampaignSession` · POST `/edge/v1/campaigns/session` | B12 `configureCampaignSessionHandler` → POST `/v1/campaigns/session` (B41) | officer; `campaign.session.configure`; CSRF true; retry false | F4 → [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json) |
| `publishCampaign` · POST `/edge/v1/campaigns/publish` | B12 `publishCampaignHandler` → POST `/v1/campaigns/publish` (B2) | officer; `campaign.publish`; CSRF true; retry false | F4 → [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json) |
| `closeCampaignRegistration` · POST `/edge/v1/campaigns/registration-close` | B12 `closeCampaignRegistrationHandler` → POST `/v1/campaigns/registration-close` (B2) | officer; `campaign.registration.close`; CSRF true; retry false | F4 → [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json) |
| `completeCampaign` · POST `/edge/v1/campaigns/complete` | B12 `completeCampaignHandler` → POST `/v1/campaigns/complete` (B2) | officer; `campaign.complete`; CSRF true; retry false | F4 → [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json) |
| `cancelCampaign` · POST `/edge/v1/campaigns/cancel` | B12 `cancelCampaignHandler` → POST `/v1/campaigns/cancel` (B2) | officer; `campaign.cancel`; CSRF true; retry false | F4 → [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json) |
| `requestOtp` → `requestApplicantOtp` · POST `/edge/v1/auth/applicant/otp/request` | B10 `requestApplicantOtpHandler` → POST `/v1/applicants/auth/otp/request` (B34) | anonymous; `—`; CSRF true; retry true | F12, F14 → [citizen.sign-in](../ui-surfaces/citizen.sign-in.json) |
| `verifyOtp` → `verifyApplicantOtp` · POST `/edge/v1/auth/applicant/otp/verify` | B10 `verifyApplicantOtpHandler` → POST `/v1/applicants/auth/otp/verify` (B34) | anonymous; `—`; CSRF true; retry false | F12, F14 → [citizen.sign-in](../ui-surfaces/citizen.sign-in.json) |
| `applicantLogout` → `logoutApplicant` · POST `/edge/v1/auth/applicant/logout` | B10 `logoutApplicantHandler` → POST `/v1/applicants/auth/logout` (B34) | applicant; `—`; CSRF true; retry false | F12, F14 → auth API; no surface control established |
| `listApplications` · GET `/edge/v1/applications` | B23 `listApplicationsHandler` → GET `/v1/applications` (B5) | officer; `application.read`; CSRF false; retry true | F3 → [officer.dashboard](../ui-surfaces/officer.dashboard.json) |
| `listAmberQueue` · GET `/edge/v1/applications/amber-queue` | B23 `listAmberQueueHandler` → GET `/v1/applications/amber-queue` (B5) | officer; `adjudication.read`; CSRF false; retry true | F3 → [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.dashboard](../ui-surfaces/officer.dashboard.json) |
| `findApplicationById` · GET `/edge/v1/applications/by-id` | B23 `findApplicationByIdHandler` → GET `/v1/applications/by-id` (B5) | officer; `application.read`; CSRF false; retry true | F3 → wrapper/hooks; UI usage not established |
| `getStatusHistory` → `getApplicationStatusHistory` · GET `/edge/v1/applications/status-history` | B23 `getApplicationStatusHistoryHandler` → GET `/v1/applications/status-history` (B5) | officer; `application.read`; CSRF false; retry true | F3 → wrapper/hooks; UI usage not established |
| `getApplicationDetail` · GET `/edge/v1/applications/detail` | B23 `getApplicationDetailHandler` → GET `/v1/applications/by-id` (B5); GET `/v1/applications/status-history` (B5) | officer; `application.read`; CSRF false; retry true | F3 → [officer.application-workspace](../ui-surfaces/officer.application-workspace.json) |
| `recordMedicalReview` · POST `/edge/v1/applications/medical-review` | B24 `recordMedicalReviewHandler` → POST `/v1/applications/medical-review` (B6) | officer; `medical.review`; CSRF true; retry false | F3 → [field.medical](../ui-surfaces/field.medical.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json) |
| `recordFinalDecision` · POST `/edge/v1/applications/final-decision` | B24 `recordFinalDecisionHandler` → POST `/v1/applications/final-decision` (B6) | officer; `decision.final`; CSRF true; retry false | F3 → [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json) |
| `acceptApplication` · POST `/edge/v1/applications/accept` | B24 `acceptApplicationHandler` → POST `/v1/applications/accept` (B6) | officer; `application.accept`; CSRF true; retry false | F3 → [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json) |
| `adjudicateApplication` · POST `/edge/v1/applications/adjudicate` | B24 `adjudicateApplicationHandler` → POST `/v1/applications/adjudicate` (B6) | officer; `adjudication.decide`; CSRF true; retry false | F3 → [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json) |
| `registerWalkIn` · POST `/edge/v1/applications/walk-in/register` | B27 `registerWalkInHandler` → POST `/v1/applications/walk-in/register` (B8) | officer; `walkin.register`; CSRF true; retry false | F3 → [field.walk-in](../ui-surfaces/field.walk-in.json) |
| `vetWalkIn` · POST `/edge/v1/applications/walk-in/vet` | B27 `vetWalkInHandler` → POST `/v1/applications/walk-in/vet` (B8) | officer; `walkin.vet`; CSRF true; retry false | F3 → [field.walk-in](../ui-surfaces/field.walk-in.json) |
| `admitAtGate` · POST `/edge/v1/gate/admissions` | B18 `admitAtGateHandler` → POST `/v1/gate/admissions` (B38) | officer; `admission.gate`; CSRF true; retry false | F9 → [field.gate](../ui-surfaces/field.gate.json) |
| `verifyIdentity` · POST `/edge/v1/identities/verify` | B20 `verifyIdentityHandler` → POST `/v1/identities/verify` (B40) | officer; `identity.verify`; CSRF true; retry false | F3 → [field.walk-in](../ui-surfaces/field.walk-in.json) |
| `listMyApplications` · GET `/edge/v1/me/applications` | B13 `listMyApplicationsHandler` → GET `/v1/applicants/me/applications` (B34) | applicant; `—`; CSRF false; retry true | F2 → [citizen.applications](../ui-surfaces/citizen.applications.json) |
| `submitMyApplication` · POST `/edge/v1/me/applications` | B13 `submitMyApplicationHandler` → POST `/v1/applicants/me/applications` (B34) | applicant; `—`; CSRF true; retry false | F2 → [citizen.apply](../ui-surfaces/citizen.apply.json) |
| `getMyExamInvitation` · GET `/edge/v1/me/applications/exam-invitation` | B15 `getMyExamInvitationHandler` → GET `/v1/applicants/me/applications/exam-invitation` (B34) | applicant; `—`; CSRF false; retry true | F7 → [citizen.exam-pass](../ui-surfaces/citizen.exam-pass.json) |
| `getMyDocumentChecklist` · GET `/edge/v1/me/applications/document-checklist` | B14 `getMyDocumentChecklistHandler` → GET `/v1/applicants/me/applications/document-checklist` (B34) | applicant; `—`; CSRF false; retry true | F6 → [citizen.documents](../ui-surfaces/citizen.documents.json) |
| `getMyIdentity` · GET `/edge/v1/me/identity` | B19 `getMyIdentityHandler` → GET `/v1/applicants/me/identity` (B39) | applicant; `—`; CSRF false; retry true | F10 → [citizen.apply](../ui-surfaces/citizen.apply.json) |
| `attachMyClearanceCertificate` · POST `/edge/v1/me/applications/clearance-certificate` | B13 `attachMyClearanceCertificateHandler` → POST `/v1/applicants/me/applications/clearance-certificate` (B34) | applicant; `—`; CSRF true; retry false | F6 → [citizen.documents](../ui-surfaces/citizen.documents.json) |
| `getDocumentChecklist` · GET `/edge/v1/applications/document-checklist` | B14 `getDocumentChecklistHandler` → GET `/v1/applications/document-checklist` (B4) | officer; `application.read`; CSRF false; retry true | F6 → [officer.application-workspace](../ui-surfaces/officer.application-workspace.json) |
| `verifyDocumentAtVenue` · POST `/edge/v1/applications/documents/verify-at-venue` | B14 `verifyDocumentAtVenueHandler` → POST `/v1/applications/documents/verify-at-venue` (B4) | officer; `document.verify.venue`; CSRF true; retry false | F6 → wrapper; no paper station in manifest |
| `uploadMyDocument` · POST `/edge/v1/me/applications/documents` | B13 `uploadMyDocumentHandler` → POST `/v1/applicants/me/applications/documents` (B35) | applicant; `—`; CSRF true; retry false | F2 → citizen.apply (upload step; omitted from manifest) |
| `withdrawMyApplication` · POST `/edge/v1/me/applications/withdraw` | B13 `withdrawMyApplicationHandler` → POST `/v1/applicants/me/applications/withdraw` (B34) | applicant; `—`; CSRF true; retry false | F2 → [citizen.withdraw](../ui-surfaces/citizen.withdraw.json) |
| `getMyErasureRequest` · GET `/edge/v1/me/erasure-request` | B13 `getMyErasureRequestHandler` → GET `/v1/applicants/me/erasure-request` (B36) | applicant; `—`; CSRF false; retry true | F2 → compliance API; citizen surface blocked |
| `fileMyErasureRequest` · POST `/edge/v1/me/erasure-request` | B13 `fileMyErasureRequestHandler` → POST `/v1/applicants/me/erasure-request` (B36) | applicant; `—`; CSRF true; retry false | F2 → compliance API; citizen surface blocked |
| `enrollFieldDevice` · POST `/edge/v1/field-sync/devices` | B16 `enrollFieldDeviceHandler` → POST `/v1/field-sync/devices` (B28) | officer; `field.device.enroll`; CSRF true; retry false | F8 → [field.setup](../ui-surfaces/field.setup.json) |
| `syncFieldScores` · POST `/edge/v1/field-sync/scores` | B16 `syncFieldScoresHandler` → POST `/v1/field-sync/scores` (B31) | officer; `field.score.sync`; CSRF true; retry false | F8 → [field.physical](../ui-surfaces/field.physical.json), [field.supervisor](../ui-surfaces/field.supervisor.json) |
| `resolveFieldSyncConflict` · POST `/edge/v1/field-sync/conflicts/resolve` | B16 `resolveFieldSyncConflictHandler` → POST `/v1/field-sync/conflicts/resolve` (B30) | officer; `field.conflict.resolve`; CSRF true; retry false | F8 → [field.conflicts](../ui-surfaces/field.conflicts.json) |
| `listOfficers` · GET `/edge/v1/officers` | B21 `listOfficersHandler` → GET `/v1/officers` (B32) | officer; `officer.read`; CSRF false; retry true | F13 → [officer.dashboard](../ui-surfaces/officer.dashboard.json), [officer.staff](../ui-surfaces/officer.staff.json) |
| `createOfficer` · POST `/edge/v1/officers` | B21 `createOfficerHandler` → POST `/v1/officers` (B32) | officer; `officer.create`; CSRF true; retry false | F13 → [officer.staff](../ui-surfaces/officer.staff.json) |
| `releaseOfficerActivation` · POST `/edge/v1/officers/activation/release` | B21 `releaseOfficerActivationHandler` → POST `/v1/officers/activation/release` (B32) | officer; `officer.create`; CSRF true; retry false | F13 → staff wrapper; UI usage not established |
| `reissueOfficerActivation` · POST `/edge/v1/officers/activation/reissue` | B21 `reissueOfficerActivationHandler` → POST `/v1/officers/activation/reissue` (B32) | officer; `officer.create`; CSRF true; retry false | F13 → [officer.staff](../ui-surfaces/officer.staff.json) |
| `assignOfficerPosts` · POST `/edge/v1/officers/posts` | B21 `assignOfficerPostsHandler` → POST `/v1/officers/posts` (B32) | officer; `officer.posts.assign`; CSRF true; retry false | F13 → [officer.staff](../ui-surfaces/officer.staff.json) |
| `disableOfficer` · POST `/edge/v1/officers/disable` | B21 `disableOfficerHandler` → POST `/v1/officers/disable` (B32) | officer; `officer.disable`; CSRF true; retry false | F13 → [officer.staff](../ui-surfaces/officer.staff.json) |
| `enableOfficer` · POST `/edge/v1/officers/enable` | B21 `enableOfficerHandler` → POST `/v1/officers/enable` (B32) | officer; `officer.disable`; CSRF true; retry false | F13 → [officer.staff](../ui-surfaces/officer.staff.json) |
| `revokeOfficerSessions` · POST `/edge/v1/officers/sessions/revoke` | B21 `revokeOfficerSessionsHandler` → POST `/v1/officers/sessions/revoke` (B32) | officer; `officer.sessions.revoke`; CSRF true; retry false | F13 → [officer.staff](../ui-surfaces/officer.staff.json) |
| `activateOfficer` · POST `/edge/v1/auth/officer/activate` | B21 `activateOfficerHandler` → POST `/v1/auth/officer/activate` (B32) | anonymous; `—`; CSRF true; retry false | F13 → [officer.activate](../ui-surfaces/officer.activate.json) |
| `listAgencyCampaigns` · GET `/edge/v1/campaigns/admin` | B25 `listAgencyCampaignsHandler` → GET `/v1/campaigns/admin` (B7) | officer; `campaign.read.admin`; CSRF false; retry true | F1 → [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json), [officer.dashboard](../ui-surfaces/officer.dashboard.json) |
| `getCampaignAdminDetail` · GET `/edge/v1/campaigns/admin/detail` | B25 `getCampaignAdminDetailHandler` → GET `/v1/campaigns/admin/detail` (B7) | officer; `campaign.read.admin`; CSRF false; retry true | F1 → [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json) |
| `searchApplications` · GET `/edge/v1/applications/search` | B25 `searchApplicationsHandler` → GET `/v1/applications/search` (B7) | officer; `application.read`; CSRF false; retry true | F11 → [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json), [officer.dashboard](../ui-surfaces/officer.dashboard.json) |
| `getVenueRoster` · GET `/edge/v1/gate/roster` | B25 `getVenueRosterHandler` → GET `/v1/venue-roster` (B7) | officer; `admission.gate OR field.score.sync`; CSRF false; retry true | F8 → [field.setup](../ui-surfaces/field.setup.json) |
| `getVenueLiveCounts` · GET `/edge/v1/gate/live-counts` | B17 `getVenueLiveCountsHandler` → GET `/v1/venue-live-counts` (B7) | officer; `field.score.sync OR field.device.manage`; CSRF false; retry true | F8 → [field.supervisor](../ui-surfaces/field.supervisor.json) |
| `listFieldDevices` · GET `/edge/v1/field-sync/devices` | B17 `listFieldDevicesHandler` → GET `/v1/field-sync/devices/fleet` (B29) | officer; `field.device.manage`; CSRF false; retry true | F1 → [field.supervisor](../ui-surfaces/field.supervisor.json), [officer.dashboard](../ui-surfaces/officer.dashboard.json) |
| `assignDeviceToVenueDay` · POST `/edge/v1/field-sync/devices/assign` | B17 `assignDeviceToVenueDayHandler` → POST `/v1/field-sync/devices/assign` (B29) | officer; `field.device.manage`; CSRF true; retry false | no typed wrapper found → registry only; no consumer found |
| `revokeFieldDevice` · POST `/edge/v1/field-sync/devices/revoke` | B17 `revokeFieldDeviceHandler` → POST `/v1/field-sync/devices/revoke` (B29) | officer; `field.device.manage`; CSRF true; retry false | no typed wrapper found → registry only; no consumer found |
| `listErasureRequests` · GET `/edge/v1/erasure-requests` | B25 `listErasureRequestsHandler` → GET `/v1/identities/erasure-requests` (B36) | officer; `erasure.queue.read`; CSRF false; retry true | F11 → [officer.erasure-queue](../ui-surfaces/officer.erasure-queue.json) |
| `getBiometricPolicy` · GET `/edge/v1/gate/biometric-policy` | B11 `getBiometricPolicyHandler` → GET `/v1/biometric/policy` (B9) | officer; `biometric.verify`; CSRF false; retry true | F8 → [field.check-in](../ui-surfaces/field.check-in.json) |
| `recordBiometricEvidence` · POST `/edge/v1/gate/biometric-evidence` | B11 `recordBiometricEvidenceHandler` → POST `/v1/biometric/evidence` (B9) | officer; `biometric.verify`; CSRF true; retry false | no typed wrapper found → registry only; no consumer found |
| `getBiometricEvidence` · GET `/edge/v1/applications/biometric-evidence` | B11 `getBiometricEvidenceHandler` → GET `/v1/applications/biometric-evidence` (B1) | officer; `biometric.evidence.read`; CSRF false; retry true | F11 → [officer.application-workspace](../ui-surfaces/officer.application-workspace.json) |
| `confirmManualIdentity` · POST `/edge/v1/gate/manual-identity` | B11 `confirmManualIdentityHandler` → POST `/v1/applications/biometric-evidence/manual-identity` (B1) | officer; `identity.manual.confirm`; CSRF true; retry false | no typed wrapper found → registry only; no consumer found |
| `decideErasureRequest` · POST `/edge/v1/erasure-requests/decision` | B25 `decideErasureRequestHandler` → POST `/v1/identities/erasure-requests/decline` (B36); GET `/v1/identities/erasure-requests` (B36); POST `/v1/identities/erasure` (B37) | officer; `erasure.decide`; CSRF true; retry false | F11 → [officer.erasure-queue](../ui-surfaces/officer.erasure-queue.json) |
| `readSession` · GET `/edge/v1/session` | B26 `readSessionHandler` → edge-local | anonymous; `—`; CSRF false; retry false | F12, F14 → [citizen.sign-in](../ui-surfaces/citizen.sign-in.json), [field.sign-in](../ui-surfaces/field.sign-in.json), [officer.sign-in](../ui-surfaces/officer.sign-in.json); app auth boot |
| `refreshSession` · POST `/edge/v1/session/refresh` | B26 `refreshSessionHandler` → edge-local | anonymous; `—`; CSRF true; retry false | F12, F14 → app auth refresh loop |

## B. Decoder, outcome and proof coverage matrix

This is a **gap register**, not an exhaustive contract packet. `E(req/resp/out)` means presence in `PARITY_TABLE`, not a pass for all fields; `—` is a missing table mapping, even if the backend schema itself omits that dimension. Gate E only extracts certain JSON shapes and 409/422 outcomes, and does not compare permission or all status codes. `doc outcomes` is the exact inspected OpenAPI `x-usrp-outcomes` metadata if present, **not** an exhaustive list of actual business outcomes; `∅` means metadata is `{}` and `not supplied` means no metadata found. A positive result must be reconciled against the controllers and handoff.

Runtime request: the shared transport serializes `body`/query/form, without per-operation schema validation; TypeScript input types and selected local form checks are not a request decoder. Every row therefore needs request validation/parity and malformed/extra-field tests, except bodyless operations where query/header and method validation replace body tests. Runtime success: `transport.ts` casts parsed JSON to `T`; **raw** below means no boundary success decoder was found in the operation wrapper. `decode.ts` contains pure decoders but search found no production callers; their presence is not coverage. `partial` means some parsing exists but not full contract proof. Auth uses a separate client and selective parsing, not necessarily the similarly named api-client wrappers. Field outcomes are mapped later by the ledger; gate refusal decoding does not validate success.

For **every row**, required tests remain: exact edge method/body/query/headers and response decoding, unknown/malformed response and outcome fail-safe, unauthenticated/wrong-session/CSRF as applicable, permission and agency/ownership negative (including any-of), no prohibited leaks, correct retry/idempotency behavior and live owning-service contract. Existing test paths in each surface manifest are only starting points; no per-operation assertion coverage or current-target live pass is established. For registry-only rows, consumer/scope decision precedes integration rather than inventing one.

| Operation | E req/resp/out | Success decoding at observed wrapper | OpenAPI declared business outcomes | Existing test anchors / remaining obligation |
|---|---|---|---|---|
| `officerLogin` | —/—/— | raw cast; add approved success decoder | not supplied | [field.sign-in](../ui-surfaces/field.sign-in.json), [officer.sign-in](../ui-surfaces/officer.sign-in.json); apply common proof matrix |
| `officerLogout` | —/—/— | raw cast; add approved success decoder | ∅ | no surface test anchor identified; apply common proof matrix |
| `beginApplicantOnboarding` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.sign-in](../ui-surfaces/citizen.sign-in.json); apply common proof matrix |
| `listCampaigns` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.apply](../ui-surfaces/citizen.apply.json); apply common proof matrix |
| `getCampaignDetail` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.apply](../ui-surfaces/citizen.apply.json); apply common proof matrix |
| `createCampaign` | Y/—/— | partial: campaign command decoder; malformed test + full schema parity needed | `{ 409: [PUBLIC_CODE_ALREADY_EXISTS, CAMPAIGN_LABEL_ALREADY_EXISTS, CAMPAIGN_WRITE_CONFLICT, IDEMPOTENCY_KEY_REUSED], 422: [CATEGORY_AGENCY_MISMATCH, INVALID_REGISTRATION_WINDOW, INVALID_EXAMINATION_WINDOW] }` | [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json); apply common proof matrix |
| `createCampaignPolicy` | Y/—/— | partial: campaign command decoder; malformed test + full schema parity needed | `{ 409: [INVALID_STATE, POLICY_VERSION_CONFLICT, POLICY_HASH_MISMATCH, IDEMPOTENCY_KEY_REUSED], 422: [INVALID_POLICY, POLICY_CATEGORY_COVERAGE_MISMATCH] }` | [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json); apply common proof matrix |
| `configureCampaignSession` | Y/—/— | partial: campaign command decoder; malformed test + full schema parity needed | `{ 409: [INVALID_STATE, SESSION_ALREADY_RESERVED, STALE_COVERAGE, INCOMPLETE_COVERAGE, CAPACITY_DECISION_REQUIRED, IDEMPOTENCY_KEY_REUSED], 422: [INVALID_SESSION_CONFIGURATION, INVALID_SESSION_DATE, INVALID_REPORTING_HOUR, DISTRICT_PROVINCE_MISMATCH] }` | [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json); apply common proof matrix |
| `publishCampaign` | Y/—/— | partial: campaign command decoder; malformed test + full schema parity needed | `{ 409: [INVALID_STATE, POLICY_NOT_SET, INCOMPLETE_COVERAGE, STALE_COVERAGE, POLICY_HASH_MISMATCH, INVALID_CAPACITY, CAPACITY_DECISION_REQUIRED, IDEMPOTENCY_KEY_REUSED] }` | [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json); apply common proof matrix |
| `closeCampaignRegistration` | Y/—/— | partial: campaign command decoder; malformed test + full schema parity needed | `{ 409: [INVALID_STATE, IDEMPOTENCY_KEY_REUSED] }` | [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json); apply common proof matrix |
| `completeCampaign` | Y/—/— | partial: campaign command decoder; malformed test + full schema parity needed | `{ 409: [INVALID_STATE, IDEMPOTENCY_KEY_REUSED] }` | [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json); apply common proof matrix |
| `cancelCampaign` | Y/—/— | partial: campaign command decoder; malformed test + full schema parity needed | `{ 409: [INVALID_STATE, CANCELLATION_HAS_APPLICATIONS, IDEMPOTENCY_KEY_REUSED] }` | [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json); apply common proof matrix |
| `requestOtp` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.sign-in](../ui-surfaces/citizen.sign-in.json); apply common proof matrix |
| `verifyOtp` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.sign-in](../ui-surfaces/citizen.sign-in.json); apply common proof matrix |
| `applicantLogout` | —/—/— | raw cast; add approved success decoder | not supplied | no surface test anchor identified; apply common proof matrix |
| `listApplications` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.dashboard](../ui-surfaces/officer.dashboard.json); apply common proof matrix |
| `listAmberQueue` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.dashboard](../ui-surfaces/officer.dashboard.json); apply common proof matrix |
| `findApplicationById` | —/—/— | raw cast; add approved success decoder | ∅ | no surface test anchor identified; apply common proof matrix |
| `getStatusHistory` | —/—/— | raw cast; add approved success decoder | ∅ | no surface test anchor identified; apply common proof matrix |
| `getApplicationDetail` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.application-workspace](../ui-surfaces/officer.application-workspace.json); apply common proof matrix |
| `recordMedicalReview` | —/—/— | raw cast; add approved success decoder | `{ 409: [ILLEGAL_TRANSITION], 422: [INVALID_MEDICAL_INPUT] }` | [field.medical](../ui-surfaces/field.medical.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json); apply common proof matrix |
| `recordFinalDecision` | —/—/— | raw cast; add approved success decoder | `{ 409: [ILLEGAL_TRANSITION] }` | [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json); apply common proof matrix |
| `acceptApplication` | —/—/— | raw cast; add approved success decoder | `{ 409: [ILLEGAL_TRANSITION, CROSS_AGENCY_ACCEPT_LOCK] }` | [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json); apply common proof matrix |
| `adjudicateApplication` | —/—/— | raw cast; add approved success decoder | `{ 409: [ILLEGAL_TRANSITION, ADJUDICATION_LANE_REQUIRED] }` | [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json); apply common proof matrix |
| `registerWalkIn` | —/—/Y | raw cast; add approved success decoder | `{ 409: [IDENTITY_NOT_VERIFIED, NO_WALK_IN_CAMPAIGN, ALREADY_APPLIED], 422: [INVALID_ACADEMIC_INPUT, VALIDATION_FAILED] }` | [field.walk-in](../ui-surfaces/field.walk-in.json); apply common proof matrix |
| `vetWalkIn` | —/—/— | raw cast; add approved success decoder | `{ 409: [AGE_PENDING, ILLEGAL_TRANSITION], 422: [VALIDATION_FAILED] }` | [field.walk-in](../ui-surfaces/field.walk-in.json); apply common proof matrix |
| `admitAtGate` | Y/—/Y | partial: refusal mapper; 2xx is raw cast | `{ 409: [ALREADY_ADMITTED, NOT_ADMISSIBLE, IDENTITY_MISMATCH, WRONG_VENUE, TOO_EARLY, EXPIRED, MANUAL_IDENTITY_REQUIRED], 422: [INVALID_TICKET] }` | [field.gate](../ui-surfaces/field.gate.json); apply common proof matrix |
| `verifyIdentity` | —/—/— | raw cast; add approved success decoder | `{ 422: [NOT_A_CITIZEN] }` | [field.walk-in](../ui-surfaces/field.walk-in.json); apply common proof matrix |
| `listMyApplications` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.applications](../ui-surfaces/citizen.applications.json); apply common proof matrix |
| `submitMyApplication` | Y/Y/— | raw cast; add approved success decoder | not supplied | [citizen.apply](../ui-surfaces/citizen.apply.json); apply common proof matrix |
| `getMyExamInvitation` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.exam-pass](../ui-surfaces/citizen.exam-pass.json); apply common proof matrix |
| `getMyDocumentChecklist` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.documents](../ui-surfaces/citizen.documents.json); apply common proof matrix |
| `getMyIdentity` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.apply](../ui-surfaces/citizen.apply.json); apply common proof matrix |
| `attachMyClearanceCertificate` | —/—/— | raw cast; add approved success decoder | `{ 409: [APPLICATION_CLOSED], 422: [CLEARANCE_NUMBER_MALFORMED] }` | [citizen.documents](../ui-surfaces/citizen.documents.json); apply common proof matrix |
| `getDocumentChecklist` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.application-workspace](../ui-surfaces/officer.application-workspace.json); apply common proof matrix |
| `verifyDocumentAtVenue` | —/—/— | raw cast; add approved success decoder | `{ 409: [NOT_APPLICABLE], 422: [UNSUPPORTED_DOCUMENT_TYPE, NOT_REQUIRED] }` | no surface test anchor identified; apply common proof matrix |
| `uploadMyDocument` | —/—/— | raw cast; add approved success decoder | not supplied | no surface test anchor identified; apply common proof matrix |
| `withdrawMyApplication` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.withdraw](../ui-surfaces/citizen.withdraw.json); apply common proof matrix |
| `getMyErasureRequest` | —/—/— | raw cast; add approved success decoder | not supplied | no surface test anchor identified; apply common proof matrix |
| `fileMyErasureRequest` | —/—/— | raw cast; add approved success decoder | not supplied | no surface test anchor identified; apply common proof matrix |
| `enrollFieldDevice` | —/—/— | raw cast; add approved success decoder | ∅ | [field.setup](../ui-surfaces/field.setup.json); apply common proof matrix |
| `syncFieldScores` | —/—/— | partial: ledger per-record / conflict parser; closed reasons and malformed cases needed | ∅ | [field.physical](../ui-surfaces/field.physical.json), [field.supervisor](../ui-surfaces/field.supervisor.json); apply common proof matrix |
| `resolveFieldSyncConflict` | —/—/— | partial: ledger per-record / conflict parser; closed reasons and malformed cases needed | `{ 409: [NO_CONFLICT] }` | [field.conflicts](../ui-surfaces/field.conflicts.json); apply common proof matrix |
| `listOfficers` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.dashboard](../ui-surfaces/officer.dashboard.json), [officer.staff](../ui-surfaces/officer.staff.json); apply common proof matrix |
| `createOfficer` | —/—/— | raw cast; add approved success decoder | `{ 409: [HANDLE_TAKEN], 422: [INVALID_HANDLE, INVALID_POSTS, UNKNOWN_POST] }` | [officer.staff](../ui-surfaces/officer.staff.json); apply common proof matrix |
| `releaseOfficerActivation` | —/—/— | raw cast; add approved success decoder | `{ 409: [NOT_PENDING_ACTIVATION, ALREADY_RELEASED, ACTIVATION_EXPIRED] }` | no surface test anchor identified; apply common proof matrix |
| `reissueOfficerActivation` | —/—/— | raw cast; add approved success decoder | `{ 409: [NOT_PENDING_ACTIVATION] }` | [officer.staff](../ui-surfaces/officer.staff.json); apply common proof matrix |
| `assignOfficerPosts` | —/—/— | raw cast; add approved success decoder | `{ 422: [INVALID_POSTS, UNKNOWN_POST, INVALID_REASON] }` | [officer.staff](../ui-surfaces/officer.staff.json); apply common proof matrix |
| `disableOfficer` | —/—/— | raw cast; add approved success decoder | `{ 409: [LAST_ACTIVE_ADMIN], 422: [INVALID_REASON] }` | [officer.staff](../ui-surfaces/officer.staff.json); apply common proof matrix |
| `enableOfficer` | —/—/— | raw cast; add approved success decoder | `{ 422: [INVALID_REASON] }` | [officer.staff](../ui-surfaces/officer.staff.json); apply common proof matrix |
| `revokeOfficerSessions` | —/—/— | raw cast; add approved success decoder | `{ 422: [INVALID_REASON] }` | [officer.staff](../ui-surfaces/officer.staff.json); apply common proof matrix |
| `activateOfficer` | —/—/— | raw cast; add approved success decoder | not supplied | [officer.activate](../ui-surfaces/officer.activate.json); apply common proof matrix |
| `listAgencyCampaigns` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json), [officer.dashboard](../ui-surfaces/officer.dashboard.json); apply common proof matrix |
| `getCampaignAdminDetail` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.campaign-studio](../ui-surfaces/officer.campaign-studio.json); apply common proof matrix |
| `searchApplications` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.amber-queue](../ui-surfaces/officer.amber-queue.json), [officer.application-workspace](../ui-surfaces/officer.application-workspace.json), [officer.dashboard](../ui-surfaces/officer.dashboard.json); apply common proof matrix |
| `getVenueRoster` | —/—/— | raw cast; add approved success decoder | ∅ | [field.setup](../ui-surfaces/field.setup.json); apply common proof matrix |
| `getVenueLiveCounts` | —/—/— | raw cast; add approved success decoder | ∅ | [field.supervisor](../ui-surfaces/field.supervisor.json); apply common proof matrix |
| `listFieldDevices` | —/—/— | raw cast; add approved success decoder | ∅ | [field.supervisor](../ui-surfaces/field.supervisor.json), [officer.dashboard](../ui-surfaces/officer.dashboard.json); apply common proof matrix |
| `assignDeviceToVenueDay` | —/—/— | no wrapper/decoder found; decide consumer scope | `{ 409: [DEVICE_REVOKED] }` | no surface test anchor identified; apply common proof matrix |
| `revokeFieldDevice` | —/—/— | no wrapper/decoder found; decide consumer scope | ∅ | no surface test anchor identified; apply common proof matrix |
| `listErasureRequests` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.erasure-queue](../ui-surfaces/officer.erasure-queue.json); apply common proof matrix |
| `getBiometricPolicy` | —/—/— | raw cast; add approved success decoder | ∅ | [field.check-in](../ui-surfaces/field.check-in.json); apply common proof matrix |
| `recordBiometricEvidence` | —/—/— | no wrapper/decoder found; decide consumer scope | `{ 409: [REPLAY_CONFLICT, BIOMETRIC_OFF, MODE_MISMATCH], 422: [INVALID_EVIDENCE] }` | no surface test anchor identified; apply common proof matrix |
| `getBiometricEvidence` | —/—/— | raw cast; add approved success decoder | ∅ | [officer.application-workspace](../ui-surfaces/officer.application-workspace.json); apply common proof matrix |
| `confirmManualIdentity` | —/—/— | no wrapper/decoder found; decide consumer scope | `{ 409: [NOT_REQUIRED, ALREADY_CONFIRMED, SAME_OFFICER] }` | no surface test anchor identified; apply common proof matrix |
| `decideErasureRequest` | —/—/— | raw cast; add approved success decoder | `{ 409: [NOT_PENDING, REFUSED_ACTIVE_APPLICATION, REFUSED_ACCEPT_LOCKED] }` | [officer.erasure-queue](../ui-surfaces/officer.erasure-queue.json); apply common proof matrix |
| `readSession` | —/—/— | raw cast; add approved success decoder | not supplied | [citizen.sign-in](../ui-surfaces/citizen.sign-in.json), [field.sign-in](../ui-surfaces/field.sign-in.json), [officer.sign-in](../ui-surfaces/officer.sign-in.json); apply common proof matrix |
| `refreshSession` | —/—/— | raw cast; add approved success decoder | not supplied | no surface test anchor identified; apply common proof matrix |

### Global findings and ownership

- **G1 (frontend contract/tooling):** all request schema dimensions are unvalidated at the shared transport; only 9 operations have request mappings in Gate E, only one has a response mapping, and only two have an explicit outcome mapping. The tool reports notes rather than failing on missing mappings. Extend coverage against the eventual approved packet, with selftests showing a missing map and mismatched revision fail. Also test permission/CSRF/any-of and actual error normalization; do not call a textual checker complete parity.
- **G2 (frontend API):** `decode.ts` decoders are not used at current production call sites, while `transport.ts` returns `parsed as T`; decide an approved per-operation decoder boundary and add malformed/unknown-field/replay fixtures. Campaign and auth/field special cases need full review, not replacement by a generic permissive decoder.
- **G3 (backend edge + frontend client/security):** `requestOtp` is POST and has `retryOnG2G: true` in both inspected registries; generic api-client retry follows that bit for named G2G 503s. The actively used `@usrp/auth` edge client sends directly and does not invoke that retry helper; do not claim it already repeats. The exported api-client wrapper can use the generic path. AGENTS.md forbids automatic state-changing retries; authority must decide a safe, consistent contract and backend/FE align it. See red repro below.
- **G4 (backend + frontend):** submit edge controller requires `campaignCode`; Gate E reports the inspection-target edge OpenAPI missing it and downgrades it under `KNOWN_DIVERGENCES`. Backend must reconcile the schema with the mounted implementation, then the FE proof must remove or revalidate the exception.
- **G5 (integration authority):** role-permission ratification, exact release SHA, source-reconciled packet, access policies and live test environments are pending. An edge permission listed in the table is observed engineering behavior, not agency approval.


## C. Handoff reconciliation: exact seams and owners

These conclusions describe source at the **inspection target**, not an approved future contract. The following corrects the earlier baseline note where it implied the review-lock code necessarily reaches the browser.

### D8 / D7 — the browser door drops the new contract

1. Forensics [upload controller](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/document-forensics-service/src/adapters/http/upload-document.controller.ts) sends `201` with `revision`; its `REVIEW_CLOSED` maps to `DOCUMENT_REVIEW_CLOSED` with the closed reason. The [D8 handoff](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/docs/program/handoffs/D8-document-revision.md) describes these as citizen outcomes.
2. Identity's [HTTP gateway](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/document-upload.http-gateway.ts) rebuilds `UPLOADED` without revision and rebuilds `REFUSED` without reason. Its [controller](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/identity-service/src/adapters/http/applicant-documents.controller.ts) likewise returns only status/id/type on success and error code on refusal.
3. The edge [citizen upload handler](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/citizen.controller.ts) independently rebuilds success without revision. Its hard-coded 4xx `SAFE` set omits `DOCUMENT_REVIEW_CLOSED`; an identity 409 with that code becomes **502 `UPSTREAM_CONTRACT_MISMATCH`**, not the 409 claimed by the handoff. It similarly omits other D7 vocabulary entries; the shared identity/forensics vocabulary alone does not establish browser-door coverage.
4. The handoff claims a revision trail in officer detail; targeted searches of application-read and edge projections found no `revision`/`document_revisions` field. Treat trail availability as **unverified/likely missing**, not proof of absence across every possible operation. `revision` alone also cannot identify an identical retry without an authoritative comparison.

**Backend owners: document-forensics + identity + edge.** Add an edge-level red test covering every approved closed document-door outcome through the whole chain (including the inspected upstream 409 lock without assuming its public mapping), validate and safely propagate revision and any approved reason, align OpenAPI and regenerate the packet; document whether/how revision history is read. **DPO/recruitment owner:** decide retention, erasure/object deletion and an actionable reviewed-document correction process; `document.reopen` is not shipped. **Frontend owner:** after approved contract, update upload schema/types/decoder and refusal vocabulary, safe copy in three languages, success/replacement/uncertainty states, tests for lock, replay, forbidden fields, no HMAC/forensic leakage and no automatic retry. The permanent citizen document page currently is not the generic upload consumer: [`apps/applicant-portal/src/routes/apply/index.tsx`](../../apps/applicant-portal/src/routes/apply/index.tsx) uses `useUploadMyDocument`, yet its `citizen.apply` manifest does not list `uploadMyDocument`. Treat that omission as an FE inventory/manifest defect, not a reason to build a new upload screen.

### D10 — lane contract exists; edge erases separation rule

The [D10 handoff](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/docs/program/handoffs/D10-vetting-hold-screen.md) correctly identifies one adjudication verb and `heldLanes`. The edge [controller](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/officer-transitions.controller.ts) validates/forwards optional lane; the [queue projection](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/projections.ts) includes `heldLanes`. The frontend `wire.ts` and `decodeAmberQueue` omit them; the status-only model says registry holds are non-actionable. Even the unused decoder drops the lanes (reproducer below).

The repository [transaction](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/officer-transition.pg-repository.ts) returns `NOT_APPLICABLE` with held lanes both when an omitted lane is ambiguous **and when a supplied lane is not held**. The edge [outcome mapper](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/adapters/http/outcomes.ts) maps any such non-empty lane list to `409 ADJUDICATION_LANE_REQUIRED`; the code alone does not establish which case happened. An empty list maps to `ILLEGAL_TRANSITION`. Re-read authoritative state and do not claim a specific race unless proven.

More importantly, application-service's [transition controller](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/adapters/http/officer-transitions.controller.ts) returns `403 {status:'SEPARATION_OF_DUTIES', rule:'ACCEPT_EXCLUDES_CLEARANCE_REVIEWER'}` for the relevant condition, but edge `transitionResult` maps **all** upstream 403s to bare `FORBIDDEN`. Thus the handoff's instruction to display the specific second-officer message is not supported by the current browser response. Frontend `normaliseErrorBody` also discards a 403 `rule`. Backend must decide whether and how an allowlisted safe rule is exposed; frontend must not infer it from a generic 403. Other SoD rules also need consideration, not just clearance.

**Backend owner:** reconcile 403 projection, lane-refusal semantics, OpenAPI and handoff, prove per-rule disclosure and no agency leak. **Frontend owner:** after packet, add lane types/strict decode and lane-specific actions based on server `heldLanes`; re-read after conflict, use only actually exposed SoD feedback, invalidate/refetch without inventing lifecycle transitions. Test 0/1/multiple lanes, invalid/stale lane, concurrent officers, both clearance resolver members, independent accepter, automated replay and permission/agency negatives. Keep one adjudicate operation.

### D11 — signed actor and per-record response

The [D11 handoff](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/docs/program/handoffs/D11-field-score-sync-state.md) says `/edge/v1/field-scores/sync`; the mounted registry and frontend use **`/edge/v1/field-sync/scores`**. Treat the handoff path as stale for this inspection target, not an approved route for a future revision. The edge validates UUID shape, forwards the signed actor, and forwards per-record results after the leak guard; [field-sync service](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/field-sync-service/src/application/sync-field-scores.service.ts) checks device/agency/signature first, then compares capturing officer with verified `actorSubjectId` and audits `OFFICER_MISMATCH`. The [session view](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/edge-gateway/src/domain/session.types.ts) exposes no officer subject.

The production physical route signs `stationActorId()` from local storage, not authenticated officer metadata. `KNOWN_REJECT_REASONS` omits `OFFICER_MISMATCH`; ledger's `readSyncResponse` allows an arbitrary string reason. Existing per-record mapping helps prevent a bare 200 being marked successful, but does not establish a closed actor-specific recovery experience. A real enrolled-device signature with a different valid subject is needed to test actor binding; a bad signature is rejected first and proves a different condition.

**Backend edge/IAM + integration authority:** approve/ship a safe officer-only subject projection, no credentials or private key, and update route/response packet and audit evidence. **Frontend auth/field owner:** only after approval, require valid session subject when capturing, remove locally fabricated identity, fail closed on logout/session switch, define disposition of old local records without rewriting attribution, handle mismatch as supervisor recovery, validate every result and preserve batch pairing/uncertainty. **Offline programme owner:** separately model original capture identity versus later upload authority before enabling S15; `OFFLINE_CAPTURE_CAN_SYNC` stays false. Test valid same/different subject, applicant/no subject, revoked device, cross-agency, mixed batch, per-record no-write/audit and live edge → field-service → projection.

### Walk-in — opaque code cannot supply slot claims

[Walk-in service](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/application-service/src/application/walk-in.service.ts) mints a random base64url `qrInvitationCode`; edge returns it and the current Field Station shows it. [`ticketFromToken`](../../packages/features/field-ops/src/model/ticket.ts) requires a structured `USRP-SLOT.v1` and derives application, agency, venue, day and ticket ID. The local ledger records the decoded ticket ID, not the full token. The [score store](https://github.com/Jackson-NSANZIMANA/e-recruitment/blob/e887c768989acd2bca9824a15e8f6d0fab50178c/services/field-sync-service/src/adapters/field-score-store.pg.ts) compares the presented `qrInvitationCode` to the stored issued code under lock; for non-walk-ins it additionally requires gate admission. That comparison is not full signed-token verification. Walk-ins have distinct admission semantics and null venue assignment under ADR-012; no client-side decoding turns the opaque code into the missing context.

**Backend + recruitment/security authorities:** decide signed or otherwise server-verifiable credential semantics, issuer/key, context, expiration/supersession, RDF-only enforcement, walk-in admission and score acceptance, and how venue/day is established without fabricating a reservation; implement the decision and handoff. **Frontend field owner:** after that contract, consume and display only the approved credential, avoid bearer logging/storage, and prove registration → vetting → presentation → physical score → lifecycle against the real edge; reject malformed, altered, expired, wrong agency/venue/day and superseded passes. Test scheduled invitation regression and RNP/RCS rejection. The parser safety assertion below correctly requires an opaque code to be rejected by the structured parser. This does not establish any approved walk-in credential format or a working journey.

## D. Prepared reproductions and safety check (documentation only)

The D10, D11, G3 and G2 examples are deliberately failing assertions against frontend `2b9fe322` with Node `v24.22.2` / pnpm `9.15.0` after the frozen install; each exited **1** independently. The final walk-in safety assertion is intentionally passing and exited **0**. These do not approve a future wire shape or prove live backend behavior. Set `ROOT` to your own checkout. Convert expected-red assertions to checked-in tests only in the approved implementation package; this PR stays documentation-only.

```bash
export ROOT="$(pwd)"
# D10: current decode drops the held lanes observed in the edge projection.
pnpm --filter @usrp/contracts exec tsx -e "import assert from 'node:assert/strict'; import { decodeAmberQueue } from '$ROOT/packages/api-client/src/decode.ts'; assert.deepEqual((decodeAmberQueue([{applicationId:'11111111-1111-4111-8111-111111111111',status:'DOCUMENT_REVIEW_AMBER',heldLanes:['DOCUMENT','CRIMINAL']}],'RDF')[0] as any).heldLanes,['DOCUMENT','CRIMINAL']);"

# D11: the inspector's backend rejection is not a known field UI reason.
pnpm --filter @usrp/contracts exec tsx -e "import assert from 'node:assert/strict'; import { isKnownRejectReason } from '$ROOT/packages/features/field-ops/src/model/field-sync.ts'; assert.equal(isKnownRejectReason('OFFICER_MISMATCH'),true);"

# G3: generic api-client permits retry of a POST despite AGENTS.md's invariant.
pnpm --filter @usrp/contracts exec tsx -e "import assert from 'node:assert/strict'; import { operation } from '$ROOT/packages/api-client/src/paths.ts'; assert.equal(operation('requestOtp').retryOnG2G,false);"
# Runtime path: mocked 503 produces three POST attempts instead of one; this
# exercises the exported api-client wrapper, not the separate auth client.
pnpm --filter @usrp/contracts exec tsx -e "import assert from 'node:assert/strict'; import { createApiClient } from '$ROOT/packages/api-client/src/transport.ts'; import { requestOtp } from '$ROOT/packages/api-client/src/operations/session.ts'; (async()=>{let n=0; const client=createApiClient({baseUrl:'https://example.invalid',fetchImpl:async()=>{n++;return new Response(JSON.stringify({error:'NIDA_UNAVAILABLE'}),{status:503})},retryPolicy:{maxRetries:2,baseDelayMs:0,maxDelayMs:0,sleep:async()=>{}}}); try{await requestOtp(client,{onboardingToken:'synthetic',phoneNumber:'synthetic'});}catch{}; console.log('fetch calls:',n); assert.equal(n,1);})().catch(e=>{console.error(e.message);process.exitCode=1});"

# G2: a malformed 200 is accepted by a real wrapper using the generic transport.
pnpm --filter @usrp/contracts exec tsx -e "import assert from 'node:assert/strict'; import { createApiClient } from '$ROOT/packages/api-client/src/transport.ts'; import { listFieldDevices } from '$ROOT/packages/api-client/src/operations/admin-reads.ts'; (async()=>{const client=createApiClient({baseUrl:'https://example.invalid',fetchImpl:async()=>new Response(JSON.stringify({wrong:true}),{status:200})}); await assert.rejects(()=>listFieldDevices(client));})().catch(e=>{console.error(e.message);process.exitCode=1});"

# Walk-in safety (expected PASS): an opaque code has no structured slot claims.
pnpm --filter @usrp/contracts exec tsx -e "import assert from 'node:assert/strict'; import { ticketFromToken } from '$ROOT/packages/features/field-ops/src/model/ticket.ts'; assert.equal(ticketFromToken('wuwBIU4ZMEYyYD0uEDQd5POnlC8ZZjQ-M_ygwxCprPg'),null);"
```

The D10 decoder reproducer tests a currently unused pure decoder; it proves field loss there, **not** that the active UI calls that decoder. A later scratch component/query/mutation probe is described in the [remediation plan](./frontend-cross-stack-remediation-plan-2026-11-01.md); production browser tests remain proposed and conditional on the approved packet. For D8, the strongest required red test is a backend integration fixture feeding `DOCUMENT_REVIEW_CLOSED` through identity and edge and expecting the **approved** citizen outcome: it is not run here, and the desired 409 must not be encoded as approved before authority reconciliation. For D10 SoD, add an edge test with upstream 403 rule and expected approved projection; current inspected code demonstrably strips it. The live signed D11 and walk-in tests require backend dependencies and are not claimed run.

The opaque-code assertion above was rerun as a **passing safety check** on 2026-11-01; the previous expected-red assertion was incorrect and is superseded. The future end-to-end walk-in credential test must use only the subsequently approved contract and must not assume a token format. See the [remediation plan](./frontend-cross-stack-remediation-plan-2026-11-01.md) for test scope and evidence limits.

## E. Exit and ownership

| Blocker | Owner | Next reviewable deliverable |
|---|---|---|
| Approved immutable backend SHA and packet | Integration authority / release owner | Confirm SHA and publish source-reconciled FE-P0 packet, including permission, full schemas, outcomes, idempotency, id aliases, exclusions and proof references. |
| Contract / request / response / outcome / permission coverage for all 68 | Frontend contract tooling + backend edge | Review the matrices above against actual consumer chains, backend controllers and packet; add fail-closed parity coverage and all missing negative tests. Surface-only operation claims and OpenAPI metadata remain **unverified**, not proven complete. |
| D8/D7 browser upload relay and correction | Backend identity/forensics/edge; DPO/recruitment; frontend applicant | Fix and prove end-to-end relay + decide correction/retention; then implement approved frontend decoder/copy and manifest coverage. |
| D10 four-eyes projection and lane behavior | Backend application/edge; frontend adjudication | Agree safe 403 and invalid-lane semantics; prove transaction and edge, then add lane-specific FE handling. |
| D11 session actor and old local captures | Backend edge/IAM/field; frontend auth/field; security | Agree subject projection and historic record disposition; prove identity and per-record audit before claiming scoring works. |
| Walk-in credential | Backend application/field, recruitment operations, security; frontend field | Approve credential/venue/admission model; implement backend validation and then FE parser/physical journey. |
| Retry policy on `requestOtp` | Frontend transport/security + backend edge | Resolve declared POST retry against immutable frontend rule and test actual consumers; no silent retry change. |
| E2E, a11y, security, deployed/live stack evidence | CI/release + respective owners | Re-run on exact PR and approved backend revisions; reproduce live journeys and collect signed evidence. |

This document inventories all declared operations but does **not** assert that every outcome and test is exhaustively proven: current OpenAPI, stale handoffs, manifest assertions and static searches cannot establish that. Missing detailed per-operation proof remains explicitly open until the packet and full controller/consumer review are completed. FE-P0 remains open and PR #49 stays draft.

## F. Consumer and test cross-reference (textual inventory)

For each registry ID, this supplementary index searches production source and test/selfcheck filenames for the ID, wrapper alias and a conventional `use…` hook name. A hit may be an import, re-export, fixture or generic assertion, **not** an executed call or proof of a particular outcome. `—` means this limited search found no hit; aliases, dynamic dispatch, tests named by a surface manifest, and indirect calls can be missed. Every row needs the common proof matrix in §B and manual call-chain verification. The F-source and surface references in §A remain the primary links.

| Operation | Candidate consumer refs | Candidate test refs |
|---|---|---|
| `officerLogin` | R64, R30, R31 | R16, R29, R35, R71 |
| `officerLogout` | R30, R31 | R16, R71 |
| `beginApplicantOnboarding` | R65, R30, R31 | R1, R14, R29, R35, R71 |
| `listCampaigns` | R4, R43, R22 | R14, R35, R72 |
| `getCampaignDetail` | R4, R43, R22 | R14, R35 |
| `createCampaign` | R43, R48, R21 | R14, R72 |
| `createCampaignPolicy` | R43, R49, R21 | — |
| `configureCampaignSession` | R43, R51, R21 | — |
| `publishCampaign` | R43, R45, R47, R50, R21 | R14, R44 |
| `closeCampaignRegistration` | R43, R45, R46, R47, R21 | R44 |
| `completeCampaign` | R43, R45, R46, R47, R21 | R44 |
| `cancelCampaign` | R43, R45, R46, R47, R21 | R14, R44 |
| `requestOtp` | R30, R31 | R29, R71 |
| `verifyOtp` | R64, R30, R31 | R29, R71 |
| `applicantLogout` | R30, R31 | R71 |
| `listApplications` | R39, R20 | R15, R35 |
| `listAmberQueue` | R36, R39, R20 | R15 |
| `findApplicationById` | R39, R20 | R15 |
| `getStatusHistory` | R39, R20 | — |
| `getApplicationDetail` | R39, R20 | — |
| `recordMedicalReview` | R37, R39, R41, R59, R20 | R14 |
| `recordFinalDecision` | R37, R38, R39, R41, R20 | R14 |
| `acceptApplication` | R37, R38, R39, R41, R20 | R14 |
| `adjudicateApplication` | R37, R38, R39, R41, R20 | R14 |
| `registerWalkIn` | R39, R53, R63, R69, R20 | R14 |
| `vetWalkIn` | R39, R53, R63, R20 | — |
| `admitAtGate` | R58, R25 | R7, R14 |
| `verifyIdentity` | R64, R39, R53, R63, R20 | R14 |
| `listMyApplications` | R19 | R15, R35 |
| `submitMyApplication` | R6, R4, R19 | R14 |
| `getMyExamInvitation` | R24 | R14 |
| `getMyDocumentChecklist` | R23 | R14 |
| `getMyIdentity` | R26 | R2 |
| `attachMyClearanceCertificate` | R5, R23 | R2 |
| `getDocumentChecklist` | R23 | R14 |
| `verifyDocumentAtVenue` | R23 | R14 |
| `uploadMyDocument` | R4, R19 | R14 |
| `withdrawMyApplication` | R52, R19 | — |
| `getMyErasureRequest` | R52, R19 | — |
| `fileMyErasureRequest` | R52, R19 | — |
| `enrollFieldDevice` | R61 | — |
| `syncFieldScores` | R54, R60, R62 | R70 |
| `resolveFieldSyncConflict` | R57 | R70 |
| `listOfficers` | R28 | R17 |
| `createOfficer` | R68, R28 | R17 |
| `releaseOfficerActivation` | R28 | R10, R17 |
| `reissueOfficerActivation` | R28 | R17 |
| `assignOfficerPosts` | R28 | R17 |
| `disableOfficer` | R68, R28 | R17 |
| `enableOfficer` | R68, R28 | R17 |
| `revokeOfficerSessions` | R28 | R17 |
| `activateOfficer` | R67 | R17 |
| `listAgencyCampaigns` | R18 | — |
| `getCampaignAdminDetail` | R18 | — |
| `searchApplications` | R11, R13, R38, R40, R42, R27 | R17 |
| `getVenueRoster` | R55, R61 | — |
| `getVenueLiveCounts` | R62 | — |
| `listFieldDevices` | R62, R18 | — |
| `assignDeviceToVenueDay` | — | — |
| `revokeFieldDevice` | — | — |
| `listErasureRequests` | R52, R27 | R17 |
| `getBiometricPolicy` | R56 | — |
| `recordBiometricEvidence` | — | — |
| `getBiometricEvidence` | R27 | R17 |
| `confirmManualIdentity` | — | — |
| `decideErasureRequest` | R27 | R17 |
| `readSession` | R3, R6, R9, R8, R12, R64, R66, R30, R32, R31, R33 | R16, R29, R71, R72 |
| `refreshSession` | R30, R31, R33, R34 | R16, R29, R71 |

### Reference key

- **R1**: [`apps/applicant-portal/e2e/citizen-journey.spec.ts`](../../apps/applicant-portal/e2e/citizen-journey.spec.ts)
- **R2**: [`apps/applicant-portal/e2e/s12c-screens.spec.ts`](../../apps/applicant-portal/e2e/s12c-screens.spec.ts)
- **R3**: [`apps/applicant-portal/src/main.tsx`](../../apps/applicant-portal/src/main.tsx)
- **R4**: [`apps/applicant-portal/src/routes/apply/index.tsx`](../../apps/applicant-portal/src/routes/apply/index.tsx)
- **R5**: [`apps/applicant-portal/src/routes/documents/index.tsx`](../../apps/applicant-portal/src/routes/documents/index.tsx)
- **R6**: [`apps/applicant-portal/src/routes/home.tsx`](../../apps/applicant-portal/src/routes/home.tsx)
- **R7**: [`apps/field-station/e2e/live-field-journey.spec.ts`](../../apps/field-station/e2e/live-field-journey.spec.ts)
- **R8**: [`apps/field-station/src/components/StationShell/index.tsx`](../../apps/field-station/src/components/StationShell/index.tsx)
- **R9**: [`apps/field-station/src/main.tsx`](../../apps/field-station/src/main.tsx)
- **R10**: [`apps/officer-console/e2e/staff-admin.spec.ts`](../../apps/officer-console/e2e/staff-admin.spec.ts)
- **R11**: [`apps/officer-console/src/dashboard/panels.tsx`](../../apps/officer-console/src/dashboard/panels.tsx)
- **R12**: [`apps/officer-console/src/main.tsx`](../../apps/officer-console/src/main.tsx)
- **R13**: [`apps/officer-console/src/routes/dashboard.tsx`](../../apps/officer-console/src/routes/dashboard.tsx)
- **R14**: [`packages/api-client/selfcheck/verify-api-client.ts`](../../packages/api-client/selfcheck/verify-api-client.ts)
- **R15**: [`packages/api-client/selfcheck/verify-decode.ts`](../../packages/api-client/selfcheck/verify-decode.ts)
- **R16**: [`packages/api-client/selfcheck/verify-edge-registry.ts`](../../packages/api-client/selfcheck/verify-edge-registry.ts)
- **R17**: [`packages/api-client/selfcheck/verify-staff-ops.ts`](../../packages/api-client/selfcheck/verify-staff-ops.ts)
- **R18**: [`packages/api-client/src/queries/admin.ts`](../../packages/api-client/src/queries/admin.ts)
- **R19**: [`packages/api-client/src/queries/applicant.ts`](../../packages/api-client/src/queries/applicant.ts)
- **R20**: [`packages/api-client/src/queries/applications.ts`](../../packages/api-client/src/queries/applications.ts)
- **R21**: [`packages/api-client/src/queries/campaign-control.ts`](../../packages/api-client/src/queries/campaign-control.ts)
- **R22**: [`packages/api-client/src/queries/campaigns.ts`](../../packages/api-client/src/queries/campaigns.ts)
- **R23**: [`packages/api-client/src/queries/documents.ts`](../../packages/api-client/src/queries/documents.ts)
- **R24**: [`packages/api-client/src/queries/exam-invitation.ts`](../../packages/api-client/src/queries/exam-invitation.ts)
- **R25**: [`packages/api-client/src/queries/gate.ts`](../../packages/api-client/src/queries/gate.ts)
- **R26**: [`packages/api-client/src/queries/identity.ts`](../../packages/api-client/src/queries/identity.ts)
- **R27**: [`packages/api-client/src/queries/ops.ts`](../../packages/api-client/src/queries/ops.ts)
- **R28**: [`packages/api-client/src/queries/staff.ts`](../../packages/api-client/src/queries/staff.ts)
- **R29**: [`packages/auth/selfcheck/verify-auth.ts`](../../packages/auth/selfcheck/verify-auth.ts)
- **R30**: [`packages/auth/src/context.tsx`](../../packages/auth/src/context.tsx)
- **R31**: [`packages/auth/src/edge-client.ts`](../../packages/auth/src/edge-client.ts)
- **R32**: [`packages/auth/src/guards.tsx`](../../packages/auth/src/guards.tsx)
- **R33**: [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts)
- **R34**: [`packages/auth/src/refresh.ts`](../../packages/auth/src/refresh.ts)
- **R35**: [`packages/contracts/test/route-invariants.test.ts`](../../packages/contracts/test/route-invariants.test.ts)
- **R36**: [`packages/features/adjudication/src/api/adjudication.ts`](../../packages/features/adjudication/src/api/adjudication.ts)
- **R37**: [`packages/features/adjudication/src/model/transitions.ts`](../../packages/features/adjudication/src/model/transitions.ts)
- **R38**: [`packages/features/adjudication/src/ui/QueuesPage.tsx`](../../packages/features/adjudication/src/ui/QueuesPage.tsx)
- **R39**: [`packages/features/applications/src/api/applications.ts`](../../packages/features/applications/src/api/applications.ts)
- **R40**: [`packages/features/applications/src/model/workspace.ts`](../../packages/features/applications/src/model/workspace.ts)
- **R41**: [`packages/features/applications/src/ui/ActionPanels.tsx`](../../packages/features/applications/src/ui/ActionPanels.tsx)
- **R42**: [`packages/features/applications/src/ui/ApplicationsPage.tsx`](../../packages/features/applications/src/ui/ApplicationsPage.tsx)
- **R43**: [`packages/features/campaigns/src/api/campaigns.ts`](../../packages/features/campaigns/src/api/campaigns.ts)
- **R44**: [`packages/features/campaigns/src/model/campaigns.test.ts`](../../packages/features/campaigns/src/model/campaigns.test.ts)
- **R45**: [`packages/features/campaigns/src/model/lifecycle.ts`](../../packages/features/campaigns/src/model/lifecycle.ts)
- **R46**: [`packages/features/campaigns/src/ui/CampaignStudioPage.tsx`](../../packages/features/campaigns/src/ui/CampaignStudioPage.tsx)
- **R47**: [`packages/features/campaigns/src/ui/LifecycleStep.tsx`](../../packages/features/campaigns/src/ui/LifecycleStep.tsx)
- **R48**: [`packages/features/campaigns/src/ui/NewCampaignPage.tsx`](../../packages/features/campaigns/src/ui/NewCampaignPage.tsx)
- **R49**: [`packages/features/campaigns/src/ui/PolicyStep.tsx`](../../packages/features/campaigns/src/ui/PolicyStep.tsx)
- **R50**: [`packages/features/campaigns/src/ui/PublishStep.tsx`](../../packages/features/campaigns/src/ui/PublishStep.tsx)
- **R51**: [`packages/features/campaigns/src/ui/SessionsStep.tsx`](../../packages/features/campaigns/src/ui/SessionsStep.tsx)
- **R52**: [`packages/features/compliance/src/api/compliance.ts`](../../packages/features/compliance/src/api/compliance.ts)
- **R53**: [`packages/features/field-ops/src/api/field-ops.ts`](../../packages/features/field-ops/src/api/field-ops.ts)
- **R54**: [`packages/features/field-ops/src/model/field-sync.ts`](../../packages/features/field-ops/src/model/field-sync.ts)
- **R55**: [`packages/features/field-ops/src/model/venue.ts`](../../packages/features/field-ops/src/model/venue.ts)
- **R56**: [`packages/features/field-ops/src/routes/check-in.tsx`](../../packages/features/field-ops/src/routes/check-in.tsx)
- **R57**: [`packages/features/field-ops/src/routes/conflicts.tsx`](../../packages/features/field-ops/src/routes/conflicts.tsx)
- **R58**: [`packages/features/field-ops/src/routes/gate.tsx`](../../packages/features/field-ops/src/routes/gate.tsx)
- **R59**: [`packages/features/field-ops/src/routes/medical.tsx`](../../packages/features/field-ops/src/routes/medical.tsx)
- **R60**: [`packages/features/field-ops/src/routes/physical.tsx`](../../packages/features/field-ops/src/routes/physical.tsx)
- **R61**: [`packages/features/field-ops/src/routes/setup.tsx`](../../packages/features/field-ops/src/routes/setup.tsx)
- **R62**: [`packages/features/field-ops/src/routes/supervisor.tsx`](../../packages/features/field-ops/src/routes/supervisor.tsx)
- **R63**: [`packages/features/field-ops/src/routes/walk-in.tsx`](../../packages/features/field-ops/src/routes/walk-in.tsx)
- **R64**: [`packages/features/identity/src/api/identity.ts`](../../packages/features/identity/src/api/identity.ts)
- **R65**: [`packages/features/identity/src/routes/citizen-otp.tsx`](../../packages/features/identity/src/routes/citizen-otp.tsx)
- **R66**: [`packages/features/identity/src/routes/officer-login.tsx`](../../packages/features/identity/src/routes/officer-login.tsx)
- **R67**: [`packages/features/identity/src/ui/ActivatePage.tsx`](../../packages/features/identity/src/ui/ActivatePage.tsx)
- **R68**: [`packages/features/identity/src/ui/StaffPage.tsx`](../../packages/features/identity/src/ui/StaffPage.tsx)
- **R69**: [`packages/features/scheduling/src/api/scheduling.ts`](../../packages/features/scheduling/src/api/scheduling.ts)
- **R70**: [`packages/field-ledger/test/sync-mapping.test.ts`](../../packages/field-ledger/test/sync-mapping.test.ts)
- **R71**: [`packages/testing/auth/session-boot.test.tsx`](../../packages/testing/auth/session-boot.test.tsx)
- **R72**: [`tooling/ci/test/evidence-bundle.test.mjs`](../../tooling/ci/test/evidence-bundle.test.mjs)

## G. Outcome-code-specific handling candidates

The following 409/422 codes are declared by the inspection-target edge OpenAPI metadata, but an exact quoted code literal was not found anywhere in the scanned frontend production `.ts`/`.tsx` files (api-client, auth, field ledger, features and apps; tests excluded). This is a prioritization list, not proof of broken behavior: generic handling, computed keys or localization JSON may intentionally cover a code, and OpenAPI can itself be stale. Conversely a code literal found elsewhere does **not** prove the correct operation handles it. Inspect its UI, decoder and tests against the approved packet; no outcome on this list has an established operation-specific proof in this inventory. Other HTTP statuses, 2xx business unions and per-record outcomes need the same review, as §B states.

| Operation | Metadata codes without a matching quoted literal in scanned production TS |
|---|---|
| `createCampaign` | `IDEMPOTENCY_KEY_REUSED` |
| `createCampaignPolicy` | `IDEMPOTENCY_KEY_REUSED`, `INVALID_POLICY` |
| `configureCampaignSession` | `IDEMPOTENCY_KEY_REUSED`, `INVALID_SESSION_CONFIGURATION` |
| `publishCampaign` | `IDEMPOTENCY_KEY_REUSED` |
| `closeCampaignRegistration` | `IDEMPOTENCY_KEY_REUSED` |
| `completeCampaign` | `IDEMPOTENCY_KEY_REUSED` |
| `cancelCampaign` | `CANCELLATION_HAS_APPLICATIONS`, `IDEMPOTENCY_KEY_REUSED` |
| `recordMedicalReview` | `ILLEGAL_TRANSITION`, `INVALID_MEDICAL_INPUT` |
| `recordFinalDecision` | `ILLEGAL_TRANSITION` |
| `acceptApplication` | `ILLEGAL_TRANSITION` |
| `adjudicateApplication` | `ILLEGAL_TRANSITION`, `ADJUDICATION_LANE_REQUIRED` |
| `vetWalkIn` | `ILLEGAL_TRANSITION` |
| `verifyIdentity` | `NOT_A_CITIZEN` |
| `attachMyClearanceCertificate` | `APPLICATION_CLOSED`, `CLEARANCE_NUMBER_MALFORMED` |
| `verifyDocumentAtVenue` | `UNSUPPORTED_DOCUMENT_TYPE`, `NOT_REQUIRED` |
| `createOfficer` | `HANDLE_TAKEN`, `INVALID_HANDLE`, `INVALID_POSTS`, `UNKNOWN_POST` |
| `releaseOfficerActivation` | `NOT_PENDING_ACTIVATION`, `ALREADY_RELEASED`, `ACTIVATION_EXPIRED` |
| `reissueOfficerActivation` | `NOT_PENDING_ACTIVATION` |
| `assignOfficerPosts` | `INVALID_POSTS`, `UNKNOWN_POST`, `INVALID_REASON` |
| `disableOfficer` | `LAST_ACTIVE_ADMIN`, `INVALID_REASON` |
| `enableOfficer` | `INVALID_REASON` |
| `revokeOfficerSessions` | `INVALID_REASON` |
| `assignDeviceToVenueDay` | `DEVICE_REVOKED` |
| `recordBiometricEvidence` | `REPLAY_CONFLICT`, `BIOMETRIC_OFF`, `MODE_MISMATCH`, `INVALID_EVIDENCE` |
| `confirmManualIdentity` | `NOT_REQUIRED`, `ALREADY_CONFIRMED`, `SAME_OFFICER` |
