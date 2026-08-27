// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/application-service.yaml                  ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/application-service.yaml instead.║
// ╚══════════════════════════════════════════════════════════════╝

//
// USRP application-service
//
// Route table (method, path, auth kinds, reach):
//   GET  /v1/applications                               officer            browser
//   POST /v1/applications                               system             service-internal
//   GET  /v1/applications/amber-queue                   officer            browser
//   GET  /v1/applications/by-applicant                  system             service-internal
//   GET  /v1/applications/by-id                         officer            browser
//   GET  /v1/applications/status-history                officer            browser
//   POST /v1/applications/medical-review                officer            browser
//   POST /v1/applications/final-decision                officer            browser
//   POST /v1/applications/accept                        officer            browser
//   POST /v1/applications/adjudicate                    officer            browser
//   POST /v1/applications/walk-in/register              officer            browser
//   POST /v1/applications/walk-in/vet                   officer            browser
//   POST /v1/applications/withdraw-own                  system             service-internal
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//
// `.strict()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

export const AgencySchema = z.enum(['RDF', 'RNP', 'RCS']);

/**
 * ADR-014: one citizen, one acceptance. lockedByAgency may be the officer's
 * OWN agency, via a second application by the same person.
 */
export const CrossAgencyLocked409Schema = z
  .object({
    "status": z.literal('CROSS_AGENCY_LOCKED'),
    "lockedByAgency": AgencySchema,
  }).strict();

/**
 * All 19 states. Per-agency legality is NOT expressible here — rnp_ops and
 * rcs_ops carry no WALK_IN_* values. Use StatusFor<Agency> from
 * src/agency.ts to constrain by agency at compile time.
 */
export const ApplicationStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'ACADEMIC_VETTING', 'CRIMINAL_CLEARANCE', 'DOCUMENT_REVIEW_GREEN', 'DOCUMENT_REVIEW_AMBER', 'SLOT_ASSIGNED', 'PHYSICAL_TEST_SCHEDULED', 'PHYSICAL_TEST_COMPLETE', 'MEDICAL_REVIEW', 'FINAL_SHORTLIST', 'ACCEPTED', 'ADJUDICATION_REVIEW', 'REJECTED', 'WITHDRAWN', 'WALK_IN_REGISTERED', 'WALK_IN_ON_SITE_VETTING', 'WALK_IN_PHYSICAL_TEST', 'WALK_IN_REJECTED']);

export const NotApplicable409Schema = z
  .object({
    "status": z.literal('NOT_APPLICABLE'),
    "currentStatus": ApplicationStatusSchema,
  }).strict();

export const AcceptConflict409Schema = z.discriminatedUnion('status', [
  NotApplicable409Schema,
  CrossAgencyLocked409Schema,
]);

export const UuidSchema = z.string().uuid().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

/**
 * applicationId ALONE. No decision, no notes.
 */
export const AcceptRequestSchema = z
  .object({
    "applicationId": UuidSchema,
  }).strict();

export const AdjudicateRequestSchema = z
  .object({
    "applicationId": UuidSchema,
    "decision": z.enum(['CLEAR', 'REJECT']),
    "notes": z.string().max(1000).nullable().optional(),
  }).strict();

/**
 * THE ONLY RETRYABLE 409 IN THE PLATFORM. Retry in a moment.
 */
export const AgePending409Schema = z
  .object({
    "status": z.literal('AGE_PENDING'),
    "currentStatus": ApplicationStatusSchema,
  }).strict();

/**
 * One review-queue row: either an amber document hold (document fields
 * populated) or an ADJUDICATION_REVIEW hold (document fields ALL null). Both
 * arrive in the same array.
 */
export const AmberQueueEntrySchema = z
  .object({
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "status": ApplicationStatusSchema,
    "documentType": z.string().nullable(),
    "forensicsScore": z.number().nullable(),
    "forensicsFlags": z.record(z.unknown()).nullable(),
    "queuedAt": z.string().nullable(),
  }).strict();

export const AmberQueueOkSchema = z
  .object({
    "agency": AgencySchema,
    "queue": z.array(AmberQueueEntrySchema),
  }).strict();

