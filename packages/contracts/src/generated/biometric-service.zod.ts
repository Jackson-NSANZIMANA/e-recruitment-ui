// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/biometric-service.yaml                    ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  cd4962842e26177f179eb3c0bd51c214dad3fd61          ║
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
//   GET  /v1/biometric/policy                           officer            browser
//   POST /v1/biometric/evidence                         officer            browser
//
// `z.strictObject()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

/**
 * The application belongs to another agency. UNIQUE IN THE PLATFORM for
 * keying a 403 on `status` rather than `error`.
 */
export const AgencyMismatch403Schema = z
  .strictObject({
    "status": z.literal('AGENCY_MISMATCH'),
  });

/**
 * Not consumed by S06; shape asserted from edge-v1.yaml.
 */
export const BiometricAnySchema = z.record(z.string(), z.unknown());

export const BiometricErrorSchema = z
  .strictObject({
    "error": z.enum(['INVALID_REQUEST', 'INVALID_EVIDENCE', 'IMAGE_PAYLOAD_REFUSED', 'REPLAY_CONFLICT', 'BIOMETRIC_OFF', 'MODE_MISMATCH', 'PERMISSION_DENIED', 'UNAUTHENTICATED']),
    "detail": z.string().optional(),
  });

export const UuidSchema = z.string().guid().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

export const BiometricEvaluatedSchema = z
  .strictObject({
    "status": z.literal('EVALUATED'),
    "verified": z.boolean(),
    "sessionId": UuidSchema,
    "applicantId": UuidSchema,
    "livenessPass": z.boolean(),
    "faceMatchPass": z.boolean(),
  });

/**
 * { record, signature } (ADR-037 §4). Signed on the device; the browser
 * never builds it.
 */
export const BiometricEvidenceEnvelopeSchema = z.record(z.string(), z.unknown());

export const Forbidden403Schema = z
  .strictObject({
    "error": z.literal('FORBIDDEN'),
    "detail": z.string().optional(),
  });

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
  .strictObject({
    "error": z.enum(['MISSING_QR_TOKEN', 'MISSING_CAPTURE_REF']),
    "detail": z.string().optional(),
  });

export const InternalError500Schema = z
  .strictObject({
    "error": z.literal('INTERNAL_ERROR'),
  });

export const InvalidInvitation422Schema = z
  .strictObject({
    "status": z.literal('INVALID_INVITATION'),
  });

export const MatcherUnavailable503Schema = z
  .strictObject({
    "error": z.literal('BIOMETRIC_MATCH_UNAVAILABLE'),
  });

export const Unauthenticated401Schema = z
  .strictObject({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
  });

export const VerifyBiometricRequestSchema = z
  .strictObject({
    "qrSignedToken": z.string().min(1),
    "captureRef": z.string().min(1),
  });

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this package is not documented to
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
  "biometricPolicy": {
    method: "GET",
    path: "/v1/biometric/policy",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": BiometricAnySchema,
      "403": BiometricErrorSchema,
    },
  },
  "biometricEvidenceRecord": {
    method: "POST",
    path: "/v1/biometric/evidence",
    auth: ["officer"],
    reach: "browser",
    request: BiometricEvidenceEnvelopeSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": BiometricAnySchema,
      "201": BiometricAnySchema,
      "400": BiometricErrorSchema,
      "403": BiometricErrorSchema,
      "409": BiometricErrorSchema,
      "422": BiometricErrorSchema,
    },
  },
} as const;
