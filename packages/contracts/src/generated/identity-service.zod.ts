// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/identity-service.yaml                     ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  29f34aa53bc94b3ae246ca82fcad8310404afe98          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/identity-service.yaml instead.   ║
// ╚══════════════════════════════════════════════════════════════╝

//
// USRP identity-service
//
// Route table (method, path, auth kinds, reach):
//   POST /v1/identities/verify                          system|officer     service-internal
//   POST /v1/gate/admissions                            officer            browser
//   POST /v1/applicants/auth/onboarding/begin           none               browser
//   POST /v1/applicants/auth/otp/request                none               browser
//   POST /v1/applicants/auth/otp/verify                 none               browser
//   POST /v1/applicants/auth/logout                     applicant-session  browser
//   GET  /v1/applicants/me/applications                 applicant-session  browser
//   POST /v1/applicants/me/applications                 applicant-session  browser
//   GET  /v1/applicants/me/applications/exam-invitation applicant-session  browser
//   GET  /v1/applicants/me/applications/document-checklist applicant-session  browser
//   POST /v1/applicants/me/applications/documents       applicant-session  browser
//   POST /v1/applicants/me/applications/withdraw        applicant-session  browser
//   GET  /v1/applicants/me/erasure-request              applicant-session  browser
//   POST /v1/applicants/me/erasure-request              applicant-session  browser
//   POST /v1/identities/erasure                         officer            browser
//   GET  /v1/identities/erasure-requests                officer            browser
//   POST /v1/identities/erasure-requests/decline        officer            browser
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//
// `.strict()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

export const AgencySchema = z.enum(['RDF', 'RNP', 'RCS']);

export const AlreadyErasedOkSchema = z
  .object({
    "status": z.literal('ALREADY_ERASED'),
  }).strict();

/**
 * All 19 states. Per-agency legality is NOT expressible in OpenAPI — rnp_ops
 * and rcs_ops carry no WALK_IN_* values. Use StatusFor<Agency> from
 * src/agency.ts to constrain by agency at compile time.
 */
export const ApplicationStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'ACADEMIC_VETTING', 'CRIMINAL_CLEARANCE', 'DOCUMENT_REVIEW_GREEN', 'DOCUMENT_REVIEW_AMBER', 'SLOT_ASSIGNED', 'PHYSICAL_TEST_SCHEDULED', 'PHYSICAL_TEST_COMPLETE', 'MEDICAL_REVIEW', 'FINAL_SHORTLIST', 'ACCEPTED', 'ADJUDICATION_REVIEW', 'REJECTED', 'WITHDRAWN', 'WALK_IN_REGISTERED', 'WALK_IN_ON_SITE_VETTING', 'WALK_IN_PHYSICAL_TEST', 'WALK_IN_REJECTED']);

export const UuidSchema = z.string().uuid().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

/**
 * PROXIED from application-service GET /v1/applications/by-applicant. This
 * is that service's ApplicantApplicationSummary; the link is stated, not
 * re-derived, and the operation is marked proxy-derived because this pass
 * did not open adapters/applications.http-gateway.ts.
 */
export const ApplicantApplicationSummarySchema = z
  .object({
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "category": z.string(),
    "status": ApplicationStatusSchema,
    "submittedAt": z.string().nullable(),
    "agency": AgencySchema,
  }).strict();

export const ApplicantAuth400Schema = z
  .object({
    "error": z.enum(['INVALID_REQUEST', 'INVALID_CHANNEL', 'INVALID_NATIONAL_ID', 'INVALID_PHONE_NUMBER', 'INVALID_CAMPAIGN_CODE']),
    "detail": z.string().optional(),
  }).strict();

export const ApplicantAuthError500Schema = z
  .object({
    "error": z.enum(['PERSISTENCE_ERROR', 'INTERNAL_ERROR']),
  }).strict();

export const ApplicantSessionIssued200Schema = z
  .object({
    "sessionToken": z.string(),
    "expiresAt": z.string(),
  }).strict();

/**
 * REQUIRED on both verify and OTP request/verify. 400 INVALID_CHANNEL
 * otherwise. Source: APPLICATION_CHANNELS in backend shared-types.
 */
export const ApplicationChannelSchema = z.enum(['WEB', 'USSD', 'IREMBO_KIOSK', 'WALK_IN']);