/**
 * Validated against ALL_CATEGORIES, the union across all three agencies.
 * Each category maps to EXACTLY ONE agency (agencyForCategory), and sending
 * one that maps elsewhere is 422 WRONG_AGENCY_CATEGORY on the walk-in road.
 * Typed string because the partition is the divergence model's job, not
 * OpenAPI's.
 */
export const ApplicationCategorySchema = z.string().min(1);

/**
 * A summary plus the owning agency, for the cross-agency citizen read.
 */
export const ApplicantApplicationSummarySchema = z
  .object({
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "category": ApplicationCategorySchema,
    "status": ApplicationStatusSchema,
    "submittedAt": z.string().nullable(),
    "agency": AgencySchema,
  }).strict();

export const ApplicantNotFound404Schema = z
  .object({
    "status": z.literal('APPLICANT_NOT_FOUND'),
  }).strict();

export const ApplicationChannelSchema = z.enum(['WEB', 'USSD', 'IREMBO_KIOSK', 'WALK_IN']);

/**
 * The full non-PII view of ONE application — what the officer console detail
 * screen renders.
 * 
 * TWO OMISSIONS ARE SECURITY DECISIONS, NOT OVERSIGHTS. applicant_id is
 * absent: the processing code stands in for the applicant and nothing here
 * reveals who. qr_invitation_code is absent even though the column exists:
 * it is a BEARER CREDENTIAL the field officer scans at the venue, and
 * returning it would publish an invitation token to every console session
 * able to open the record.
 * 
 * THE COLUMN SET IS THE INTERSECTION OF THE THREE OPS SCHEMAS.
 * medical_reviewed_*, is_walk_in, document_review_notes and
 * sms_notification_status exist in rdf_ops but NOT rcs_ops — selecting them
 * would make this read throw for RCS officers and nobody else. Three columns
 * are typed string rather than an enum because the per-agency enum VALUES
 * diverge (rcs_ops adds FLAGGED_PROSECUTION to criminal_clearance_status).
 */
export const ApplicationDetailSchema = z
  .object({
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "category": ApplicationCategorySchema,
    "status": ApplicationStatusSchema,
    "nesaIndexNumber": z.string().nullable(),
    "nesaVerifiedAt": z.string().nullable(),
    "hecRegistrationNumber": z.string().nullable(),
    "hecVerifiedAt": z.string().nullable(),
    "declaredSpecialistField": z.string().nullable(),
    "academicStatus": z.string(),
    "academicEligibilityDetail": z.record(z.unknown()).nullable(),
    "ageEligibilityStatus": z.string(),
    "ageVerifiedAt": z.string().nullable(),
    "ageEligibilityDetail": z.record(z.unknown()).nullable(),
    "criminalClearanceStatus": z.string(),
    "criminalClearanceAt": z.string().nullable(),
    "documentLane": z.string().nullable(),
    "documentForensicsScore": z.number().nullable(),
    "documentForensicsFlags": z.record(z.unknown()).nullable(),
    "documentReviewedById": z.string().nullable(),
    "documentReviewedAt": z.string().nullable(),
    "documentReviewDecision": z.string().nullable(),
    "assignedDistrict": z.string().nullable(),
    "assignedVenueName": z.string().nullable(),
    "physicalTestScheduledAt": z.string().nullable(),
    "physicalTestCompletedAt": z.string().nullable(),
    "qrInvitationIssuedAt": z.string().nullable(),
    "smsNotificationSentAt": z.string().nullable(),
    "finalDecisionById": z.string().nullable(),
    "finalDecisionAt": z.string().nullable(),
    "finalDecisionNotes": z.string().nullable(),
    "submittedAt": z.string().nullable(),
    "createdAt": z.string(),
    "updatedAt": z.string(),
  }).strict();

/**
 * Detail withheld. HttpError sets expose = status < 500, so every 5xx detail
 * string written in the backend is discarded before it reaches the wire. Do
 * not build UI that reads detail off a 5xx; there is never one there.
 */
export const ApplicationError500Schema = z
  .object({
    "error": z.enum(['APPLICATION_READ_ERROR', 'APPLICATION_PERSISTENCE_ERROR', 'INTERNAL_ERROR']),
  }).strict();

