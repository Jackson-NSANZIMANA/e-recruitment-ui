// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/application-service.yaml                  ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  b004fca840af12435bbc84ec0e365c513c788c36          ║
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
//   GET  /v1/campaigns                                  none               browser
//   POST /v1/campaigns                                  officer            browser
//   GET  /v1/campaigns/detail                           none               browser
//   POST /v1/campaigns/policy                           officer            browser
//   POST /v1/campaigns/publish                          officer            browser
//   POST /v1/campaigns/registration-close               officer            browser
//   POST /v1/campaigns/complete                         officer            browser
//   POST /v1/campaigns/cancel                           officer            browser
//   POST /v1/applications/admissions/gate               officer            service-internal
//   GET  /v1/applications/exam-invitation/by-applicant  system             service-internal
//   GET  /v1/applications/document-checklist            officer            browser
//   GET  /v1/applications/document-checklist/by-applicant system             service-internal
//   POST /v1/applications/documents/verify-at-venue     officer            browser
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
//   POST /v1/applications/clearance-certificate-own     system             service-internal
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//   GET  /v1/applications/search                        officer            browser
//   GET  /v1/applications/biometric-evidence            officer            browser
//   POST /v1/applications/biometric-evidence/manual-identity officer            browser
//   GET  /v1/campaigns/admin                            officer            browser
//   GET  /v1/campaigns/admin/detail                     officer            browser
//   GET  /v1/venue-roster                               officer            browser
//   GET  /v1/venue-live-counts                          officer            browser
//
// `z.strictObject()` on every closed object is intentional: an unexpected key means
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
  .strictObject({
    "status": z.literal('CROSS_AGENCY_LOCKED'),
    "lockedByAgency": AgencySchema,
  });

/**
 * All 19 states. Per-agency legality is NOT expressible here — rnp_ops and
 * rcs_ops carry no WALK_IN_* values. Use StatusFor<Agency> from
 * src/agency.ts to constrain by agency at compile time.
 */
export const ApplicationStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'ACADEMIC_VETTING', 'CRIMINAL_CLEARANCE', 'DOCUMENT_REVIEW_GREEN', 'DOCUMENT_REVIEW_AMBER', 'SLOT_ASSIGNED', 'PHYSICAL_TEST_SCHEDULED', 'PHYSICAL_TEST_COMPLETE', 'MEDICAL_REVIEW', 'FINAL_SHORTLIST', 'ACCEPTED', 'ADJUDICATION_REVIEW', 'REJECTED', 'WITHDRAWN', 'WALK_IN_REGISTERED', 'WALK_IN_ON_SITE_VETTING', 'WALK_IN_PHYSICAL_TEST', 'WALK_IN_REJECTED']);

export const NotApplicable409Schema = z
  .strictObject({
    "status": z.literal('NOT_APPLICABLE'),
    "currentStatus": ApplicationStatusSchema,
  });

export const AcceptConflict409Schema = z.discriminatedUnion('status', [
  NotApplicable409Schema,
  CrossAgencyLocked409Schema,
]);

export const UuidSchema = z.string().guid().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

/**
 * applicationId ALONE. No decision, no notes.
 */
export const AcceptRequestSchema = z
  .strictObject({
    "applicationId": UuidSchema,
  });

export const AdjudicateRequestSchema = z
  .strictObject({
    "applicationId": UuidSchema,
    "decision": z.enum(['CLEAR', 'REJECT']),
    "notes": z.string().max(1000).nullable().optional(),
  });

/**
 * THE ONLY RETRYABLE 409 IN THE PLATFORM. Retry in a moment.
 */
export const AgePending409Schema = z
  .strictObject({
    "status": z.literal('AGE_PENDING'),
    "currentStatus": ApplicationStatusSchema,
  });

/**
 * One review-queue row: either an amber document hold (document fields
 * populated) or an ADJUDICATION_REVIEW hold (document fields ALL null). Both
 * arrive in the same array.
 */
export const AmberQueueEntrySchema = z
  .strictObject({
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "status": ApplicationStatusSchema,
    "documentType": z.string().nullable(),
    "forensicsScore": z.number().nullable(),
    "forensicsFlags": z.record(z.string(), z.unknown()).nullable(),
    "queuedAt": z.string().nullable(),
  });

export const AmberQueueOkSchema = z
  .strictObject({
    "agency": AgencySchema,
    "queue": z.array(AmberQueueEntrySchema),
  });

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
  .strictObject({
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "category": ApplicationCategorySchema,
    "status": ApplicationStatusSchema,
    "submittedAt": z.string().nullable(),
    "agency": AgencySchema,
  });

export const ApplicantNotFound404Schema = z
  .strictObject({
    "status": z.literal('APPLICANT_NOT_FOUND'),
  });

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
  .strictObject({
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
    "academicEligibilityDetail": z.record(z.string(), z.unknown()).nullable(),
    "ageEligibilityStatus": z.string(),
    "ageVerifiedAt": z.string().nullable(),
    "ageEligibilityDetail": z.record(z.string(), z.unknown()).nullable(),
    "criminalClearanceStatus": z.string(),
    "criminalClearanceAt": z.string().nullable(),
    "documentLane": z.string().nullable(),
    "documentForensicsScore": z.number().nullable(),
    "documentForensicsFlags": z.record(z.string(), z.unknown()).nullable(),
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
  });

