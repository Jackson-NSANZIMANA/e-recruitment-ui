// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/field-sync-service.yaml                   ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/field-sync-service.yaml instead. ║
// ╚══════════════════════════════════════════════════════════════╝

//
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.

import type { z } from 'zod';
import type {
  AgencySchema,
  UuidSchema,
  ConflictResolved200Schema,
  DeviceAlreadyEnrolled200Schema,
  DeviceEnrolled201Schema,
  EnrollDeviceRequestSchema,
  PhysicalTestMetricsSchema,
  FieldScoreRecordSchema,
  FieldScoreResultSchema,
  Forbidden403Schema,
  InternalError500Schema,
  InvalidField400Schema,
  NoConflict409Schema,
  NotFound404Schema,
  ResolveConflictRequestSchema,
  ScoreNotFound404Schema,
  ResolveNotFound404Schema,
  SyncScoresOkSchema,
  SyncScoresRequestSchema,
  SyncScoresRequest400Schema,
  Unauthenticated401Schema,
} from './field-sync-service.zod.js';

export type Agency = z.infer<typeof AgencySchema>;
export type Uuid = z.infer<typeof UuidSchema>;
export type ConflictResolved200 = z.infer<typeof ConflictResolved200Schema>;
export type DeviceAlreadyEnrolled200 = z.infer<typeof DeviceAlreadyEnrolled200Schema>;
export type DeviceEnrolled201 = z.infer<typeof DeviceEnrolled201Schema>;
export type EnrollDeviceRequest = z.infer<typeof EnrollDeviceRequestSchema>;
export type PhysicalTestMetrics = z.infer<typeof PhysicalTestMetricsSchema>;
export type FieldScoreRecord = z.infer<typeof FieldScoreRecordSchema>;
export type FieldScoreResult = z.infer<typeof FieldScoreResultSchema>;
export type Forbidden403 = z.infer<typeof Forbidden403Schema>;
export type InternalError500 = z.infer<typeof InternalError500Schema>;
export type InvalidField400 = z.infer<typeof InvalidField400Schema>;
export type NoConflict409 = z.infer<typeof NoConflict409Schema>;
export type NotFound404 = z.infer<typeof NotFound404Schema>;
export type ResolveConflictRequest = z.infer<typeof ResolveConflictRequestSchema>;
export type ScoreNotFound404 = z.infer<typeof ScoreNotFound404Schema>;
export type ResolveNotFound404 = z.infer<typeof ResolveNotFound404Schema>;
export type SyncScoresOk = z.infer<typeof SyncScoresOkSchema>;
export type SyncScoresRequest = z.infer<typeof SyncScoresRequestSchema>;
export type SyncScoresRequest400 = z.infer<typeof SyncScoresRequest400Schema>;
export type Unauthenticated401 = z.infer<typeof Unauthenticated401Schema>;
