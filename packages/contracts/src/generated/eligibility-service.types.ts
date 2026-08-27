// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/eligibility-service.yaml                  ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/eligibility-service.yaml instead.║
// ╚══════════════════════════════════════════════════════════════╝

//
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.

import type { z } from 'zod';
import type {
  AcademicLevelSchema,
  ApplicationCategorySchema,
  UuidSchema,
  AgeCheckRequestSchema,
  AgencySchema,
  AgeEvaluatedSchema,
  ApplicantNotFound404Schema,
  DegreeCheckRequestSchema,
  G2gSubjectUnavailable409Schema,
  HecNotApplicable409Schema,
  IdentityNotVerified409Schema,
  DegreeConflict409Schema,
  DegreeEvaluatedSchema,
  DegreeHolderMismatch422Schema,
  DegreeNotFound422Schema,
  HecUnavailable503Schema,
  StoreUnavailable503Schema,
  DegreeUnavailable503Schema,
  DegreeUnprocessable422Schema,
  EducationCheckRequestSchema,
  NesaNotApplicable409Schema,
  EducationConflict409Schema,
  EducationEvaluatedSchema,
  NesaUnavailable503Schema,
  EducationUnavailable503Schema,
  EligibilityRequest400Schema,
  Forbidden403Schema,
  InternalError500Schema,
  NesaRecordNotFound422Schema,
  Unauthenticated401Schema,
} from './eligibility-service.zod.js';

export type AcademicLevel = z.infer<typeof AcademicLevelSchema>;
export type ApplicationCategory = z.infer<typeof ApplicationCategorySchema>;
export type Uuid = z.infer<typeof UuidSchema>;
export type AgeCheckRequest = z.infer<typeof AgeCheckRequestSchema>;
export type Agency = z.infer<typeof AgencySchema>;
export type AgeEvaluated = z.infer<typeof AgeEvaluatedSchema>;
export type ApplicantNotFound404 = z.infer<typeof ApplicantNotFound404Schema>;
export type DegreeCheckRequest = z.infer<typeof DegreeCheckRequestSchema>;
export type G2gSubjectUnavailable409 = z.infer<typeof G2gSubjectUnavailable409Schema>;
export type HecNotApplicable409 = z.infer<typeof HecNotApplicable409Schema>;
export type IdentityNotVerified409 = z.infer<typeof IdentityNotVerified409Schema>;
export type DegreeConflict409 = z.infer<typeof DegreeConflict409Schema>;
export type DegreeEvaluated = z.infer<typeof DegreeEvaluatedSchema>;
export type DegreeHolderMismatch422 = z.infer<typeof DegreeHolderMismatch422Schema>;
export type DegreeNotFound422 = z.infer<typeof DegreeNotFound422Schema>;
export type HecUnavailable503 = z.infer<typeof HecUnavailable503Schema>;
export type StoreUnavailable503 = z.infer<typeof StoreUnavailable503Schema>;
export type DegreeUnavailable503 = z.infer<typeof DegreeUnavailable503Schema>;
export type DegreeUnprocessable422 = z.infer<typeof DegreeUnprocessable422Schema>;
export type EducationCheckRequest = z.infer<typeof EducationCheckRequestSchema>;
export type NesaNotApplicable409 = z.infer<typeof NesaNotApplicable409Schema>;
export type EducationConflict409 = z.infer<typeof EducationConflict409Schema>;
export type EducationEvaluated = z.infer<typeof EducationEvaluatedSchema>;
export type NesaUnavailable503 = z.infer<typeof NesaUnavailable503Schema>;
export type EducationUnavailable503 = z.infer<typeof EducationUnavailable503Schema>;
export type EligibilityRequest400 = z.infer<typeof EligibilityRequest400Schema>;
export type Forbidden403 = z.infer<typeof Forbidden403Schema>;
export type InternalError500 = z.infer<typeof InternalError500Schema>;
export type NesaRecordNotFound422 = z.infer<typeof NesaRecordNotFound422Schema>;
export type Unauthenticated401 = z.infer<typeof Unauthenticated401Schema>;
