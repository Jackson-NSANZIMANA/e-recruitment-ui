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
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.

import type { z } from 'zod';
import type {
  InvalidClient401Schema,
  InvalidCredentials401Schema,
  InvalidRequest400Schema,
  OfficerActivateRequestSchema,
  OfficerAdminErrorSchema,
  OfficerRowSchema,
  OfficerChangeOkSchema,
  OfficerCreateRequestSchema,
  OfficerListOkSchema,
  OfficerLoginRequestSchema,
  OfficerOpenedSchema,
  OfficerPostsRequestSchema,
  OfficerReasonRequestSchema,
  OfficerReleasedSchema,
  OfficerTargetRequestSchema,
  ServiceTokenRequestSchema,
  TokenIssuedSchema,
} from './iam-service.zod.js';

export type InvalidClient401 = z.infer<typeof InvalidClient401Schema>;
export type InvalidCredentials401 = z.infer<typeof InvalidCredentials401Schema>;
export type InvalidRequest400 = z.infer<typeof InvalidRequest400Schema>;
export type OfficerActivateRequest = z.infer<typeof OfficerActivateRequestSchema>;
export type OfficerAdminError = z.infer<typeof OfficerAdminErrorSchema>;
export type OfficerRow = z.infer<typeof OfficerRowSchema>;
export type OfficerChangeOk = z.infer<typeof OfficerChangeOkSchema>;
export type OfficerCreateRequest = z.infer<typeof OfficerCreateRequestSchema>;
export type OfficerListOk = z.infer<typeof OfficerListOkSchema>;
export type OfficerLoginRequest = z.infer<typeof OfficerLoginRequestSchema>;
export type OfficerOpened = z.infer<typeof OfficerOpenedSchema>;
export type OfficerPostsRequest = z.infer<typeof OfficerPostsRequestSchema>;
export type OfficerReasonRequest = z.infer<typeof OfficerReasonRequestSchema>;
export type OfficerReleased = z.infer<typeof OfficerReleasedSchema>;
export type OfficerTargetRequest = z.infer<typeof OfficerTargetRequestSchema>;
export type ServiceTokenRequest = z.infer<typeof ServiceTokenRequestSchema>;
export type TokenIssued = z.infer<typeof TokenIssuedSchema>;
