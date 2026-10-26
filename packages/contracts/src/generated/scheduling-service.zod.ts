// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/scheduling-service.yaml                   ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  df80f6517247a00ffd99518fd31bd7c68dd70d65          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/scheduling-service.yaml instead. ║
// ╚══════════════════════════════════════════════════════════════╝

//
// USRP scheduling-service
//
// Route table (method, path, auth kinds, reach):
//   POST /v1/campaigns/session                          officer            browser
//   GET  /v1/slots/invitation-key                       none               browser
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//
// `z.strictObject()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

export const CampaignSessionConfigured200Schema = z
  .strictObject({
    "status": z.enum(['SESSION_CONFIGURED', 'SESSION_UNCHANGED']),
    "publicCode": z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,63}$/),
    "district": z.string(),
    "coverageVersion": z.number(),
    "coverageHash": z.string().regex(/^[0-9a-f]{64}$/),
    "capacityDecisionCode": z.union([
    z.literal('UNBOUNDED_CAPACITY'),
    z.null(),
  ]),
  });

/**
 * normalizeCampaignSession: exact keys. The province must own the district.
 * publicCode is trimmed and upper-cased before validation.
 */
export const CampaignSessionRequestSchema = z
  .strictObject({
    "publicCode": z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/),
    "district": z.string().min(1),
    "province": z.string().min(1),
    "venueName": z.string().min(1).max(200),
    "examDate": z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    "reportingTimeHour": z.number(),
    "capacityLimit": z.number().nullable(),
    "capacityDecisionCode": z.union([
    z.literal('UNBOUNDED_CAPACITY'),
    z.null(),
  ]).optional(),
    "isActive": z.boolean(),
  });

export const InvitationKeyOkSchema = z
  .strictObject({
    "keyId": z.string(),
    "algorithm": z.literal('Ed25519'),
    "publicKeyPem": z.string(),
  });

/**
 * HttpError body for a 4xx session command. The code set is OPEN (the write
 * function raises P0001 with a leading code token); show `detail`, always
 * present below 500, for codes the UI does not branch on.
 */
export const SessionCommandRejectionSchema = z
  .strictObject({
    "error": z.string().regex(/^[A-Z][A-Z0-9_]+$/),
    "detail": z.string().optional(),
  });

export const SessionError500Schema = z
  .strictObject({
    "error": z.enum(['CAMPAIGN_SESSION_PERSISTENCE_ERROR', 'INTERNAL_ERROR']),
  });

export const Unauthenticated401Schema = z
  .strictObject({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
  });

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this package is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const schedulingServiceOperations = {
  "configureCampaignSession": {
    method: "POST",
    path: "/v1/campaigns/session",
    auth: ["officer"],
    reach: "browser",
    request: CampaignSessionRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": CampaignSessionConfigured200Schema,
      "400": SessionCommandRejectionSchema,
      "401": Unauthenticated401Schema,
      "403": SessionCommandRejectionSchema,
      "404": SessionCommandRejectionSchema,
      "409": SessionCommandRejectionSchema,
      "422": SessionCommandRejectionSchema,
      "500": SessionError500Schema,
    },
  },
  "getSlotInvitationKey": {
    method: "GET",
    path: "/v1/slots/invitation-key",
    auth: ["none"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": InvitationKeyOkSchema,
    },
  },
  "schedulingHealth": {
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
  "schedulingReady": {
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