export const ApplicationSubmitted201Schema = z
  .object({
    "status": z.literal('SUBMITTED'),
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "agency": AgencySchema,
  }).strict();

/**
 * A non-PII summary row. The anonymous processing code stands in for the
 * applicant — there is no name, no NID and no phone on any officer read.
 */
export const ApplicationSummarySchema = z
  .object({
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "category": ApplicationCategorySchema,
    "status": ApplicationStatusSchema,
    "submittedAt": z.string().nullable(),
  }).strict();

/**
 * NOTE: no `agency` on the envelope — the rows are cross-agency.
 */
export const ByApplicantOkSchema = z
  .object({
    "applications": z.array(ApplicantApplicationSummarySchema),
  }).strict();

export const FinalDecisionRequestSchema = z
  .object({
    "applicationId": UuidSchema,
    "decision": z.enum(['SHORTLIST', 'REJECT']),
    "notes": z.string().max(1000).nullable().optional(),
  }).strict();

export const FindApplicationOkSchema = z
  .object({
    "agency": AgencySchema,
    "application": ApplicationDetailSchema,
  }).strict();

/**
 * Authenticated, wrong principal kind. NOT a discriminated union with the
 * other 403 shapes in the platform: withAuth emits { error, detail },
 * outcome branches emit { error } alone, and biometric-service emits {
 * status: AGENCY_MISMATCH }. Three incompatible bodies for one status is a
 * live platform inconsistency, recorded rather than smoothed over.
 */
export const Forbidden403Schema = z
  .object({
    "error": z.literal('FORBIDDEN'),
    "detail": z.string().optional(),
  }).strict();

export const IdentityNotVerified409Schema = z
  .object({
    "status": z.literal('IDENTITY_NOT_VERIFIED'),
  }).strict();

export const InvalidAcademicInput422Schema = z
  .object({
    "status": z.literal('INVALID_ACADEMIC_INPUT'),
    "reason": z.string(),
  }).strict();

export const InvalidApplicantId400Schema = z
  .object({
    "error": z.literal('INVALID_APPLICANT_ID'),
    "detail": z.string().optional(),
  }).strict();

export const InvalidApplicationId400Schema = z
  .object({
    "error": z.literal('INVALID_APPLICATION_ID'),
    "detail": z.string().optional(),
  }).strict();

export const InvalidMedicalInput422Schema = z
  .object({
    "status": z.literal('INVALID_MEDICAL_INPUT'),
    "reason": z.string(),
  }).strict();

export const InvalidRequest400Schema = z
  .object({
    "error": z.literal('INVALID_REQUEST'),
    "detail": z.string().optional(),
  }).strict();

export const ListApplicationsOkSchema = z
  .object({
    "agency": AgencySchema,
    "applications": z.array(ApplicationSummarySchema),
  }).strict();

/**
 * THE TWO MODES ARE MUTUALLY EXCLUSIVE IN PRACTICE but the wire accepts
 * either, and OpenAPI cannot express "whichever your agency uses" because
 * the agency comes from the token. Sending neither is 400; sending the wrong
 * one for your agency is 422.
 */
export const MedicalReviewRequestSchema = z
  .object({
    "applicationId": UuidSchema,
    "fitnessStatus": z.enum(['FIT', 'UNFIT']).optional(),
    "certVerdict": z.enum(['CERT_VERIFIED', 'CERT_REJECTED']).optional(),
    "physicianName": z.string().optional(),
  }).strict();

export const MedicalReviewRequest400Schema = z
  .object({
    "error": z.enum(['MISSING_APPLICATION_ID', 'INVALID_APPLICATION_ID', 'INVALID_FITNESS_STATUS', 'INVALID_CERT_VERDICT', 'INVALID_PHYSICIAN_NAME', 'MISSING_MEDICAL_VERDICT']),
    "detail": z.string().optional(),
  }).strict();

export const NoOpenCampaign409Schema = z
  .object({
    "status": z.literal('NO_OPEN_CAMPAIGN'),
    "agency": AgencySchema,
  }).strict();

export const NoWalkInCampaign409Schema = z
  .object({
    "status": z.literal('NO_WALK_IN_CAMPAIGN'),
    "agency": AgencySchema,
  }).strict();

