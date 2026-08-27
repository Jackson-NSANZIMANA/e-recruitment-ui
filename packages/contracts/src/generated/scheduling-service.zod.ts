// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/scheduling-service.yaml                   ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
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
//   GET  /v1/slots/invitation-key                       none               browser
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//
// `.strict()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

export const InvitationKeyOkSchema = z
  .object({
    "keyId": z.string(),
    "algorithm": z.literal('Ed25519'),
    "publicKeyPem": z.string(),
  }).strict();

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this service is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const schedulingServiceOperations = {
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
