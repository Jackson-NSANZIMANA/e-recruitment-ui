// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/notification-service.yaml                 ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/notification-service.yaml instead.║
// ╚══════════════════════════════════════════════════════════════╝

//
// USRP notification-service
//
// Route table (method, path, auth kinds, reach):
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//
// `.strict()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this service is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const notificationServiceOperations = {
  "notificationHealth": {
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
  "notificationReady": {
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