/**
 * THE READ ROUTES' 404, KEYED ON `error` — not `status` like the write
 * routes' NOT_FOUND. Same word, different key, same service. A client cannot
 * use one guard for both.
 */
export const NotFound404Schema = z
  .object({
    "error": z.literal('NOT_FOUND'),
  }).strict();

/**
 * One entry of the immutable trail. This is the record a rejected applicant
 * is entitled to see reasons from, so every field answering "who changed
 * what, when, and why" is carried. actorKind is DERIVED so the UI can
 * distinguish a human step from an automated one without string-matching
 * 'SYSTEM' in three components.
 */
export const StatusHistoryEntrySchema = z
  .object({
    "entryId": UuidSchema,
    "fromStatus": z.union([
    ApplicationStatusSchema,
    z.null(),
  ]),
    "toStatus": ApplicationStatusSchema,
    "note": z.string().nullable(),
    "actor": z.string(),
    "actorKind": z.enum(['SYSTEM', 'OFFICER']),
    "at": z.string(),
    "correlationId": z.string().nullable(),
  }).strict();

export const StatusHistoryOkSchema = z
  .object({
    "agency": AgencySchema,
    "applicationId": UuidSchema,
    "history": z.array(StatusHistoryEntrySchema),
  }).strict();

export const SubmitApplicationRequestSchema = z
  .object({
    "applicantId": UuidSchema,
    "category": ApplicationCategorySchema,
    "channel": ApplicationChannelSchema,
    "nesaIndexNumber": z.string().nullable().optional(),
    "hecRegistrationNumber": z.string().nullable().optional(),
  }).strict();

export const SubmitConflict409Schema = z.discriminatedUnion('status', [
  IdentityNotVerified409Schema,
  NoOpenCampaign409Schema,
]);

export const SubmitRequest400Schema = z
  .object({
    "error": z.enum(['MISSING_APPLICANT_ID', 'INVALID_APPLICANT_ID', 'INVALID_CATEGORY', 'INVALID_CHANNEL', 'INVALID_FIELD']),
    "detail": z.string().optional(),
  }).strict();

/**
 * The shared APPLIED body for medical-review, final-decision, accept and
 * adjudicate. NOTE WHAT IT IS NOT: it is not an application object. There is
 * no way to write and read back in one call — refetch by-id afterwards.
 */
export const TransitionAppliedSchema = z
  .object({
    "status": z.literal('APPLIED'),
    "fromStatus": ApplicationStatusSchema,
    "toStatus": ApplicationStatusSchema,
  }).strict();

/**
 * Idempotent success. The demanded end-state already held.
 */
export const TransitionNoChangeSchema = z
  .object({
    "status": z.literal('NO_CHANGE'),
    "currentStatus": ApplicationStatusSchema,
  }).strict();

/**
 * Bare. Identical for another agency's real application.
 */
export const TransitionNotFound404Schema = z
  .object({
    "status": z.literal('NOT_FOUND'),
  }).strict();

/**
 * Two bodies on one status code, discriminated on `status`.
 */
export const TransitionOk200Schema = z.discriminatedUnion('status', [
  TransitionAppliedSchema,
  TransitionNoChangeSchema,
]);

export const TransitionRequest400Schema = z
  .object({
    "error": z.enum(['MISSING_APPLICATION_ID', 'INVALID_APPLICATION_ID', 'INVALID_DECISION', 'INVALID_NOTES']),
    "detail": z.string().optional(),
  }).strict();

/**
 * The Ed25519 bearer kinds fail with this. identity-service's
 * applicant-session routes fail with INVALID_SESSION instead — same status,
 * different code, different service.
 */
export const Unauthenticated401Schema = z
  .object({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
  }).strict();

/**
 * RDF-only lane. An honest 501 rather than a raw DB enum error, because
 * rdf_ops is the only schema modelling WALK_IN_*.
 */
export const UnsupportedAgency501Schema = z
  .object({
    "status": z.literal('UNSUPPORTED_AGENCY'),
    "agency": AgencySchema,
  }).strict();

export const WalkInRegisterConflict409Schema = z.discriminatedUnion('status', [
  IdentityNotVerified409Schema,
  NoWalkInCampaign409Schema,
]);

