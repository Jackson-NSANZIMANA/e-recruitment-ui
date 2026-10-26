// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/iam-service.yaml                          ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  cd4962842e26177f179eb3c0bd51c214dad3fd61          ║
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
//   GET  /v1/officers                                   officer            browser
//   POST /v1/officers                                   officer            browser
//   POST /v1/officers/activation/reissue                officer            browser
//   POST /v1/officers/activation/release                officer            browser
//   POST /v1/officers/posts                             officer            browser
//   POST /v1/officers/disable                           officer            browser
//   POST /v1/officers/enable                            officer            browser
//   POST /v1/officers/sessions/revoke                   officer            browser
//   POST /v1/auth/officer/activate                      none               browser
//
// `z.strictObject()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

export const InvalidClient401Schema = z
  .strictObject({
    "error": z.literal('INVALID_CLIENT'),
    "detail": z.string().optional(),
  });

export const InvalidCredentials401Schema = z
  .strictObject({
    "error": z.literal('INVALID_CREDENTIALS'),
    "detail": z.string().optional(),
  });

export const InvalidRequest400Schema = z
  .strictObject({
    "error": z.literal('INVALID_REQUEST'),
    "detail": z.string().optional(),
  });

export const OfficerActivateRequestSchema = z
  .strictObject({
    "loginHandle": z.string(),
    "activationCode": z.string(),
    "password": z.string(),
  });

export const OfficerAdminErrorSchema = z
  .strictObject({
    "error": z.enum(['INVALID_REQUEST', 'INVALID_HANDLE', 'INVALID_POSTS', 'UNKNOWN_POST', 'INVALID_REASON', 'AGENCY_ADMIN_NOT_ASSIGNABLE', 'SELF_MODIFICATION', 'NOT_FOUND', 'HANDLE_TAKEN', 'LAST_ACTIVE_ADMIN', 'NOT_PENDING_ACTIVATION', 'SAME_ADMIN', 'ALREADY_RELEASED', 'ACTIVATION_EXPIRED', 'PERMISSION_DENIED', 'UNAUTHENTICATED', 'WEAK_PASSWORD', 'ACTIVATION_REJECTED']),
    "detail": z.string().optional(),
  });

export const OfficerRowSchema = z
  .strictObject({
    "officerId": z.string().guid(),
    "loginHandle": z.string(),
    "posts": z.array(z.string()),
    "status": z.enum(['active', 'disabled', 'pending']),
    "createdAt": z.string(),
    "activatedAt": z.string().nullable(),
    "lastLoginAt": z.string().nullable(),
    "activationExpiresAt": z.string().nullable(),
    "activationState": z.string().nullable(),
    "releasableByYou": z.boolean(),
  });

export const OfficerChangeOkSchema = z
  .strictObject({
    "outcome": z.enum(['ASSIGNED', 'DISABLED', 'ENABLED', 'REVOKED', 'UNCHANGED']),
    "officer": OfficerRowSchema,
    "sessionsRevoked": z.number(),
  });

export const OfficerCreateRequestSchema = z
  .strictObject({
    "loginHandle": z.string(),
    "posts": z.array(z.string()),
  });

export const OfficerListOkSchema = z
  .strictObject({
    "officers": z.array(OfficerRowSchema),
  });

export const OfficerLoginRequestSchema = z
  .strictObject({
    "loginHandle": z.string().min(1).max(128),
    "password": z.string().min(1).max(256),
  });

export const OfficerOpenedSchema = z
  .strictObject({
    "outcome": z.enum(['CREATED', 'REISSUED']),
    "officer": OfficerRowSchema,
  });

export const OfficerPostsRequestSchema = z
  .strictObject({
    "targetOfficerId": z.string().guid(),
    "posts": z.array(z.string()),
    "reasonCode": z.string(),
  });

export const OfficerReasonRequestSchema = z
  .strictObject({
    "targetOfficerId": z.string().guid(),
    "reasonCode": z.string(),
  });

export const OfficerReleasedSchema = z
  .strictObject({
    "outcome": z.literal('RELEASED'),
    "officer": OfficerRowSchema,
    "activation": z
    .strictObject({
      "code": z.string(),
      "expiresAt": z.string(),
    }),
  });

export const OfficerTargetRequestSchema = z
  .strictObject({
    "targetOfficerId": z.string().guid(),
  });

export const ServiceTokenRequestSchema = z
  .strictObject({
    "clientId": z.string().min(1).max(128),
    "clientSecret": z.string().min(1).max(256),
  });

/**
 * The whole success body. Two fields. Nothing else is returned by either
 * grant — this is the shape, not an abridgement of it.
 */
