// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/field-sync-service.yaml                   ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  cd4962842e26177f179eb3c0bd51c214dad3fd61          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/field-sync-service.yaml instead. ║
// ╚══════════════════════════════════════════════════════════════╝

//
// USRP field-sync-service
//
// Route table (method, path, auth kinds, reach):
//   POST /v1/field-sync/devices                         officer            browser
//   POST /v1/field-sync/scores                          officer            browser
//   POST /v1/field-sync/conflicts/resolve               officer            browser
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//   GET  /v1/field-sync/devices/fleet                   officer            browser
//   POST /v1/field-sync/devices/assign                  officer            browser
//   POST /v1/field-sync/devices/revoke                  officer            browser
//
// `.strict()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

export const AgencySchema = z.enum(['RDF', 'RNP', 'RCS']);

export const AssignDeviceRequestSchema = z
  .object({
    "deviceId": z.string().max(64),
    "campaign": z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,63}$/),
    "district": z.string().regex(/^[A-Z][A-Z_]{1,29}$/),
    "examDate": z.string(),
  }).strict();

export const UuidSchema = z.string().uuid().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

export const ConflictResolved200Schema = z
  .object({
    "status": z.literal('RESOLVED'),
    "applicationId": UuidSchema,
    "scoreId": UuidSchema,
  }).strict();

export const DeviceAlreadyEnrolled200Schema = z
  .object({
    "status": z.literal('ALREADY_ENROLLED'),
    "deviceId": z.string(),
    "agency": AgencySchema,
  }).strict();

export const DeviceAssigned200Schema = z
  .object({
    "status": z.literal('ASSIGNED'),
  }).strict();

export const DeviceEnrolled201Schema = z
  .object({
    "status": z.literal('ENROLLED'),
    "deviceId": z.string(),
    "agency": AgencySchema,
  }).strict();

export const DeviceRevoked200Schema = z
  .object({
    "status": z.enum(['REVOKED', 'ALREADY_REVOKED']),
  }).strict();

export const DeviceRevoked409Schema = z
  .object({
    "error": z.literal('DEVICE_REVOKED'),
  }).strict();

export const EnrollDeviceRequestSchema = z
  .object({
    "deviceId": z.string().min(1).max(64),
    "publicKeyPem": z.string().min(1).max(4096),
  }).strict();

/**
 * Transcribed from the controller's parseMetrics. Every numeric field is
 * required and must be finite; additionalNotes is the only optional.
 */
export const PhysicalTestMetricsSchema = z
  .object({
    "heightCm": z.number(),
    "weightKg": z.number(),
    "run3kmTimeSeconds": z.number(),
    "chestCm": z.number(),
    "medicalFitnessStatus": z.enum(['FIT', 'UNFIT', 'PENDING_REVIEW']),
    "additionalNotes": z.string().optional(),
  }).strict();

/**
 * UNTRUSTED INPUT by construction. Shape-checked here; the deviceSignature
 * is what the core actually trusts.
 */
export const FieldScoreRecordSchema = z
  .object({
    "applicationId": UuidSchema,
    "qrInvitationCode": z.string().min(1),
    "metrics": PhysicalTestMetricsSchema,
    "capturedAt": z.string().min(1),
    "deviceId": z.string().min(1),
    "capturingOfficerId": z.string().min(1),
    "vectorClock": z.record(z.unknown()),
    "deviceSignature": z.string().min(1),
    "signedPayloadHash": z.string().min(1),
  }).strict();

/**
 * Per-record outcome. Modelled permissively on purpose: the controller
 * returns outcome.results straight from the core and the member shape is NOT
 * visible at the transport layer, so pinning it here would be invention.
 * BAD_SIGNATURE is the rejection reason named in the source commentary.
 * Transcribing this array element precisely is a REQUEST to the backend
 * agent, recorded in the drift tool's open items.
 */
export const FieldScoreResultSchema = z.record(z.unknown());

export const FleetDeviceSchema = z
  .object({
    "deviceId": z.string(),
    "enrolledBy": z.string(),
    "enrolledAt": z.string(),
    "lastSeenAt": z.string().nullable(),
    "lastSeenSource": z.string().nullable(),
    "lastSyncAt": z.string().nullable(),
    "revokedAt": z.string().nullable(),
    "revokeReason": z.string().nullable(),
    "assignment": z
    .object({
      "campaignPublicCode": z.string(),
      "district": z.string(),
      "examDate": z.string(),
    }).strict().nullable(),
  }).strict();

