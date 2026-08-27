// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/identity-service.yaml                     ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
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
//   POST /v1/applicants/auth/otp/request                none               browser
//   POST /v1/applicants/auth/otp/verify                 none               browser
//   POST /v1/applicants/auth/logout                     applicant-session  browser
//   GET  /v1/applicants/me/applications                 applicant-session  browser
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
    "error": z.enum(['INVALID_REQUEST', 'INVALID_CHANNEL', 'INVALID_NATIONAL_ID']),
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

export const Forbidden403Schema = z
  .object({
    "error": z.literal('FORBIDDEN'),
    "detail": z.string().optional(),
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

export const OtpChallenged202Schema = z
  .object({
    "status": z.literal('CHALLENGED'),
  }).strict();

/**
 * REQUEST-ONLY. This schema is referenced by request bodies and by NO
 * response in this document. If it ever appears under a response, that is
 * the bug invariant 2 exists to catch.
 */
export const RawNationalIdSchema = z.string().min(1).max(32);

export const OtpRequestBodySchema = z
  .object({
    "nationalId": RawNationalIdSchema,
    "channel": ApplicationChannelSchema,
  }).strict();

export const OtpVerifyBodySchema = z
  .object({
    "nationalId": RawNationalIdSchema,
    "otp": z.string().min(1).max(12),
    "channel": ApplicationChannelSchema,
  }).strict();

/**
 * The JWT kinds. Citizen sessions fail INVALID_SESSION instead.
 */
export const Unauthenticated401Schema = z
  .object({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
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
 * A status ABSENT from a map is a status this service is not documented to
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