export const DeclineErasureRequestSchema = z
  .object({
    "requestId": UuidSchema,
    "note": z.string().min(1).max(200),
  }).strict();

export const DocumentChecklistItemSchema = z
  .object({
    "documentType": z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    "satisfaction": z.enum(['API_VERIFIED', 'UPLOADED_CLEARED', 'VENUE_VERIFIED', 'AWAITING_REGISTRY', 'UNDER_REVIEW', 'REJECTED', 'MISSING']),
    "registry": z.string().nullable(),
  }).strict();

/**
 * ADVISORY (ADR-032): never a gate. Types, states and the verifying registry
 * only — no forensic score, flag, object key or officer id.
 */
export const DocumentChecklist200Schema = z
  .object({
    "agency": AgencySchema,
    "source": z.enum(['POLICY_VERSION', 'GROUND_TRUTH_TABLE']),
    "complete": z.boolean(),
    "items": z.array(DocumentChecklistItemSchema),
  }).strict();

export const DocumentUploaded201Schema = z
  .object({
    "status": z.literal('UPLOADED'),
    "documentId": z.string().uuid(),
    "documentType": z.string(),
  }).strict();

export const EraseIdentityRequestSchema = z
  .object({
    "applicantId": UuidSchema,
  }).strict();

export const ErasedOkSchema = z
  .object({
    "status": z.literal('ERASED'),
  }).strict();

export const EraseOk200Schema = z.discriminatedUnion('status', [
  ErasedOkSchema,
  AlreadyErasedOkSchema,
]);

export const RefusedAcceptLocked409Schema = z
  .object({
    "status": z.literal('REFUSED_ACCEPT_LOCKED'),
    "lockedByAgency": AgencySchema,
  }).strict();

export const RefusedActiveApplication409Schema = z
  .object({
    "status": z.literal('REFUSED_ACTIVE_APPLICATION'),
    "agency": AgencySchema,
    "currentStatus": ApplicationStatusSchema,
  }).strict();

export const EraseRefused409Schema = z.discriminatedUnion('status', [
  RefusedActiveApplication409Schema,
  RefusedAcceptLocked409Schema,
]);

export const ErasureDeclined200Schema = z
  .object({
    "status": z.literal('DECLINED'),
  }).strict();

export const ErasureNotFound404Schema = z
  .object({
    "status": z.literal('NOT_FOUND'),
  }).strict();

export const ErasureNotPending409Schema = z
  .object({
    "status": z.literal('NOT_PENDING'),
    "currentStatus": z.string(),
  }).strict();

export const ErasureQueueEntrySchema = z
  .object({
    "requestId": UuidSchema,
    "applicantId": UuidSchema,
    "requestedAt": z.string(),
  }).strict();

export const ErasureQueueOkSchema = z
  .object({
    "requests": z.array(ErasureQueueEntrySchema),
  }).strict();

export const ErasureRequestFiled202Schema = z
  .object({
    "status": z.literal('PENDING'),
    "requestId": UuidSchema,
  }).strict();

/**
 * Never filed. A normal state for almost every citizen.
 */
export const ErasureRequestNone404Schema = z
  .object({
    "status": z.literal('NONE'),
  }).strict();

/**
 * ADR-034. Present only in state ADMITTED: where and when the single-use QR
 * was spent. The QR itself is never sent again.
 */
export const ExamInvitationAdmissionSchema = z
  .object({
    "venueName": z.string(),
    "admittedAt": z.string(),
  }).strict();

