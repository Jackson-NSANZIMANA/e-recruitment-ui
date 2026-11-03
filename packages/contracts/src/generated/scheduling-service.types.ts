// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/scheduling-service.yaml                   ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  6584a1a160e5008c26c0c744b0988b7eb7cd58c5          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/scheduling-service.yaml instead. ║
// ╚══════════════════════════════════════════════════════════════╝

//
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.

import type { z } from 'zod';
import type {
  CampaignSessionConfigured200Schema,
  CampaignSessionRequestSchema,
  InvitationKeyOkSchema,
  SessionCommandRejectionSchema,
  SessionError500Schema,
  Unauthenticated401Schema,
} from './scheduling-service.zod.js';

export type CampaignSessionConfigured200 = z.infer<typeof CampaignSessionConfigured200Schema>;
export type CampaignSessionRequest = z.infer<typeof CampaignSessionRequestSchema>;
export type InvitationKeyOk = z.infer<typeof InvitationKeyOkSchema>;
export type SessionCommandRejection = z.infer<typeof SessionCommandRejectionSchema>;
export type SessionError500 = z.infer<typeof SessionError500Schema>;
export type Unauthenticated401 = z.infer<typeof Unauthenticated401Schema>;