/**
 * Detail withheld. HttpError sets expose = status < 500, so every 5xx detail
 * string written in the backend is discarded before it reaches the wire. Do
 * not build UI that reads detail off a 5xx; there is never one there.
 */
export const ApplicationError500Schema = z
  .strictObject({
    "error": z.enum(['APPLICATION_READ_ERROR', 'APPLICATION_PERSISTENCE_ERROR', 'INTERNAL_ERROR']),
  });

export const ApplicationSearchRowSchema = z
  .strictObject({
    "applicationId": z.string().guid(),
    "processingCode": z.string(),
    "category": z.string(),
    "status": z.string(),
    "submittedAt": z.string().nullable(),
  });

export const ApplicationSearchOkSchema = z
  .strictObject({
    "agency": z.string(),
    "applications": z.array(ApplicationSearchRowSchema),
    "total": z.number(),
    "nextCursor": z.string().nullable(),
  });

export const ApplicationSubmitted201Schema = z
  .strictObject({
    "status": z.literal('SUBMITTED'),
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "agency": AgencySchema,
  });

/**
 * A non-PII summary row. The anonymous processing code stands in for the
 * applicant — there is no name, no NID and no phone on any officer read.
 */
export const ApplicationSummarySchema = z
  .strictObject({
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "category": ApplicationCategorySchema,
    "status": ApplicationStatusSchema,
    "submittedAt": z.string().nullable(),
  });

export const AttachClearanceInvalidNumber422Schema = z
  .strictObject({
    "status": z.literal('INVALID_NUMBER'),
  });

export const AttachClearanceNotApplicable409Schema = z
  .strictObject({
    "status": z.literal('NOT_APPLICABLE'),
    "agency": AgencySchema,
    "currentStatus": ApplicationStatusSchema,
  });

/**
 * The agency's Irembo certificate flow is off. Not a failure to retry.
 */
export const AttachClearanceNotEnabled501Schema = z
  .strictObject({
    "status": z.literal('NOT_ENABLED'),
  });

export const AttachClearanceOk200Schema = z
  .strictObject({
    "status": z.enum(['ACCEPTED', 'ALREADY_VERIFIED']),
    "agency": AgencySchema,
  });

/**
 * BOTH ids, plus the number. The number is never echoed in any response.
 */
export const AttachClearanceOwnRequestSchema = z
  .strictObject({
    "applicantId": UuidSchema,
    "applicationId": UuidSchema,
    "clearanceCertificateNumber": z.string().min(1).max(64),
  });

export const BiometricEvidenceRowSchema = z
  .strictObject({
    "recordId": z.string().guid(),
    "ticketId": z.string(),
    "referenceSource": z.string(),
    "method": z.string(),
    "consentState": z.string(),
    "outcome": z.string(),
    "notAttemptedReason": z.string().nullable(),
    "livenessScoreBp": z.number().nullable(),
    "matchScoreBp": z.number().nullable(),
    "modelId": z.string().nullable(),
    "modelVersion": z.string().nullable(),
    "thresholdPolicyVersion": z.string(),
    "mode": z.literal('ADVISORY'),
    "capturedAt": z.string(),
    "receivedAt": z.string(),
    "manualIdentity": z
    .strictObject({
      "reasonCode": z.string(),
      "confirmedAt": z.string(),
    }).nullable(),
  });

export const BiometricEvidenceOkSchema = z
  .strictObject({
    "applicationId": z.string().guid(),
    "evidence": z.array(BiometricEvidenceRowSchema),
  });

/**
 * NOTE: no `agency` on the envelope — the rows are cross-agency.
 */
export const ByApplicantOkSchema = z
  .strictObject({
    "applications": z.array(ApplicantApplicationSummarySchema),
  });

/**
 * HttpError body for a 4xx campaign command. The code set is OPEN: the
 * campaign write functions raise P0001 with a leading code token, and the
 * repository forwards that token as `error`. Branch on the codes the UI
 * knows and show `detail` (always present below 500) for the rest.
 */
export const CampaignCommandRejectionSchema = z
  .strictObject({
    "error": z.string().regex(/^[A-Z][A-Z0-9_]+$/),
    "detail": z.string().optional(),
  });

/**
 * Canonical upper-case public code as stored.
 */
export const CampaignPublicCodeSchema = z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,63}$/);

export const CampaignDraftCreated201Schema = z
  .strictObject({
    "status": z.literal('DRAFT_CREATED'),
    "publicCode": CampaignPublicCodeSchema,
    "campaignStatus": z.literal('DRAFT'),
  });

/**
 * Trimmed and upper-cased by the backend before validation, so lower case is
 * accepted on input. The LEGACY- prefix is reserved and accepted only by
 * completeCampaign.
 */
export const CampaignPublicCodeInputSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/);

/**
 * normalizeCampaignDraft: exact keys, unknown keys are 400 INVALID_REQUEST.
 * Timestamps need an explicit timezone; dates are YYYY-MM-DD. Arrays are
 * de-duplicated by rejection, not silently.
 */