export const ExamInvitationPayloadSchema = z
  .object({
    "qrPayload": z.string().max(4096).regex(/^USRP-SLOT\.v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
    "ticketId": z.string(),
    "venueName": z.string(),
    "examDate": z.string(),
    "reportingTimeHour": z.number(),
    "validUntil": z.string(),
  }).strict();

/**
 * ADR-033. The invitation travels ONLY in the READY state. qrPayload is the
 * signed slot invitation (USRP-SLOT.v1…), PII-free by construction
 * (ADR-009), verified offline at the venue.
 */
export const ExamInvitationViewSchema = z
  .object({
    "state": z.enum(['READY', 'ADMITTED', 'PENDING', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'EXPIRED', 'UNAVAILABLE', 'WALK_IN']),
    "agency": AgencySchema,
    "processingCode": z.string(),
    "campaignLabel": z.string().nullable(),
    "currentStatus": z.string(),
    "invitation": ExamInvitationPayloadSchema.optional(),
    "admission": ExamInvitationAdmissionSchema.optional(),
  }).strict();

export const Forbidden403Schema = z
  .object({
    "error": z.literal('FORBIDDEN'),
    "detail": z.string().optional(),
  }).strict();

export const GateAdmissionRequestSchema = z
  .object({
    "qrToken": z.string().min(1).max(4096),
    "nationalId": z.string().regex(/^[0-9]{16}$/),
    "gateVenueName": z.string().min(1).max(200),
  }).strict();

/**
 * The candidate as the gate officer needs them: public identifiers only.
 */
export const GateCandidateSchema = z
  .object({
    "applicationId": z.string().uuid(),
    "processingCode": z.string().min(1).max(32),
    "category": z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  }).strict();

export const GateAdmitted200Schema = z
  .object({
    "outcome": z.literal('ADMITTED'),
    "candidate": GateCandidateSchema,
    "venueName": z.string().min(1).max(200),
    "examDate": z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    "reportingTimeHour": z.number(),
    "admittedAt": z.string(),
    "statusAdvanced": z.boolean(),
  }).strict();

/**
 * The QR was already spent. Checked before venue and day, so a copied
 * screenshot is a duplicate at any gate.
 */
export const GateAlreadyAdmitted409Schema = z
  .object({
    "error": z.literal('ALREADY_ADMITTED'),
    "candidate": GateCandidateSchema,
    "admittedAt": z.string(),
    "venueName": z.string(),
    "admittedBySelf": z.boolean(),
  }).strict();

/**
 * The national ID on the card is not this applicant's. Audited.
 */
export const GateIdentityMismatch409Schema = z
  .object({
    "error": z.literal('IDENTITY_MISMATCH'),
    "candidate": GateCandidateSchema,
  }).strict();

export const GateNotAdmissible409Schema = z
  .object({
    "error": z.literal('NOT_ADMISSIBLE'),
    "candidate": GateCandidateSchema,
    "currentStatus": z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  }).strict();

/**
 * TOO_EARLY or EXPIRED: today in Africa/Kigali is not the exam day.
 */
export const GateWrongDay409Schema = z
  .object({
    "error": z.enum(['TOO_EARLY', 'EXPIRED']),
    "examDate": z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  }).strict();

export const GateWrongVenue409Schema = z
  .object({
    "error": z.literal('WRONG_VENUE'),
    "ticketVenueName": z.string(),
  }).strict();

export const GateConflict409Schema = z.union([
  GateAlreadyAdmitted409Schema,
  GateNotAdmissible409Schema,
  GateIdentityMismatch409Schema,
  GateWrongVenue409Schema,
  GateWrongDay409Schema,
]);

/**
 * The QR is not a ticket of this agency: malformed, another agency's,
 * unknown, or not the stored (signed) token.
 */
export const GateInvalidTicket422Schema = z
  .object({
    "error": z.literal('INVALID_TICKET'),
    "reason": z.enum(['MALFORMED_TICKET', 'WRONG_AGENCY', 'UNKNOWN_TICKET', 'TICKET_NOT_ISSUED']),
  }).strict();

export const IdentityAlreadyExists200Schema = z
  .object({
    "status": z.literal('ALREADY_EXISTS'),
    "applicantId": UuidSchema,
  }).strict();

export const IdentityCreated201Schema = z
  .object({
    "status": z.literal('CREATED'),
    "applicantId": UuidSchema,
  }).strict();

/**
 * Detail is written in source and discarded on the wire.
 */
export const IdentityError500Schema = z
  .object({
    "error": z.enum(['IDENTITY_PERSISTENCE_ERROR', 'INTERNAL_ERROR']),
  }).strict();

export const IdentityNotConfirmed422Schema = z
  .object({
    "error": z.literal('IDENTITY_NOT_CONFIRMED'),
    "detail": z.string().optional(),
  }).strict();

export const InvalidApplicantId400Schema = z
  .object({
    "error": z.literal('INVALID_APPLICANT_ID'),
    "detail": z.string().optional(),
  }).strict();

export const InvalidOtp401Schema = z
  .object({
    "error": z.literal('INVALID_OTP'),
    "detail": z.string().optional(),
  }).strict();

/**
 * THE CITIZEN'S 401. Distinct code from the JWT kinds' UNAUTHENTICATED, same
 * status, same service. Absent, malformed, expired and revoked are all this
 * one shape.
 */
export const InvalidSession401Schema = z
  .object({
    "error": z.literal('INVALID_SESSION'),
    "detail": z.string().optional(),
  }).strict();

export const MyApplicationsOkSchema = z
  .object({
    "applications": z.array(ApplicantApplicationSummarySchema),
  }).strict();

/**
 * NOTE the shape: no `status` discriminator wrapper, unlike every sibling.
 * `status` here is the REQUEST's lifecycle state, not an outcome code.
 */
export const MyErasureRequestOkSchema = z
  .object({
    "requestId": UuidSchema,
    "status": z.string(),
    "requestedAt": z.string(),
    "decidedAt": z.string().nullable(),
    "decisionNote": z.string().nullable(),
  }).strict();

export const NidaUnavailable503Schema = z
  .object({
    "error": z.literal('NIDA_UNAVAILABLE'),
  }).strict();

export const NotACitizen422Schema = z
  .object({
    "status": z.literal('NOT_A_CITIZEN'),
  }).strict();

export const NotFoundInNida404Schema = z
  .object({
    "status": z.literal('NOT_FOUND_IN_NIDA'),
  }).strict();

/**
 * REQUEST-ONLY. This schema is referenced by request bodies and by NO
 * response in this document. If it ever appears under a response, that is
 * the bug invariant 2 exists to catch.
 */
export const RawNationalIdSchema = z.string().min(1).max(32);

export const OnboardingBeginBodySchema = z
  .object({
    "nationalId": RawNationalIdSchema,
    "dateOfBirth": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "channel": ApplicationChannelSchema,
  }).strict();

export const OnboardingBegun200Schema = z
  .object({
    "onboardingToken": z.string().max(512),
    "expiresAt": z.string(),
  }).strict();

export const OnboardingExpired401Schema = z
  .object({
    "error": z.literal('ONBOARDING_EXPIRED'),
    "detail": z.string().optional(),
  }).strict();

export const OtpChallenged202Schema = z
  .object({
    "status": z.literal('CHALLENGED'),
  }).strict();

export const OtpRequestBodySchema = z
  .object({
    "onboardingToken": z.string().min(1).max(512),
    "phoneNumber": z.string().min(1).max(32),
    "channel": ApplicationChannelSchema,
  }).strict();

export const OtpVerifyBodySchema = z
  .object({
    "onboardingToken": z.string().min(1).max(512),
    "phoneNumber": z.string().min(1).max(32),
    "otp": z.string().min(1).max(12),
    "channel": ApplicationChannelSchema,
  }).strict();

export const SubmitApplicationRequestSchema = z
  .object({
    "category": z.string().max(64),
    "campaignCode": z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/),
    "nesaIndexNumber": z.string().max(64).optional(),
    "hecRegistrationNumber": z.string().max(64).optional(),
  }).strict();