/**
 * NOT { nationalIdHash, postCode }. See the operation description — the
 * deprecated frontend's shape asked the browser to compute an internal
 * cross-service key.
 */
export const WalkInRegisterRequestSchema = z
  .object({
    "applicantId": UuidSchema,
    "category": ApplicationCategorySchema,
    "nesaIndexNumber": z.string().nullable().optional(),
    "hecRegistrationNumber": z.string().nullable().optional(),
  }).strict();

/**
 * THE UN-UNDERSCORED SPELLINGS ARE NOT A TYPO IN THIS DOCUMENT. The
 * controller builds these codes with `MISSING_${field.toUpperCase()}`, so
 * applicantId becomes APPLICANTID. Recorded verbatim.
 */
export const WalkInRegisterRequest400Schema = z
  .object({
    "error": z.enum(['MISSING_APPLICANTID', 'INVALID_APPLICANTID', 'INVALID_CATEGORY', 'INVALID_NESAINDEXNUMBER', 'INVALID_HECREGISTRATIONNUMBER']),
    "detail": z.string().optional(),
  }).strict();

export const WrongAgencyCategory422Schema = z
  .object({
    "status": z.literal('WRONG_AGENCY_CATEGORY'),
    "categoryAgency": AgencySchema,
  }).strict();

export const WalkInRegisterUnprocessable422Schema = z.discriminatedUnion('status', [
  WrongAgencyCategory422Schema,
  InvalidAcademicInput422Schema,
]);

export const WalkInRegistered201Schema = z
  .object({
    "status": z.literal('REGISTERED'),
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "qrInvitationCode": z.string(),
  }).strict();

/**
 * Carries an extra ageStatus the other three transitions do not.
 */
export const WalkInVetAppliedSchema = z
  .object({
    "status": z.literal('APPLIED'),
    "fromStatus": ApplicationStatusSchema,
    "toStatus": ApplicationStatusSchema,
    "ageStatus": z.string(),
  }).strict();

export const WalkInVetConflict409Schema = z.discriminatedUnion('status', [
  AgePending409Schema,
  NotApplicable409Schema,
]);

export const WalkInVetOk200Schema = z.discriminatedUnion('status', [
  WalkInVetAppliedSchema,
  TransitionNoChangeSchema,
]);

export const WalkInVetRequestSchema = z
  .object({
    "applicationId": UuidSchema,
  }).strict();

export const WalkInVetRequest400Schema = z
  .object({
    "error": z.enum(['MISSING_APPLICATIONID', 'INVALID_APPLICATIONID']),
    "detail": z.string().optional(),
  }).strict();

export const WithdrawOwnNoChange200Schema = z
  .object({
    "status": z.literal('NO_CHANGE'),
    "agency": AgencySchema,
  }).strict();

export const WithdrawOwnNotApplicable409Schema = z
  .object({
    "status": z.literal('NOT_APPLICABLE'),
    "agency": AgencySchema,
    "currentStatus": ApplicationStatusSchema,
  }).strict();

export const WithdrawnOwn200Schema = z
  .object({
    "status": z.literal('WITHDRAWN'),
    "agency": AgencySchema,
    "fromStatus": ApplicationStatusSchema,
  }).strict();

export const WithdrawOwnOk200Schema = z.discriminatedUnion('status', [
  WithdrawnOwn200Schema,
  WithdrawOwnNoChange200Schema,
]);

/**
 * BOTH ids. Ownership is the row lookup; either mismatch is one 404.
 */