export const CampaignDraftRequestSchema = z
  .strictObject({
    "publicCode": CampaignPublicCodeInputSchema,
    "campaignLabel": z.string().min(1).max(50),
    "targetCategories": z.array(ApplicationCategorySchema).min(1).max(10),
    "targetDistricts": z.array(z.string().min(1)).min(1).max(30),
    "registrationOpensAt": z.string(),
    "registrationClosesAt": z.string(),
    "examinationStartDate": z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    "examinationEndDate": z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    "examinationReportingHour": z.number(),
    "allowsWalkIn": z.boolean(),
    "targetIntakeCount": z.number().nullable().optional(),
    "contactPhoneNumbers": z.array(z.string().min(1).max(40)).max(10).optional(),
    "contactWebsite": z.string().max(100).nullable().optional(),
  });

/**
 * Detail withheld above 499, as for ApplicationError500.
 */
export const CampaignError500Schema = z
  .strictObject({
    "error": z.enum(['CAMPAIGN_READ_ERROR', 'CAMPAIGN_PERSISTENCE_ERROR', 'INTERNAL_ERROR']),
  });

/**
 * status and campaignStatus always carry the same value.
 */
export const CampaignLifecycle200Schema = z
  .strictObject({
    "status": z.enum(['REGISTRATION_CLOSED', 'COMPLETED', 'CANCELLED']),
    "publicCode": CampaignPublicCodeSchema,
    "campaignStatus": z.enum(['REGISTRATION_CLOSED', 'COMPLETED', 'CANCELLED']),
  });

/**
 * normalizeCampaignPolicy. policyDocument is keyed by ApplicationCategory
 * and must cover exactly the campaign's target categories. Each entry has
 * the exact keys age {minimumAge, maximumAge, referenceDate}, education
 * {mode, threshold}, criminalThreshold, requiredDocumentTypes, medicalMode
 * and legalBasis {code, reference}; the entries are modelled as an open
 * record here because the key set is per campaign, and the backend validates
 * every entry field by field.
 */
export const CampaignPolicyRequestSchema = z
  .strictObject({
    "publicCode": CampaignPublicCodeInputSchema,
    "policyDocument": z.record(z.string(), z.unknown()),
    "legalBasisCode": z.string().min(1).max(64),
    "legalBasisReference": z.string().min(1).max(256),
  });

export const Sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const CampaignPolicyVersionCreated201Schema = z
  .strictObject({
    "status": z.literal('POLICY_VERSION_CREATED'),
    "publicCode": CampaignPublicCodeSchema,
    "policyVersion": z.number(),
    "policyHash": Sha256HexSchema,
  });

/**
 * Exactly one key. Used by publish, close, complete and cancel.
 */
export const CampaignPublicCodeCommandSchema = z
  .strictObject({
    "publicCode": CampaignPublicCodeInputSchema,
  });

export const CampaignPublished200Schema = z
  .strictObject({
    "status": z.literal('CAMPAIGN_PUBLISHED'),
    "publicCode": CampaignPublicCodeSchema,
    "campaignStatus": z.literal('REGISTRATION_OPEN'),
    "policyVersion": z.number(),
    "coverageVersion": z.number(),
    "coverageHash": Sha256HexSchema,
  });

export const DocumentChecklistItemSchema = z
  .strictObject({
    "documentType": z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    "satisfaction": z.enum(['API_VERIFIED', 'UPLOADED_CLEARED', 'VENUE_VERIFIED', 'AWAITING_REGISTRY', 'UNDER_REVIEW', 'REJECTED', 'MISSING']),
    "registry": z.string().nullable(),
  });

/**
 * ADVISORY (ADR-032): never a gate. Types, states and the verifying registry
 * only — no forensic score, flag, object key or officer id.
 */
export const DocumentChecklist200Schema = z
  .strictObject({
    "agency": AgencySchema,
    "source": z.enum(['POLICY_VERSION', 'GROUND_TRUTH_TABLE']),
    "complete": z.boolean(),
    "items": z.array(DocumentChecklistItemSchema),
  });

/**
 * ADR-034. Present only in state ADMITTED: where and when the single-use QR
 * was spent.
 */
export const ExamInvitationAdmissionSchema = z
  .strictObject({
    "venueName": z.string(),
    "admittedAt": z.string(),
  });

