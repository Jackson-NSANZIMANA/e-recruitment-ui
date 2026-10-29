// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/field-sync-service.yaml                   ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  d0ef603ebec9fa6155d321cbeef1aff72ac3be48          ║
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
  AssignDeviceRequestSchema,
  UuidSchema,
  ConflictResolved200Schema,
  DeviceAlreadyEnrolled200Schema,
  DeviceAssigned200Schema,
  DeviceEnrolled201Schema,
  DeviceRevoked200Schema,
  DeviceRevoked409Schema,
  EnrollDeviceRequestSchema,
  PhysicalTestMetricsSchema,
  FieldScoreRecordSchema,
  FieldScoreResultSchema,
  FleetDeviceSchema,
  FleetList200Schema,
  FleetNotFound404Schema,
  Forbidden403Schema,
  InternalError500Schema,
  InvalidField400Schema,
  NoConflict409Schema,
  NotFound404Schema,
  ResolveConflictRequestSchema,
  ScoreNotFound404Schema,
  ResolveNotFound404Schema,
  RevokeDeviceRequestSchema,
  SyncScoresOkSchema,
  SyncScoresRequestSchema,
  SyncScoresRequest400Schema,
  Unauthenticated401Schema,
} from './field-sync-service.zod.js';

export type Agency = z.infer<typeof AgencySchema>;
export type AssignDeviceRequest = z.infer<typeof AssignDeviceRequestSchema>;
export type Uuid = z.infer<typeof UuidSchema>;
export type ConflictResolved200 = z.infer<typeof ConflictResolved200Schema>;
export type DeviceAlreadyEnrolled200 = z.infer<typeof DeviceAlreadyEnrolled200Schema>;
export type DeviceAssigned200 = z.infer<typeof DeviceAssigned200Schema>;
export type DeviceEnrolled201 = z.infer<typeof DeviceEnrolled201Schema>;
export type DeviceRevoked200 = z.infer<typeof DeviceRevoked200Schema>;
export type DeviceRevoked409 = z.infer<typeof DeviceRevoked409Schema>;
export type EnrollDeviceRequest = z.infer<typeof EnrollDeviceRequestSchema>;
export type PhysicalTestMetrics = z.infer<typeof PhysicalTestMetricsSchema>;
export type FieldScoreRecord = z.infer<typeof FieldScoreRecordSchema>;
export type FieldScoreResult = z.infer<typeof FieldScoreResultSchema>;
export type FleetDevice = z.infer<typeof FleetDeviceSchema>;
export type FleetList200 = z.infer<typeof FleetList200Schema>;
export type FleetNotFound404 = z.infer<typeof FleetNotFound404Schema>;
export type Forbidden403 = z.infer<typeof Forbidden403Schema>;
export type InternalError500 = z.infer<typeof InternalError500Schema>;
export type InvalidField400 = z.infer<typeof InvalidField400Schema>;
export type NoConflict409 = z.infer<typeof NoConflict409Schema>;
export type NotFound404 = z.infer<typeof NotFound404Schema>;
export type ResolveConflictRequest = z.infer<typeof ResolveConflictRequestSchema>;
export type ScoreNotFound404 = z.infer<typeof ScoreNotFound404Schema>;
export type ResolveNotFound404 = z.infer<typeof ResolveNotFound404Schema>;
export type RevokeDeviceRequest = z.infer<typeof RevokeDeviceRequestSchema>;
export type SyncScoresOk = z.infer<typeof SyncScoresOkSchema>;
export type SyncScoresRequest = z.infer<typeof SyncScoresRequestSchema>;
export type SyncScoresRequest400 = z.infer<typeof SyncScoresRequest400Schema>;
export type Unauthenticated401 = z.infer<typeof Unauthenticated401Schema>;
