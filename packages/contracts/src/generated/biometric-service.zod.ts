// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/biometric-service.yaml                    ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/biometric-service.yaml instead.  ║
// ╚══════════════════════════════════════════════════════════════╝

//
// USRP biometric-service
//
// Route table (method, path, auth kinds, reach):
//   POST /v1/biometric/verify                           officer            browser
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//
// `.strict()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

/**
 * The application belongs to another agency. UNIQUE IN THE PLATFORM for
 * keying a 403 on `status` rather than `error`.
 */
export const AgencyMismatch403Schema = z
  .object({
    "status": z.literal('AGENCY_MISMATCH'),
  }).strict();

export const UuidSchema = z.string().uuid().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

export const BiometricEvaluatedSchema = z
  .object({
    "status": z.literal('EVALUATED'),
    "verified": z.boolean(),
    "sessionId": UuidSchema,
    "applicantId": UuidSchema,
    "livenessPass": z.boolean(),
    "faceMatchPass": z.boolean(),
  }).strict();

export const Forbidden403Schema = z
  .object({
    "error": z.literal('FORBIDDEN'),
    "detail": z.string().optional(),
  }).strict();

/**
 * NOT a discriminated union — the two members have no property in common. A
 * client must probe for `error` OR `status`. That is the live inconsistency,
 * faithfully modelled.
 */
export const BiometricForbidden403Schema = z.union([
  Forbidden403Schema,
  AgencyMismatch403Schema,
]);

export const BiometricRequest400Schema = z
  .object({
    "error": z.enum(['MISSING_QR_TOKEN', 'MISSING_CAPTURE_REF']),
    "detail": z.string().optional(),
  }).strict();

export const InternalError500Schema = z
  .object({
    "error": z.literal('INTERNAL_ERROR'),
  }).strict();

export const InvalidInvitation422Schema = z
  .object({
    "status": z.literal('INVALID_INVITATION'),
  }).strict();

export const MatcherUnavailable503Schema = z
  .object({
    "error": z.literal('BIOMETRIC_MATCH_UNAVAILABLE'),
  }).strict();

export const Unauthenticated401Schema = z
  .object({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
  }).strict();

export const VerifyBiometricRequestSchema = z
  .object({
    "qrSignedToken": z.string().min(1),
    "captureRef": z.string().min(1),
  }).strict();

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this service is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const biometricServiceOperations = {
  "verifyBiometric": {
    method: "POST",
    path: "/v1/biometric/verify",
    auth: ["officer"],
    reach: "browser",
    request: VerifyBiometricRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": BiometricEvaluatedSchema,
      "400": BiometricRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": BiometricForbidden403Schema,
      "422": InvalidInvitation422Schema,
      "500": InternalError500Schema,
      "503": MatcherUnavailable503Schema,
    },
  },
  "biometricHealth": {
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
  "biometricReady": {
    method: "GET",
    path: "/ready",
    auth: ["none"],
    reach: "service-internal",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": null,
    },
  },
} as const;