export const ExamInvitationPayloadSchema = z
  .strictObject({
    "qrPayload": z.string().max(4096).regex(/^USRP-SLOT\.v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
    "ticketId": z.string(),
    "venueName": z.string(),
    "examDate": z.string(),
    "reportingTimeHour": z.number(),
    "validUntil": z.string(),
  });

/**
 * ADR-033. The invitation travels ONLY in the READY state. qrPayload is the
 * signed slot invitation (USRP-SLOT.v1…), PII-free by construction
 * (ADR-009), verified offline at the venue.
 */
export const ExamInvitationViewSchema = z
  .strictObject({
    "state": z.enum(['READY', 'ADMITTED', 'PENDING', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'EXPIRED', 'UNAVAILABLE', 'WALK_IN']),
    "agency": AgencySchema,
    "processingCode": z.string(),
    "campaignLabel": z.string().nullable(),
    "currentStatus": z.string(),
    "invitation": ExamInvitationPayloadSchema.optional(),
    "admission": ExamInvitationAdmissionSchema.optional(),
  });

export const FinalDecisionRequestSchema = z
  .strictObject({
    "applicationId": UuidSchema,
    "decision": z.enum(['SHORTLIST', 'REJECT']),
    "notes": z.string().max(1000).nullable().optional(),
  });

export const FindApplicationOkSchema = z
  .strictObject({
    "agency": AgencySchema,
    "application": ApplicationDetailSchema,
  });

/**
 * Authenticated, wrong principal kind. NOT a discriminated union with the
 * other 403 shapes in the platform: withAuth emits { error, detail },
 * outcome branches emit { error } alone, and biometric-service emits {
 * status: AGENCY_MISMATCH }. Three incompatible bodies for one status is a
 * live platform inconsistency, recorded rather than smoothed over.
 */
export const Forbidden403Schema = z
  .strictObject({
    "error": z.literal('FORBIDDEN'),
    "detail": z.string().optional(),
  });

/**
 * The candidate as the gate officer needs them: public identifiers only.
 */
export const GateDecisionCandidateSchema = z
  .strictObject({
    "applicationId": z.string().guid(),
    "processingCode": z.string().min(1).max(32),
    "category": z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  });

export const GateDecisionAdmitted200Schema = z
  .strictObject({
    "outcome": z.literal('ADMITTED'),
    "candidate": GateDecisionCandidateSchema,
    "venueName": z.string().min(1).max(200),
    "examDate": z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    "reportingTimeHour": z.number(),
    "admittedAt": z.string(),
    "statusAdvanced": z.boolean(),
  });

/**
 * The QR was already spent. Checked before venue and day, so a copied
 * screenshot is a duplicate at any gate.
 */
export const GateDecisionAlreadyAdmitted409Schema = z
  .strictObject({
    "error": z.literal('ALREADY_ADMITTED'),
    "candidate": GateDecisionCandidateSchema,
    "admittedAt": z.string(),
    "venueName": z.string(),
    "admittedBySelf": z.boolean(),
  });

/**
 * The national ID on the card is not this applicant's. Audited.
 */
export const GateDecisionIdentityMismatch409Schema = z
  .strictObject({
    "error": z.literal('IDENTITY_MISMATCH'),
    "candidate": GateDecisionCandidateSchema,
  });

export const GateDecisionNotAdmissible409Schema = z
  .strictObject({
    "error": z.literal('NOT_ADMISSIBLE'),
    "candidate": GateDecisionCandidateSchema,
    "currentStatus": z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  });

/**
 * TOO_EARLY or EXPIRED: today in Africa/Kigali is not the exam day.
 */
export const GateDecisionWrongDay409Schema = z
  .strictObject({
    "error": z.enum(['TOO_EARLY', 'EXPIRED']),
    "examDate": z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  });

export const GateDecisionWrongVenue409Schema = z
  .strictObject({
    "error": z.literal('WRONG_VENUE'),
    "ticketVenueName": z.string(),
  });

export const GateDecisionConflict409Schema = z.union([
  GateDecisionAlreadyAdmitted409Schema,
  GateDecisionNotAdmissible409Schema,
  GateDecisionIdentityMismatch409Schema,
  GateDecisionWrongVenue409Schema,
  GateDecisionWrongDay409Schema,
]);

/**
 * The QR is not a ticket of this agency: malformed, another agency's,
 * unknown, or not the stored (signed) token.
 */
export const GateDecisionInvalidTicket422Schema = z
  .strictObject({
    "error": z.literal('INVALID_TICKET'),
    "reason": z.enum(['MALFORMED_TICKET', 'WRONG_AGENCY', 'UNKNOWN_TICKET', 'TICKET_NOT_ISSUED']),
  });

export const IdentityNotVerified409Schema = z
  .strictObject({
    "status": z.literal('IDENTITY_NOT_VERIFIED'),
  });

export const InvalidAcademicInput422Schema = z
  .strictObject({
    "status": z.literal('INVALID_ACADEMIC_INPUT'),
    "reason": z.string(),
  });

export const InvalidApplicantId400Schema = z
  .strictObject({
    "error": z.literal('INVALID_APPLICANT_ID'),
    "detail": z.string().optional(),
  });

export const InvalidApplicationId400Schema = z
  .strictObject({
    "error": z.literal('INVALID_APPLICATION_ID'),
    "detail": z.string().optional(),
  });

export const InvalidMedicalInput422Schema = z
  .strictObject({
    "status": z.literal('INVALID_MEDICAL_INPUT'),
    "reason": z.string(),
  });

export const InvalidRequest400Schema = z
  .strictObject({
    "error": z.literal('INVALID_REQUEST'),
    "detail": z.string().optional(),
  });

export const ListApplicationsOkSchema = z
  .strictObject({
    "agency": AgencySchema,
    "applications": z.array(ApplicationSummarySchema).max(100),
  });

export const ManualIdentityOkSchema = z
  .strictObject({
    "status": z.literal('CONFIRMED'),
    "confirmationId": z.string(),
    "recordId": z.string().guid(),
    "confirmedAt": z.string(),
  });

export const ManualIdentityRequestSchema = z
  .strictObject({
    "recordId": z.string().guid(),
    "reasonCode": z.string(),
  });

/**
 * THE TWO MODES ARE MUTUALLY EXCLUSIVE IN PRACTICE but the wire accepts
 * either, and OpenAPI cannot express "whichever your agency uses" because
 * the agency comes from the token. Sending neither is 400; sending the wrong
 * one for your agency is 422.
 */
export const MedicalReviewRequestSchema = z
  .strictObject({
    "applicationId": UuidSchema,
    "fitnessStatus": z.enum(['FIT', 'UNFIT']).optional(),
    "certVerdict": z.enum(['CERT_VERIFIED', 'CERT_REJECTED']).optional(),
    "physicianName": z.string().optional(),
  });

export const MedicalReviewRequest400Schema = z
  .strictObject({
    "error": z.enum(['MISSING_APPLICATION_ID', 'INVALID_APPLICATION_ID', 'INVALID_FITNESS_STATUS', 'INVALID_CERT_VERDICT', 'INVALID_PHYSICIAN_NAME', 'MISSING_MEDICAL_VERDICT']),
    "detail": z.string().optional(),
  });

export const NoOpenCampaign409Schema = z
  .strictObject({
    "status": z.literal('NO_OPEN_CAMPAIGN'),
    "agency": AgencySchema,
  });

export const NoWalkInCampaign409Schema = z
  .strictObject({
    "status": z.literal('NO_WALK_IN_CAMPAIGN'),
    "agency": AgencySchema,
  });

/**
 * THE READ ROUTES' 404, KEYED ON `error` — not `status` like the write
 * routes' NOT_FOUND. Same word, different key, same service. A client cannot
 * use one guard for both.
 */
export const NotFound404Schema = z
  .strictObject({
    "error": z.literal('NOT_FOUND'),
  });

/**
 * Consumed by no S06 screen; shape asserted from edge-v1.yaml, not re-read
 * from the controller.
 */
export const OpaqueAdminReadSchema = z.record(z.string(), z.unknown());

export const OperationalReadErrorSchema = z
  .strictObject({
    "error": z.enum(['INVALID_REQUEST', 'INVALID_PUBLIC_CODE', 'NOT_FOUND', 'PERMISSION_DENIED', 'UNAUTHENTICATED', 'NOT_REQUIRED', 'ALREADY_CONFIRMED', 'SAME_OFFICER']),
    "detail": z.string().optional(),
  });

export const PublicCategoryEligibilitySchema = z
  .strictObject({
    "ageBands": z.array(z
    .strictObject({
      "qualifications": z.array(z.string()),
      "minimumAge": z.number(),
      "maximumAge": z.number(),
    })),
    "educationAlternatives": z.array(z
    .strictObject({
      "level": z.string(),
    })),
    "minimumSciencePercent": z.number().nullable(),
  });

/**
 * The approved public projection. Nothing internal.
 */
export const PublicCampaignSchema = z
  .strictObject({
    "publicCode": z.string(),
    "campaignLabel": z.string(),
    "agency": AgencySchema,
    "status": z.string(),
    "registrationOpensAt": z.string(),
    "registrationClosesAt": z.string(),
    "examinationStartDate": z.string(),
    "examinationEndDate": z.string(),
    "targetCategories": z.array(ApplicationCategorySchema).max(10),
    "targetDistricts": z.array(z.string()).max(30),
    "allowsWalkIn": z.boolean(),
    "contactPhoneNumbers": z.array(z.string()).max(10).nullable(),
    "contactWebsite": z.string().nullable(),
    "eligibility": z.record(z.string(), z.unknown()).optional(),
  });

export const PublicCampaignDetail200Schema = z
  .strictObject({
    "campaign": PublicCampaignSchema,
  });

export const PublicCampaignList200Schema = z
  .strictObject({
    "campaigns": z.array(PublicCampaignSchema),
  });

/**
 * One entry of the immutable trail. This is the record a rejected applicant
 * is entitled to see reasons from, so every field answering "who changed
 * what, when, and why" is carried. actorKind is DERIVED so the UI can
 * distinguish a human step from an automated one without string-matching
 * 'SYSTEM' in three components.
 */
export const StatusHistoryEntrySchema = z
  .strictObject({
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
  });

export const StatusHistoryOkSchema = z
  .strictObject({
    "agency": AgencySchema,
    "applicationId": UuidSchema,
    "history": z.array(StatusHistoryEntrySchema),
  });

export const SubmitApplicationRequestSchema = z
  .strictObject({
    "applicantId": UuidSchema,
    "category": ApplicationCategorySchema,
    "channel": ApplicationChannelSchema,
    "nesaIndexNumber": z.string().nullable().optional(),
    "hecRegistrationNumber": z.string().nullable().optional(),
  });

export const SubmitConflict409Schema = z.discriminatedUnion('status', [
  IdentityNotVerified409Schema,
  NoOpenCampaign409Schema,
]);

export const SubmitRequest400Schema = z
  .strictObject({
    "error": z.enum(['MISSING_APPLICANT_ID', 'INVALID_APPLICANT_ID', 'INVALID_CATEGORY', 'INVALID_CHANNEL', 'INVALID_FIELD']),
    "detail": z.string().optional(),
  });

/**
 * The shared APPLIED body for medical-review, final-decision, accept and
 * adjudicate. NOTE WHAT IT IS NOT: it is not an application object. There is
 * no way to write and read back in one call — refetch by-id afterwards.
 */
export const TransitionAppliedSchema = z
  .strictObject({
    "status": z.literal('APPLIED'),
    "fromStatus": ApplicationStatusSchema,
    "toStatus": ApplicationStatusSchema,
  });

/**
 * Idempotent success. The demanded end-state already held.
 */
export const TransitionNoChangeSchema = z
  .strictObject({
    "status": z.literal('NO_CHANGE'),
    "currentStatus": ApplicationStatusSchema,
  });

/**
 * Bare. Identical for another agency's real application.
 */
export const TransitionNotFound404Schema = z
  .strictObject({
    "status": z.literal('NOT_FOUND'),
  });

/**
 * Two bodies on one status code, discriminated on `status`.
 */
export const TransitionOk200Schema = z.discriminatedUnion('status', [
  TransitionAppliedSchema,
  TransitionNoChangeSchema,
]);

export const TransitionRequest400Schema = z
  .strictObject({
    "error": z.enum(['MISSING_APPLICATION_ID', 'INVALID_APPLICATION_ID', 'INVALID_DECISION', 'INVALID_NOTES']),
    "detail": z.string().optional(),
  });

/**
 * The Ed25519 bearer kinds fail with this. identity-service's
 * applicant-session routes fail with INVALID_SESSION instead — same status,
 * different code, different service.
 */
export const Unauthenticated401Schema = z
  .strictObject({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
  });

/**
 * RDF-only lane. An honest 501 rather than a raw DB enum error, because
 * rdf_ops is the only schema modelling WALK_IN_*.
 */
export const UnsupportedAgency501Schema = z
  .strictObject({
    "status": z.literal('UNSUPPORTED_AGENCY'),
    "agency": AgencySchema,
  });

export const VenueLiveCountsSchema = z
  .strictObject({
    "agency": z.enum(['RDF', 'RNP', 'RCS']),
    "venue": z
    .strictObject({
      "venueName": z.string(),
      "district": z.string(),
      "examDate": z.string(),
    }),
    "counts": z
    .strictObject({
      "expected": z.number(),
      "admitted": z.number(),
      "physicalCaptured": z.number(),
      "medicalRecorded": z.number(),
      "openConflicts": z.number(),
    }),
    "asOf": z.string(),
  });

export const VerifyAtVenue200Schema = z
  .strictObject({
    "status": z.enum(['RECORDED', 'ALREADY_RECORDED']),
    "checklist": DocumentChecklist200Schema,
  });

export const VerifyAtVenueRequestSchema = z
  .strictObject({
    "applicationId": UuidSchema,
    "documentType": z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
  });

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
  .strictObject({
    "applicantId": UuidSchema,
    "category": ApplicationCategorySchema,
    "nesaIndexNumber": z.string().nullable().optional(),
    "hecRegistrationNumber": z.string().nullable().optional(),
  });

/**
 * THE UN-UNDERSCORED SPELLINGS ARE NOT A TYPO IN THIS DOCUMENT. The
 * controller builds these codes with `MISSING_${field.toUpperCase()}`, so
 * applicantId becomes APPLICANTID. Recorded verbatim.
 */
export const WalkInRegisterRequest400Schema = z
  .strictObject({
    "error": z.enum(['MISSING_APPLICANTID', 'INVALID_APPLICANTID', 'INVALID_CATEGORY', 'INVALID_NESAINDEXNUMBER', 'INVALID_HECREGISTRATIONNUMBER']),
    "detail": z.string().optional(),
  });

export const WrongAgencyCategory422Schema = z
  .strictObject({
    "status": z.literal('WRONG_AGENCY_CATEGORY'),
    "categoryAgency": AgencySchema,
  });

export const WalkInRegisterUnprocessable422Schema = z.discriminatedUnion('status', [
  WrongAgencyCategory422Schema,
  InvalidAcademicInput422Schema,
]);

export const WalkInRegistered201Schema = z
  .strictObject({
    "status": z.literal('REGISTERED'),
    "applicationId": UuidSchema,
    "processingCode": z.string(),
    "qrInvitationCode": z.string(),
  });

/**
 * Carries an extra ageStatus the other three transitions do not.
 */
export const WalkInVetAppliedSchema = z
  .strictObject({
    "status": z.literal('APPLIED'),
    "fromStatus": ApplicationStatusSchema,
    "toStatus": ApplicationStatusSchema,
    "ageStatus": z.string(),
  });

export const WalkInVetConflict409Schema = z.discriminatedUnion('status', [
  AgePending409Schema,
  NotApplicable409Schema,
]);

export const WalkInVetOk200Schema = z.discriminatedUnion('status', [
  WalkInVetAppliedSchema,
  TransitionNoChangeSchema,
]);

export const WalkInVetRequestSchema = z
  .strictObject({
    "applicationId": UuidSchema,
  });

export const WalkInVetRequest400Schema = z
  .strictObject({
    "error": z.enum(['MISSING_APPLICATIONID', 'INVALID_APPLICATIONID']),
    "detail": z.string().optional(),
  });

export const WithdrawOwnNoChange200Schema = z
  .strictObject({
    "status": z.literal('NO_CHANGE'),
    "agency": AgencySchema,
  });

export const WithdrawOwnNotApplicable409Schema = z
  .strictObject({
    "status": z.literal('NOT_APPLICABLE'),
    "agency": AgencySchema,
    "currentStatus": ApplicationStatusSchema,
  });

export const WithdrawnOwn200Schema = z
  .strictObject({
    "status": z.literal('WITHDRAWN'),
    "agency": AgencySchema,
    "fromStatus": ApplicationStatusSchema,
  });

export const WithdrawOwnOk200Schema = z.discriminatedUnion('status', [
  WithdrawnOwn200Schema,
  WithdrawOwnNoChange200Schema,
]);

/**
 * BOTH ids. Ownership is the row lookup; either mismatch is one 404.
 */
export const WithdrawOwnRequestSchema = z
  .strictObject({
    "applicantId": UuidSchema,
    "applicationId": UuidSchema,
  });

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this package is not documented to
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
  "listPublicCampaigns": {
    method: "GET",
    path: "/v1/campaigns",
    auth: ["none"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": PublicCampaignList200Schema,
      "500": CampaignError500Schema,
    },
  },
  "createCampaign": {
    method: "POST",
    path: "/v1/campaigns",
    auth: ["officer"],
    reach: "browser",
    request: CampaignDraftRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "201": CampaignDraftCreated201Schema,
      "400": CampaignCommandRejectionSchema,
      "401": Unauthenticated401Schema,
      "403": CampaignCommandRejectionSchema,
      "409": CampaignCommandRejectionSchema,
      "422": CampaignCommandRejectionSchema,
      "500": CampaignError500Schema,
    },
  },
  "getPublicCampaign": {
    method: "GET",
    path: "/v1/campaigns/detail",
    auth: ["none"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["publicCode"],
    responses: {
      "200": PublicCampaignDetail200Schema,
      "400": null,
      "404": null,
      "500": CampaignError500Schema,
    },
  },
  "createCampaignPolicy": {
    method: "POST",
    path: "/v1/campaigns/policy",
    auth: ["officer"],
    reach: "browser",
    request: CampaignPolicyRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "201": CampaignPolicyVersionCreated201Schema,
      "400": CampaignCommandRejectionSchema,
      "401": Unauthenticated401Schema,
      "403": CampaignCommandRejectionSchema,
      "404": CampaignCommandRejectionSchema,
      "409": CampaignCommandRejectionSchema,
      "422": CampaignCommandRejectionSchema,
      "500": CampaignError500Schema,
    },
  },
  "publishCampaign": {
    method: "POST",
    path: "/v1/campaigns/publish",
    auth: ["officer"],
    reach: "browser",
    request: CampaignPublicCodeCommandSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": CampaignPublished200Schema,
      "400": CampaignCommandRejectionSchema,
      "401": Unauthenticated401Schema,
      "403": CampaignCommandRejectionSchema,
      "404": CampaignCommandRejectionSchema,
      "409": CampaignCommandRejectionSchema,
      "422": CampaignCommandRejectionSchema,
      "500": CampaignError500Schema,
    },
  },
  "closeCampaignRegistration": {
    method: "POST",
    path: "/v1/campaigns/registration-close",
    auth: ["officer"],
    reach: "browser",
    request: CampaignPublicCodeCommandSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": CampaignLifecycle200Schema,
      "400": CampaignCommandRejectionSchema,
      "401": Unauthenticated401Schema,
      "403": CampaignCommandRejectionSchema,
      "404": CampaignCommandRejectionSchema,
      "409": CampaignCommandRejectionSchema,
      "500": CampaignError500Schema,
    },
  },
  "completeCampaign": {
    method: "POST",
    path: "/v1/campaigns/complete",
    auth: ["officer"],
    reach: "browser",
    request: CampaignPublicCodeCommandSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": CampaignLifecycle200Schema,
      "400": CampaignCommandRejectionSchema,
      "401": Unauthenticated401Schema,
      "403": CampaignCommandRejectionSchema,
      "404": CampaignCommandRejectionSchema,
      "409": CampaignCommandRejectionSchema,
      "500": CampaignError500Schema,
    },
  },
  "cancelCampaign": {
    method: "POST",
    path: "/v1/campaigns/cancel",
    auth: ["officer"],
    reach: "browser",
    request: CampaignPublicCodeCommandSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": CampaignLifecycle200Schema,
      "400": CampaignCommandRejectionSchema,
      "401": Unauthenticated401Schema,
      "403": CampaignCommandRejectionSchema,
      "404": CampaignCommandRejectionSchema,
      "409": CampaignCommandRejectionSchema,
      "500": CampaignError500Schema,
    },
  },
  "decideGateAdmission": {
    method: "POST",
    path: "/v1/applications/admissions/gate",
    auth: ["officer"],
    reach: "service-internal",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": GateDecisionAdmitted200Schema,
      "400": null,
      "401": null,
      "403": null,
      "409": GateDecisionConflict409Schema,
      "422": GateDecisionInvalidTicket422Schema,
      "500": ApplicationError500Schema,
    },
  },
  "getExamInvitationByApplicant": {
    method: "GET",
    path: "/v1/applications/exam-invitation/by-applicant",
    auth: ["system"],
    reach: "service-internal",
    request: null,
    requestMediaType: null,
    query: ["applicantId","applicationId"],
    responses: {
      "200": ExamInvitationViewSchema,
      "400": null,
      "403": null,
      "404": null,
    },
  },
  "getDocumentChecklist": {
    method: "GET",
    path: "/v1/applications/document-checklist",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["applicationId"],
    responses: {
      "200": DocumentChecklist200Schema,
      "400": null,
      "401": Unauthenticated401Schema,
      "403": null,
      "404": null,
      "500": ApplicationError500Schema,
    },
  },
  "getDocumentChecklistByApplicant": {
    method: "GET",
    path: "/v1/applications/document-checklist/by-applicant",
    auth: ["system"],
    reach: "service-internal",
    request: null,
    requestMediaType: null,
    query: ["applicantId","applicationId"],
    responses: {
      "200": DocumentChecklist200Schema,
      "400": null,
      "403": null,
      "404": null,
    },
  },
  "verifyDocumentAtVenue": {
    method: "POST",
    path: "/v1/applications/documents/verify-at-venue",
    auth: ["officer"],
    reach: "browser",
    request: VerifyAtVenueRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": VerifyAtVenue200Schema,
      "400": null,
      "403": null,
      "404": null,
      "409": null,
      "422": null,
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
  "attachClearanceCertificateOwn": {
    method: "POST",
    path: "/v1/applications/clearance-certificate-own",
    auth: ["system"],
    reach: "service-internal",
    request: AttachClearanceOwnRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": AttachClearanceOk200Schema,
      "202": AttachClearanceOk200Schema,
      "400": InvalidRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": TransitionNotFound404Schema,
      "409": AttachClearanceNotApplicable409Schema,
      "422": AttachClearanceInvalidNumber422Schema,
      "500": ApplicationError500Schema,
      "501": AttachClearanceNotEnabled501Schema,
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
  "searchApplications": {
    method: "GET",
    path: "/v1/applications/search",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["status","category","campaign","district","submittedFrom","submittedTo","limit","cursor"],
    responses: {
      "200": ApplicationSearchOkSchema,
      "400": OperationalReadErrorSchema,
      "401": OperationalReadErrorSchema,
      "403": OperationalReadErrorSchema,
      "404": OperationalReadErrorSchema,
    },
  },
  "getBiometricEvidence": {
    method: "GET",
    path: "/v1/applications/biometric-evidence",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["applicationId"],
    responses: {
      "200": BiometricEvidenceOkSchema,
      "400": OperationalReadErrorSchema,
      "401": OperationalReadErrorSchema,
      "403": OperationalReadErrorSchema,
      "404": OperationalReadErrorSchema,
    },
  },
  "confirmManualIdentity": {
    method: "POST",
    path: "/v1/applications/biometric-evidence/manual-identity",
    auth: ["officer"],
    reach: "browser",
    request: ManualIdentityRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "201": ManualIdentityOkSchema,
      "400": OperationalReadErrorSchema,
      "401": OperationalReadErrorSchema,
      "403": OperationalReadErrorSchema,
      "404": OperationalReadErrorSchema,
      "409": OperationalReadErrorSchema,
    },
  },
  "adminCampaignList": {
    method: "GET",
    path: "/v1/campaigns/admin",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["q","status","limit","cursor"],
    responses: {
      "200": OpaqueAdminReadSchema,
      "400": OperationalReadErrorSchema,
      "401": OperationalReadErrorSchema,
      "403": OperationalReadErrorSchema,
      "404": OperationalReadErrorSchema,
    },
  },
  "adminCampaignDetail": {
    method: "GET",
    path: "/v1/campaigns/admin/detail",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["publicCode"],
    responses: {
      "200": OpaqueAdminReadSchema,
      "400": OperationalReadErrorSchema,
      "401": OperationalReadErrorSchema,
      "403": OperationalReadErrorSchema,
      "404": OperationalReadErrorSchema,
    },
  },
  "venueRoster": {
    method: "GET",
    path: "/v1/venue-roster",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["campaign","district","examDate"],
    responses: {
      "200": OpaqueAdminReadSchema,
      "400": OperationalReadErrorSchema,
      "401": OperationalReadErrorSchema,
      "403": OperationalReadErrorSchema,
      "404": OperationalReadErrorSchema,
    },
  },
  "venueLiveCounts": {
    method: "GET",
    path: "/v1/venue-live-counts",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: ["campaign","district","examDate"],
    responses: {
      "200": VenueLiveCountsSchema,
      "400": OperationalReadErrorSchema,
      "401": OperationalReadErrorSchema,
      "403": OperationalReadErrorSchema,
      "404": OperationalReadErrorSchema,
    },
  },
} as const;