export const SubmitApplicationResponseSchema = z
  .object({
    "status": z.literal('SUBMITTED'),
    "applicationId": z.string().uuid(),
    "processingCode": z.string(),
    "agency": AgencySchema,
  }).strict();

/**
 * The JWT kinds. Citizen sessions fail INVALID_SESSION instead.
 */
export const Unauthenticated401Schema = z
  .object({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
  }).strict();

export const UploadDocumentFormSchema = z
  .object({
    "applicationId": UuidSchema,
    "documentType": z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    "file": z.string(),
  }).strict();

export const UpstreamUnavailable502Schema = z
  .object({
    "error": z.literal('UPSTREAM_UNAVAILABLE'),
  }).strict();

export const VerifyIdentity400Schema = z
  .object({
    "error": z.enum(['MISSING_NATIONAL_ID', 'INVALID_CHANNEL', 'INVALID_NATIONAL_ID']),
    "detail": z.string().optional(),
  }).strict();

export const VerifyIdentityRequestSchema = z
  .object({
    "nationalId": RawNationalIdSchema,
    "channel": ApplicationChannelSchema,
  }).strict();

/**
 * Idempotent success — already WITHDRAWN. No writes, no audit row.
 */
export const WithdrawNoChangeOkSchema = z
  .object({
    "status": z.literal('NO_CHANGE'),
    "agency": AgencySchema,
  }).strict();

