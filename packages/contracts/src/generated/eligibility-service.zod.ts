// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/eligibility-service.yaml                  ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/eligibility-service.yaml instead.║
// ╚══════════════════════════════════════════════════════════════╝

//
// USRP eligibility-service
//
// Route table (method, path, auth kinds, reach):
//   POST /v1/eligibility/age-check                      system             service-internal
//   POST /v1/eligibility/education-check                system             service-internal
//   POST /v1/eligibility/degree-check                   system             service-internal
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//
// `.strict()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

/**
 * Transcribed as a string, not an enum: the controller returns
 * requiredMinLevel and evaluatedLevel straight from the domain and this
 * document does not have the domain enum in hand at controller level.
 * Narrowing it would be a guess.
 */
export const AcademicLevelSchema = z.string();

/**
 * Validated against ALL_CATEGORIES (domain/category-agency.ts), the union
 * across all three agencies. WHICH categories belong to WHICH agency is NOT
 * expressible here and is not a free choice: agencyForCategory maps each
 * category to exactly one agency, and sending a category that maps elsewhere
 * is 422 WRONG_AGENCY_CATEGORY on the write side. Typed as string because
 * the per-agency partition is the divergence model's job.
 */
export const ApplicationCategorySchema = z.string().min(1);

export const UuidSchema = z.string().uuid().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

export const AgeCheckRequestSchema = z
  .object({
    "applicantId": UuidSchema,
    "category": ApplicationCategorySchema,
  }).strict();

export const AgencySchema = z.enum(['RDF', 'RNP', 'RCS']);

export const AgeEvaluatedSchema = z
  .object({
    "status": z.literal('EVALUATED'),
    "eligible": z.boolean(),
    "category": ApplicationCategorySchema,
    "agency": AgencySchema,
    "ageAtEvaluation": z.number(),
    "appliedMaxAge": z.number(),
    "reason": z.string().nullable(),
  }).strict();

export const ApplicantNotFound404Schema = z
  .object({
    "status": z.literal('APPLICANT_NOT_FOUND'),
  }).strict();

export const DegreeCheckRequestSchema = z
  .object({
    "applicantId": UuidSchema,
    "applicationId": UuidSchema,
    "category": ApplicationCategorySchema,
    "hecRegistrationNumber": z.string().regex(/^[A-Za-z0-9/-]{4,40}$/),
  }).strict();

export const G2gSubjectUnavailable409Schema = z
  .object({
    "status": z.literal('G2G_SUBJECT_UNAVAILABLE'),
    "detail": z.string(),
  }).strict();

export const HecNotApplicable409Schema = z
  .object({
    "status": z.literal('HEC_NOT_APPLICABLE'),
    "detail": z.string(),
  }).strict();

export const IdentityNotVerified409Schema = z
  .object({
    "status": z.literal('IDENTITY_NOT_VERIFIED'),
    "identityStatus": z.string(),
  }).strict();

export const DegreeConflict409Schema = z.discriminatedUnion('status', [
  IdentityNotVerified409Schema,
  G2gSubjectUnavailable409Schema,
  HecNotApplicable409Schema,
]);

export const DegreeEvaluatedSchema = z
  .object({
    "status": z.literal('EVALUATED'),
    "academicStatus": z.string(),
    "eligible": z.boolean(),
    "category": ApplicationCategorySchema,
    "agency": AgencySchema,
    "requiredMinLevel": AcademicLevelSchema,
    "evaluatedLevel": AcademicLevelSchema,
    "specialistField": z.string().nullable(),
    "appliedMaxAge": z.number().nullable(),
    "ageExceptionApplies": z.boolean(),
    "reason": z.string().nullable(),
  }).strict();

/**
 * The degree exists and is registered to a different person. This is an
 * allegation, not a missing record. UI copy must reflect that difference.
 */
export const DegreeHolderMismatch422Schema = z
  .object({
    "status": z.literal('DEGREE_HOLDER_MISMATCH'),
  }).strict();

export const DegreeNotFound422Schema = z
  .object({
    "status": z.literal('DEGREE_NOT_FOUND'),
  }).strict();

export const HecUnavailable503Schema = z
  .object({
    "error": z.literal('HEC_UNAVAILABLE'),
  }).strict();

export const StoreUnavailable503Schema = z
  .object({
    "error": z.literal('ELIGIBILITY_STORE_UNAVAILABLE'),
  }).strict();

