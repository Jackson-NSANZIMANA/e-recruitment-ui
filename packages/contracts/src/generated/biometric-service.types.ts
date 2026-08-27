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
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.

import type { z } from 'zod';
import type {
  AgencyMismatch403Schema,
  UuidSchema,
  BiometricEvaluatedSchema,
  Forbidden403Schema,
  BiometricForbidden403Schema,
  BiometricRequest400Schema,
  InternalError500Schema,
  InvalidInvitation422Schema,
  MatcherUnavailable503Schema,
  Unauthenticated401Schema,
  VerifyBiometricRequestSchema,
} from './biometric-service.zod.js';

export type AgencyMismatch403 = z.infer<typeof AgencyMismatch403Schema>;
export type Uuid = z.infer<typeof UuidSchema>;
export type BiometricEvaluated = z.infer<typeof BiometricEvaluatedSchema>;
export type Forbidden403 = z.infer<typeof Forbidden403Schema>;
export type BiometricForbidden403 = z.infer<typeof BiometricForbidden403Schema>;
export type BiometricRequest400 = z.infer<typeof BiometricRequest400Schema>;
export type InternalError500 = z.infer<typeof InternalError500Schema>;
export type InvalidInvitation422 = z.infer<typeof InvalidInvitation422Schema>;
export type MatcherUnavailable503 = z.infer<typeof MatcherUnavailable503Schema>;
export type Unauthenticated401 = z.infer<typeof Unauthenticated401Schema>;
export type VerifyBiometricRequest = z.infer<typeof VerifyBiometricRequestSchema>;