export const FleetList200Schema = z
  .object({
    "devices": z.array(FleetDeviceSchema),
  }).strict();

export const FleetNotFound404Schema = z
  .object({
    "error": z.literal('NOT_FOUND'),
  }).strict();

export const Forbidden403Schema = z
  .object({
    "error": z.literal('FORBIDDEN'),
    "detail": z.string().optional(),
  }).strict();

export const InternalError500Schema = z
  .object({
    "error": z.literal('INTERNAL_ERROR'),
  }).strict();

export const InvalidField400Schema = z
  .object({
    "error": z.literal('INVALID_FIELD'),
    "detail": z.string().optional(),
  }).strict();

export const NoConflict409Schema = z
  .object({
    "status": z.literal('NO_CONFLICT'),
  }).strict();

export const NotFound404Schema = z
  .object({
    "status": z.literal('NOT_FOUND'),
  }).strict();

export const ResolveConflictRequestSchema = z
  .object({
    "applicationId": UuidSchema,
    "scoreId": UuidSchema,
    "resolution": z.string().min(1).max(50),
  }).strict();

export const ScoreNotFound404Schema = z
  .object({
    "status": z.literal('SCORE_NOT_FOUND'),
  }).strict();

export const ResolveNotFound404Schema = z.discriminatedUnion('status', [
  NotFound404Schema,
  ScoreNotFound404Schema,
]);

export const RevokeDeviceRequestSchema = z
  .object({
    "deviceId": z.string().max(64),
    "reason": z.enum(['LOST', 'STOLEN', 'COMPROMISED', 'RETIRED', 'OTHER']),
  }).strict();

export const SyncScoresOkSchema = z
  .object({
    "status": z.literal('SYNCED'),
    "results": z.array(FieldScoreResultSchema),
  }).strict();

export const SyncScoresRequestSchema = z
  .object({
    "records": z.array(FieldScoreRecordSchema).min(1),
  }).strict();

export const SyncScoresRequest400Schema = z
  .object({
    "error": z.enum(['INVALID_BATCH', 'INVALID_RECORD']),
    "detail": z.string().optional(),
  }).strict();

export const Unauthenticated401Schema = z
  .object({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
  }).strict();

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this package is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const fieldSyncServiceOperations = {
  "enrollFieldDevice": {
    method: "POST",
    path: "/v1/field-sync/devices",
    auth: ["officer"],
    reach: "browser",
    request: EnrollDeviceRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": DeviceAlreadyEnrolled200Schema,
      "201": DeviceEnrolled201Schema,
      "400": InvalidField400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "500": InternalError500Schema,
    },
  },
  "syncFieldScores": {
    method: "POST",
    path: "/v1/field-sync/scores",
    auth: ["officer"],
    reach: "browser",
    request: SyncScoresRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": SyncScoresOkSchema,
      "400": SyncScoresRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "500": InternalError500Schema,
    },
  },
  "resolveFieldConflict": {
    method: "POST",
    path: "/v1/field-sync/conflicts/resolve",
    auth: ["officer"],
    reach: "browser",
    request: ResolveConflictRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": ConflictResolved200Schema,
      "400": InvalidField400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": ResolveNotFound404Schema,
      "409": NoConflict409Schema,
      "500": InternalError500Schema,
    },
  },
  "fieldSyncHealth": {
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
  "fieldSyncReady": {
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
  "fleetList": {
    method: "GET",
    path: "/v1/field-sync/devices/fleet",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": FleetList200Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
    },
  },
  "fleetAssign": {
    method: "POST",
    path: "/v1/field-sync/devices/assign",
    auth: ["officer"],
    reach: "browser",
    request: AssignDeviceRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": DeviceAssigned200Schema,
      "400": InvalidField400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": FleetNotFound404Schema,
      "409": DeviceRevoked409Schema,
    },
  },
  "fleetRevoke": {
    method: "POST",
    path: "/v1/field-sync/devices/revoke",
    auth: ["officer"],
    reach: "browser",
    request: RevokeDeviceRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": DeviceRevoked200Schema,
      "400": InvalidField400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": FleetNotFound404Schema,
    },
  },
} as const;