export const TokenIssuedSchema = z
  .strictObject({
    "token": z.string(),
    "expiresAt": z.string(),
  });

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this package is not documented to
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
  "officerList": {
    method: "GET",
    path: "/v1/officers",
    auth: ["officer"],
    reach: "browser",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": OfficerListOkSchema,
      "400": OfficerAdminErrorSchema,
      "401": OfficerAdminErrorSchema,
      "403": OfficerAdminErrorSchema,
      "404": OfficerAdminErrorSchema,
      "409": OfficerAdminErrorSchema,
      "422": OfficerAdminErrorSchema,
    },
  },
  "officerCreate": {
    method: "POST",
    path: "/v1/officers",
    auth: ["officer"],
    reach: "browser",
    request: OfficerCreateRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": OfficerOpenedSchema,
      "201": OfficerOpenedSchema,
      "400": OfficerAdminErrorSchema,
      "401": OfficerAdminErrorSchema,
      "403": OfficerAdminErrorSchema,
      "404": OfficerAdminErrorSchema,
      "409": OfficerAdminErrorSchema,
      "422": OfficerAdminErrorSchema,
    },
  },
  "officerReissueActivation": {
    method: "POST",
    path: "/v1/officers/activation/reissue",
    auth: ["officer"],
    reach: "browser",
    request: OfficerTargetRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": OfficerOpenedSchema,
      "400": OfficerAdminErrorSchema,
      "401": OfficerAdminErrorSchema,
      "403": OfficerAdminErrorSchema,
      "404": OfficerAdminErrorSchema,
      "409": OfficerAdminErrorSchema,
      "422": OfficerAdminErrorSchema,
    },
  },
  "officerReleaseActivation": {
    method: "POST",
    path: "/v1/officers/activation/release",
    auth: ["officer"],
    reach: "browser",
    request: OfficerTargetRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": OfficerReleasedSchema,
      "400": OfficerAdminErrorSchema,
      "401": OfficerAdminErrorSchema,
      "403": OfficerAdminErrorSchema,
      "404": OfficerAdminErrorSchema,
      "409": OfficerAdminErrorSchema,
      "422": OfficerAdminErrorSchema,
    },
  },
  "officerAssignPosts": {
    method: "POST",
    path: "/v1/officers/posts",
    auth: ["officer"],
    reach: "browser",
    request: OfficerPostsRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": OfficerChangeOkSchema,
      "400": OfficerAdminErrorSchema,
      "401": OfficerAdminErrorSchema,
      "403": OfficerAdminErrorSchema,
      "404": OfficerAdminErrorSchema,
      "409": OfficerAdminErrorSchema,
      "422": OfficerAdminErrorSchema,
    },
  },
  "officerDisable": {
    method: "POST",
    path: "/v1/officers/disable",
    auth: ["officer"],
    reach: "browser",
    request: OfficerReasonRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": OfficerChangeOkSchema,
      "400": OfficerAdminErrorSchema,
      "401": OfficerAdminErrorSchema,
      "403": OfficerAdminErrorSchema,
      "404": OfficerAdminErrorSchema,
      "409": OfficerAdminErrorSchema,
      "422": OfficerAdminErrorSchema,
    },
  },
  "officerEnable": {
    method: "POST",
    path: "/v1/officers/enable",
    auth: ["officer"],
    reach: "browser",
    request: OfficerReasonRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": OfficerChangeOkSchema,
      "400": OfficerAdminErrorSchema,
      "401": OfficerAdminErrorSchema,
      "403": OfficerAdminErrorSchema,
      "404": OfficerAdminErrorSchema,
      "409": OfficerAdminErrorSchema,
      "422": OfficerAdminErrorSchema,
    },
  },
  "officerRevokeSessions": {
    method: "POST",
    path: "/v1/officers/sessions/revoke",
    auth: ["officer"],
    reach: "browser",
    request: OfficerReasonRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": OfficerChangeOkSchema,
      "400": OfficerAdminErrorSchema,
      "401": OfficerAdminErrorSchema,
      "403": OfficerAdminErrorSchema,
      "404": OfficerAdminErrorSchema,
      "409": OfficerAdminErrorSchema,
      "422": OfficerAdminErrorSchema,
    },
  },
  "officerActivate": {
    method: "POST",
    path: "/v1/auth/officer/activate",
    auth: ["none"],
    reach: "browser",
    request: OfficerActivateRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "204": null,
      "400": OfficerAdminErrorSchema,
      "401": OfficerAdminErrorSchema,
    },
  },
} as const;