export const WithdrawnOkSchema = z
  .object({
    "status": z.literal('WITHDRAWN'),
    "agency": AgencySchema,
    "fromStatus": ApplicationStatusSchema,
  }).strict();

export const WithdrawMineOk200Schema = z.discriminatedUnion('status', [
  WithdrawnOkSchema,
  WithdrawNoChangeOkSchema,
]);

/**
 * applicationId ONLY. There is no applicantId field, by design — see the
 * operation description.
 */
export const WithdrawMineRequestSchema = z
  .object({
    "applicationId": UuidSchema,
  }).strict();

export const WithdrawNotApplicable409Schema = z
  .object({
    "status": z.literal('NOT_APPLICABLE'),
    "agency": AgencySchema,
    "currentStatus": ApplicationStatusSchema,
  }).strict();

/**
 * Bare. Not an ownership oracle — see the operation description.
 */
export const WithdrawNotFound404Schema = z
  .object({
    "status": z.literal('NOT_FOUND'),
  }).strict();

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this package is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const identityServiceOperations = {
  "verifyIdentity": {
    method: "POST",
    path: "/v1/identities/verify",
    auth: ["system","officer"],
    reach: "service-internal",
    request: VerifyIdentityRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": IdentityAlreadyExists200Schema,
      "201": IdentityCreated201Schema,
      "400": VerifyIdentity400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": NotFoundInNida404Schema,
      "422": NotACitizen422Schema,
      "500": IdentityError500Schema,
      "503": NidaUnavailable503Schema,
    },
  },
  "admitAtGate": {
    method: "POST",
    path: "/v1/gate/admissions",
    auth: ["officer"],
    reach: "browser",
    request: GateAdmissionRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": GateAdmitted200Schema,
      "400": null,
      "401": null,
      "403": null,
      "409": GateConflict409Schema,
      "422": GateInvalidTicket422Schema,
      "502": null,
      "503": null,
    },
  },
  "beginApplicantOnboarding": {
    method: "POST",
    path: "/v1/applicants/auth/onboarding/begin",
    auth: ["none"],
    reach: "browser",
    request: OnboardingBeginBodySchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": OnboardingBegun200Schema,
      "400": ApplicantAuth400Schema,
      "422": IdentityNotConfirmed422Schema,
      "500": ApplicantAuthError500Schema,
      "502": UpstreamUnavailable502Schema,
      "503": NidaUnavailable503Schema,
    },
  },
  "requestApplicantOtp": {
    method: "POST",
    path: "/v1/applicants/auth/otp/request",
    auth: ["none"],
    reach: "browser",
    request: OtpRequestBodySchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "202": OtpChallenged202Schema,
      "400": ApplicantAuth400Schema,
      "401": OnboardingExpired401Schema,
      "500": ApplicantAuthError500Schema,
      "502": UpstreamUnavailable502Schema,
      "503": NidaUnavailable503Schema,
    },
  },
  "verifyApplicantOtp": {
    method: "POST",
    path: "/v1/applicants/auth/otp/verify",
    auth: ["none"],
    reach: "browser",
    request: OtpVerifyBodySchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": ApplicantSessionIssued200Schema,
      "400": ApplicantAuth400Schema,
      "401": InvalidOtp401Schema,
      "500": ApplicantAuthError500Schema,
      "502": UpstreamUnavailable502Schema,
      "503": NidaUnavailable503Schema,
    },
  },
  "logoutApplicant": {
    method: "POST",
    path: "/v1/applicants/auth/logout",
    auth: ["applicant-session"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "204": null,
      "401": InvalidSession401Schema,
      "500": ApplicantAuthError500Schema,
    },
  },
  "listMyApplications": {
    method: "GET",
    path: "/v1/applicants/me/applications",
    auth: ["applicant-session"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": MyApplicationsOkSchema,
      "401": InvalidSession401Schema,
      "500": ApplicantAuthError500Schema,
      "502": UpstreamUnavailable502Schema,
    },
  },
  "submitMyApplication": {
    method: "POST",
    path: "/v1/applicants/me/applications",
    auth: ["applicant-session"],
    reach: "browser",
    request: SubmitApplicationRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": SubmitApplicationResponseSchema,
      "201": SubmitApplicationResponseSchema,
      "400": null,
      "401": null,
      "409": null,
      "422": null,
      "429": null,
      "503": null,
    },
  },
  "getMyExamInvitation": {
    method: "GET",
    path: "/v1/applicants/me/applications/exam-invitation",
    auth: ["applicant-session"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["applicationId"],
    responses: {
      "200": ExamInvitationViewSchema,
      "400": null,
      "401": InvalidSession401Schema,
      "404": null,
      "502": UpstreamUnavailable502Schema,
    },
  },
  "getMyDocumentChecklist": {
    method: "GET",
    path: "/v1/applicants/me/applications/document-checklist",
    auth: ["applicant-session"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["applicationId"],
    responses: {
      "200": DocumentChecklist200Schema,
      "400": null,
      "401": InvalidSession401Schema,
      "404": null,
      "502": UpstreamUnavailable502Schema,
    },
  },
  "uploadMyDocument": {
    method: "POST",
    path: "/v1/applicants/me/applications/documents",
    auth: ["applicant-session"],
    reach: "browser",
    request: UploadDocumentFormSchema,
    requestMediaType: "multipart/form-data",
    query: [],
    responses: {
      "201": DocumentUploaded201Schema,
      "400": null,
      "401": InvalidSession401Schema,
      "404": null,
      "409": null,
      "413": null,
      "422": null,
      "502": UpstreamUnavailable502Schema,
    },
  },
  "withdrawMyApplication": {
    method: "POST",
    path: "/v1/applicants/me/applications/withdraw",
    auth: ["applicant-session"],
    reach: "browser",
    request: WithdrawMineRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": WithdrawMineOk200Schema,
      "400": ApplicantAuth400Schema,
      "401": InvalidSession401Schema,
      "404": WithdrawNotFound404Schema,
      "409": WithdrawNotApplicable409Schema,
      "500": ApplicantAuthError500Schema,
      "502": UpstreamUnavailable502Schema,
    },
  },
  "getMyErasureRequest": {
    method: "GET",
    path: "/v1/applicants/me/erasure-request",
    auth: ["applicant-session"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": MyErasureRequestOkSchema,
      "401": InvalidSession401Schema,
      "404": ErasureRequestNone404Schema,
      "500": ApplicantAuthError500Schema,
    },
  },
  "fileMyErasureRequest": {
    method: "POST",
    path: "/v1/applicants/me/erasure-request",
    auth: ["applicant-session"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "202": ErasureRequestFiled202Schema,
      "401": InvalidSession401Schema,
      "500": ApplicantAuthError500Schema,
    },
  },
  "eraseIdentity": {
    method: "POST",
    path: "/v1/identities/erasure",
    auth: ["officer"],
    reach: "browser",
    request: EraseIdentityRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": EraseOk200Schema,
      "400": InvalidApplicantId400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": ErasureNotFound404Schema,
      "409": EraseRefused409Schema,
      "500": IdentityError500Schema,
    },
  },
  "listErasureRequests": {
    method: "GET",
    path: "/v1/identities/erasure-requests",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": ErasureQueueOkSchema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "500": ApplicantAuthError500Schema,
    },
  },
  "declineErasureRequest": {
    method: "POST",
    path: "/v1/identities/erasure-requests/decline",
    auth: ["officer"],
    reach: "browser",
    request: DeclineErasureRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": ErasureDeclined200Schema,
      "400": ApplicantAuth400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": ErasureNotFound404Schema,
      "409": ErasureNotPending409Schema,
      "500": ApplicantAuthError500Schema,
    },
  },
  "identityHealth": {
    method: "GET",
    path: "/health",
    auth: ["none"],
    reach: "service-internal",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": null,
    },
  },
  "identityReady": {
    method: "GET",
    path: "/ready",
    auth: ["none"],
    reach: "service-internal",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": null,
      "503": null,
    },
  },
} as const;
