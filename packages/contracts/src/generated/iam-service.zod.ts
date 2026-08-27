// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/iam-service.yaml                          ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/iam-service.yaml instead.        ║
// ╚══════════════════════════════════════════════════════════════╝

//
// USRP iam-service
//
// Route table (method, path, auth kinds, reach):
//   POST /v1/auth/officer/login                         none               browser
//   POST /v1/auth/service/token                         none               service-internal
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//
// `.strict()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

export const InvalidClient401Schema = z
  .object({
    "error": z.literal('INVALID_CLIENT'),
    "detail": z.string().optional(),
  }).strict();

export const InvalidCredentials401Schema = z
  .object({
    "error": z.literal('INVALID_CREDENTIALS'),
    "detail": z.string().optional(),
  }).strict();

export const InvalidRequest400Schema = z
  .object({
    "error": z.literal('INVALID_REQUEST'),
    "detail": z.string().optional(),
  }).strict();

export const OfficerLoginRequestSchema = z
  .object({
    "loginHandle": z.string().min(1).max(128),
    "password": z.string().min(1).max(256),
  }).strict();

export const ServiceTokenRequestSchema = z
  .object({
    "clientId": z.string().min(1).max(128),
    "clientSecret": z.string().min(1).max(256),
  }).strict();

/**
 * The whole success body. Two fields. Nothing else is returned by either
 * grant — this is the shape, not an abridgement of it.
 */
export const TokenIssuedSchema = z
  .object({
    "token": z.string(),
    "expiresAt": z.string(),
  }).strict();

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this service is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const iamServiceOperations = {
  "officerLogin": {
    method: "POST",
    path: "/v1/auth/officer/login",
    auth: ["none"],
    reach: "browser",
    request: OfficerLoginRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": TokenIssuedSchema,
      "400": InvalidRequest400Schema,
      "401": InvalidCredentials401Schema,
    },
  },
  "issueServiceToken": {
    method: "POST",
    path: "/v1/auth/service/token",
    auth: ["none"],
    reach: "service-internal",
    request: ServiceTokenRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": TokenIssuedSchema,
      "400": InvalidRequest400Schema,
      "401": InvalidClient401Schema,
    },
  },
  "iamHealth": {
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
  "iamReady": {
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
