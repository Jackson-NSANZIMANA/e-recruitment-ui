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
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.

import type { z } from 'zod';
import type {
  InvalidClient401Schema,
  InvalidCredentials401Schema,
  InvalidRequest400Schema,
  OfficerLoginRequestSchema,
  ServiceTokenRequestSchema,
  TokenIssuedSchema,
} from './iam-service.zod.js';

export type InvalidClient401 = z.infer<typeof InvalidClient401Schema>;
export type InvalidCredentials401 = z.infer<typeof InvalidCredentials401Schema>;
export type InvalidRequest400 = z.infer<typeof InvalidRequest400Schema>;
export type OfficerLoginRequest = z.infer<typeof OfficerLoginRequestSchema>;
export type ServiceTokenRequest = z.infer<typeof ServiceTokenRequestSchema>;
export type TokenIssued = z.infer<typeof TokenIssuedSchema>;