export const DegreeUnavailable503Schema = z.discriminatedUnion('error', [
  HecUnavailable503Schema,
  StoreUnavailable503Schema,
]);

export const DegreeUnprocessable422Schema = z.discriminatedUnion('status', [
  DegreeNotFound422Schema,
  DegreeHolderMismatch422Schema,
]);

export const EducationCheckRequestSchema = z
  .object({
    "applicantId": UuidSchema,
    "applicationId": UuidSchema,
    "category": ApplicationCategorySchema,
    "nesaIndexNumber": z.string().regex(/^[A-Za-z0-9/-]{4,32}$/),
  }).strict();

export const NesaNotApplicable409Schema = z
  .object({
    "status": z.literal('NESA_NOT_APPLICABLE'),
    "detail": z.string(),
  }).strict();

/**
 * A real discriminated union, not a flattened error type.
 */
export const EducationConflict409Schema = z.discriminatedUnion('status', [
  IdentityNotVerified409Schema,
  NesaNotApplicable409Schema,
]);

export const EducationEvaluatedSchema = z
  .object({
    "status": z.literal('EVALUATED'),
    "academicStatus": z.string(),
    "eligible": z.boolean(),
    "category": ApplicationCategorySchema,
    "agency": AgencySchema,
    "requiredMinLevel": AcademicLevelSchema,
    "evaluatedLevel": AcademicLevelSchema,
    "reason": z.string().nullable(),
  }).strict();

export const NesaUnavailable503Schema = z
  .object({
    "error": z.literal('NESA_UNAVAILABLE'),
  }).strict();

export const EducationUnavailable503Schema = z.discriminatedUnion('error', [
  NesaUnavailable503Schema,
  StoreUnavailable503Schema,
]);

/**
 * withAuth and the controllers both key 400s on `error`, not `status`.
 * Business outcomes key on `status`. That split is real and load-bearing: a
 * body with `error` is a transport/shape complaint, a body with `status` is
 * a decision.
 */
export const EligibilityRequest400Schema = z
  .object({
    "error": z.enum(['INVALID_APPLICANT_ID', 'INVALID_APPLICATION_ID', 'INVALID_CATEGORY', 'INVALID_NESA_INDEX', 'INVALID_HEC_REGISTRATION']),
    "detail": z.string().optional(),
  }).strict();

export const Forbidden403Schema = z
  .object({
    "error": z.literal('FORBIDDEN'),
    "detail": z.string().optional(),
  }).strict();

/**
 * Detail is written in source and discarded on the wire for every 5xx.
 */
export const InternalError500Schema = z
  .object({
    "error": z.literal('INTERNAL_ERROR'),
  }).strict();

export const NesaRecordNotFound422Schema = z
  .object({
    "status": z.literal('NESA_RECORD_NOT_FOUND'),
  }).strict();

export const Unauthenticated401Schema = z
  .object({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
  }).strict();

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this service is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const eligibilityServiceOperations = {
  "checkAgeEligibility": {
    method: "POST",
    path: "/v1/eligibility/age-check",
    auth: ["system"],
    reach: "service-internal",
    request: AgeCheckRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": AgeEvaluatedSchema,
      "400": EligibilityRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": ApplicantNotFound404Schema,
      "409": IdentityNotVerified409Schema,
      "500": InternalError500Schema,
      "503": StoreUnavailable503Schema,
    },
  },
  "checkEducationEligibility": {
    method: "POST",
    path: "/v1/eligibility/education-check",
    auth: ["system"],
    reach: "service-internal",
    request: EducationCheckRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": EducationEvaluatedSchema,
      "400": EligibilityRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": ApplicantNotFound404Schema,
      "409": EducationConflict409Schema,
      "422": NesaRecordNotFound422Schema,
      "500": InternalError500Schema,
      "503": EducationUnavailable503Schema,
    },
  },
  "checkDegreeEligibility": {
    method: "POST",
    path: "/v1/eligibility/degree-check",
    auth: ["system"],
    reach: "service-internal",
    request: DegreeCheckRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": DegreeEvaluatedSchema,
      "400": EligibilityRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": ApplicantNotFound404Schema,
      "409": DegreeConflict409Schema,
      "422": DegreeUnprocessable422Schema,
      "500": InternalError500Schema,
      "503": DegreeUnavailable503Schema,
    },
  },
  "eligibilityHealth": {
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
  "eligibilityReady": {
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