export const WithdrawOwnRequestSchema = z
  .object({
    "applicantId": UuidSchema,
    "applicationId": UuidSchema,
  }).strict();

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this service is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const applicationServiceOperations = {
  "listApplications": {
    method: "GET",
    path: "/v1/applications",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": ListApplicationsOkSchema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "500": ApplicationError500Schema,
    },
  },
  "submitApplication": {
    method: "POST",
    path: "/v1/applications",
    auth: ["system"],
    reach: "service-internal",
    request: SubmitApplicationRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "201": ApplicationSubmitted201Schema,
      "400": SubmitRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": ApplicantNotFound404Schema,
      "409": SubmitConflict409Schema,
      "422": InvalidAcademicInput422Schema,
      "500": ApplicationError500Schema,
    },
  },
  "listAmberQueue": {
    method: "GET",
    path: "/v1/applications/amber-queue",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": AmberQueueOkSchema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "500": ApplicationError500Schema,
    },
  },
  "listApplicationsByApplicant": {
    method: "GET",
    path: "/v1/applications/by-applicant",
    auth: ["system"],
    reach: "service-internal",
    request: null,
    requestMediaType: null,
    query: ["applicantId"],
    responses: {
      "200": ByApplicantOkSchema,
      "400": InvalidApplicantId400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "500": ApplicationError500Schema,
    },
  },
  "findApplicationById": {
    method: "GET",
    path: "/v1/applications/by-id",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["applicationId"],
    responses: {
      "200": FindApplicationOkSchema,
      "400": InvalidApplicationId400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": NotFound404Schema,
      "500": ApplicationError500Schema,
    },
  },
  "getApplicationStatusHistory": {
    method: "GET",
    path: "/v1/applications/status-history",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["applicationId"],
    responses: {
      "200": StatusHistoryOkSchema,
      "400": InvalidApplicationId400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": NotFound404Schema,
      "500": ApplicationError500Schema,
    },
  },
  "recordMedicalReview": {
    method: "POST",
    path: "/v1/applications/medical-review",
    auth: ["officer"],
    reach: "browser",
    request: MedicalReviewRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": TransitionOk200Schema,
      "400": MedicalReviewRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": TransitionNotFound404Schema,
      "409": NotApplicable409Schema,
      "422": InvalidMedicalInput422Schema,
      "500": ApplicationError500Schema,
    },
  },
  "recordFinalDecision": {
    method: "POST",
    path: "/v1/applications/final-decision",
    auth: ["officer"],
    reach: "browser",
    request: FinalDecisionRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": TransitionOk200Schema,
      "400": TransitionRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": TransitionNotFound404Schema,
      "409": NotApplicable409Schema,
      "500": ApplicationError500Schema,
    },
  },
  "acceptApplication": {
    method: "POST",
    path: "/v1/applications/accept",
    auth: ["officer"],
    reach: "browser",
    request: AcceptRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": TransitionOk200Schema,
      "400": TransitionRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": TransitionNotFound404Schema,
      "409": AcceptConflict409Schema,
      "500": ApplicationError500Schema,
    },
  },
  "adjudicateApplication": {
    method: "POST",
    path: "/v1/applications/adjudicate",
    auth: ["officer"],
    reach: "browser",
    request: AdjudicateRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": TransitionOk200Schema,
      "400": TransitionRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": TransitionNotFound404Schema,
      "409": NotApplicable409Schema,
      "500": ApplicationError500Schema,
    },
  },
  "registerWalkIn": {
    method: "POST",
    path: "/v1/applications/walk-in/register",
    auth: ["officer"],
    reach: "browser",
    request: WalkInRegisterRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "201": WalkInRegistered201Schema,
      "400": WalkInRegisterRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": ApplicantNotFound404Schema,
      "409": WalkInRegisterConflict409Schema,
      "422": WalkInRegisterUnprocessable422Schema,
      "500": ApplicationError500Schema,
      "501": UnsupportedAgency501Schema,
    },
  },
  "vetWalkIn": {
    method: "POST",
    path: "/v1/applications/walk-in/vet",
    auth: ["officer"],
    reach: "browser",
    request: WalkInVetRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": WalkInVetOk200Schema,
      "400": WalkInVetRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": TransitionNotFound404Schema,
      "409": WalkInVetConflict409Schema,
      "500": ApplicationError500Schema,
      "501": UnsupportedAgency501Schema,
    },
  },
  "withdrawOwnApplication": {
    method: "POST",
    path: "/v1/applications/withdraw-own",
    auth: ["system"],
    reach: "service-internal",
    request: WithdrawOwnRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": WithdrawOwnOk200Schema,
      "400": InvalidRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": TransitionNotFound404Schema,
      "409": WithdrawOwnNotApplicable409Schema,
      "500": ApplicationError500Schema,
    },
  },
  "applicationHealth": {
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
  "applicationReady": {
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
