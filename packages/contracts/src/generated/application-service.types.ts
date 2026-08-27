// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/application-service.yaml                  ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/application-service.yaml instead.║
// ╚══════════════════════════════════════════════════════════════╝

//
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.

import type { z } from 'zod';
import type {
  AgencySchema,
  CrossAgencyLocked409Schema,
  ApplicationStatusSchema,
  NotApplicable409Schema,
  AcceptConflict409Schema,
  UuidSchema,
  AcceptRequestSchema,
  AdjudicateRequestSchema,
  AgePending409Schema,
  AmberQueueEntrySchema,
  AmberQueueOkSchema,
  ApplicationCategorySchema,
  ApplicantApplicationSummarySchema,
  ApplicantNotFound404Schema,
  ApplicationChannelSchema,
  ApplicationDetailSchema,
  ApplicationError500Schema,
  ApplicationSubmitted201Schema,
  ApplicationSummarySchema,
  ByApplicantOkSchema,
  FinalDecisionRequestSchema,
  FindApplicationOkSchema,
  Forbidden403Schema,
  IdentityNotVerified409Schema,
  InvalidAcademicInput422Schema,
  InvalidApplicantId400Schema,
  InvalidApplicationId400Schema,
  InvalidMedicalInput422Schema,
  InvalidRequest400Schema,
  ListApplicationsOkSchema,
  MedicalReviewRequestSchema,
  MedicalReviewRequest400Schema,
  NoOpenCampaign409Schema,
  NoWalkInCampaign409Schema,
  NotFound404Schema,
  StatusHistoryEntrySchema,
  StatusHistoryOkSchema,
  SubmitApplicationRequestSchema,
  SubmitConflict409Schema,
  SubmitRequest400Schema,
  TransitionAppliedSchema,
  TransitionNoChangeSchema,
  TransitionNotFound404Schema,
  TransitionOk200Schema,
  TransitionRequest400Schema,
  Unauthenticated401Schema,
  UnsupportedAgency501Schema,
  WalkInRegisterConflict409Schema,
  WalkInRegisterRequestSchema,
  WalkInRegisterRequest400Schema,
  WrongAgencyCategory422Schema,
  WalkInRegisterUnprocessable422Schema,
  WalkInRegistered201Schema,
  WalkInVetAppliedSchema,
  WalkInVetConflict409Schema,
  WalkInVetOk200Schema,
  WalkInVetRequestSchema,
  WalkInVetRequest400Schema,
  WithdrawOwnNoChange200Schema,
  WithdrawOwnNotApplicable409Schema,
  WithdrawnOwn200Schema,
  WithdrawOwnOk200Schema,
  WithdrawOwnRequestSchema,
} from './application-service.zod.js';

export type Agency = z.infer<typeof AgencySchema>;
export type CrossAgencyLocked409 = z.infer<typeof CrossAgencyLocked409Schema>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type NotApplicable409 = z.infer<typeof NotApplicable409Schema>;
export type AcceptConflict409 = z.infer<typeof AcceptConflict409Schema>;
export type Uuid = z.infer<typeof UuidSchema>;
export type AcceptRequest = z.infer<typeof AcceptRequestSchema>;
export type AdjudicateRequest = z.infer<typeof AdjudicateRequestSchema>;
export type AgePending409 = z.infer<typeof AgePending409Schema>;
export type AmberQueueEntry = z.infer<typeof AmberQueueEntrySchema>;
export type AmberQueueOk = z.infer<typeof AmberQueueOkSchema>;
export type ApplicationCategory = z.infer<typeof ApplicationCategorySchema>;
export type ApplicantApplicationSummary = z.infer<typeof ApplicantApplicationSummarySchema>;
export type ApplicantNotFound404 = z.infer<typeof ApplicantNotFound404Schema>;
export type ApplicationChannel = z.infer<typeof ApplicationChannelSchema>;
export type ApplicationDetail = z.infer<typeof ApplicationDetailSchema>;
export type ApplicationError500 = z.infer<typeof ApplicationError500Schema>;
export type ApplicationSubmitted201 = z.infer<typeof ApplicationSubmitted201Schema>;
export type ApplicationSummary = z.infer<typeof ApplicationSummarySchema>;
export type ByApplicantOk = z.infer<typeof ByApplicantOkSchema>;
export type FinalDecisionRequest = z.infer<typeof FinalDecisionRequestSchema>;
export type FindApplicationOk = z.infer<typeof FindApplicationOkSchema>;
export type Forbidden403 = z.infer<typeof Forbidden403Schema>;
export type IdentityNotVerified409 = z.infer<typeof IdentityNotVerified409Schema>;
export type InvalidAcademicInput422 = z.infer<typeof InvalidAcademicInput422Schema>;
export type InvalidApplicantId400 = z.infer<typeof InvalidApplicantId400Schema>;
export type InvalidApplicationId400 = z.infer<typeof InvalidApplicationId400Schema>;
export type InvalidMedicalInput422 = z.infer<typeof InvalidMedicalInput422Schema>;
export type InvalidRequest400 = z.infer<typeof InvalidRequest400Schema>;
export type ListApplicationsOk = z.infer<typeof ListApplicationsOkSchema>;
export type MedicalReviewRequest = z.infer<typeof MedicalReviewRequestSchema>;
export type MedicalReviewRequest400 = z.infer<typeof MedicalReviewRequest400Schema>;
export type NoOpenCampaign409 = z.infer<typeof NoOpenCampaign409Schema>;
export type NoWalkInCampaign409 = z.infer<typeof NoWalkInCampaign409Schema>;
export type NotFound404 = z.infer<typeof NotFound404Schema>;
export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntrySchema>;
export type StatusHistoryOk = z.infer<typeof StatusHistoryOkSchema>;
export type SubmitApplicationRequest = z.infer<typeof SubmitApplicationRequestSchema>;
export type SubmitConflict409 = z.infer<typeof SubmitConflict409Schema>;
export type SubmitRequest400 = z.infer<typeof SubmitRequest400Schema>;
export type TransitionApplied = z.infer<typeof TransitionAppliedSchema>;
export type TransitionNoChange = z.infer<typeof TransitionNoChangeSchema>;
export type TransitionNotFound404 = z.infer<typeof TransitionNotFound404Schema>;
export type TransitionOk200 = z.infer<typeof TransitionOk200Schema>;
export type TransitionRequest400 = z.infer<typeof TransitionRequest400Schema>;
export type Unauthenticated401 = z.infer<typeof Unauthenticated401Schema>;
export type UnsupportedAgency501 = z.infer<typeof UnsupportedAgency501Schema>;
export type WalkInRegisterConflict409 = z.infer<typeof WalkInRegisterConflict409Schema>;
export type WalkInRegisterRequest = z.infer<typeof WalkInRegisterRequestSchema>;
export type WalkInRegisterRequest400 = z.infer<typeof WalkInRegisterRequest400Schema>;
export type WrongAgencyCategory422 = z.infer<typeof WrongAgencyCategory422Schema>;
export type WalkInRegisterUnprocessable422 = z.infer<typeof WalkInRegisterUnprocessable422Schema>;
export type WalkInRegistered201 = z.infer<typeof WalkInRegistered201Schema>;
export type WalkInVetApplied = z.infer<typeof WalkInVetAppliedSchema>;
export type WalkInVetConflict409 = z.infer<typeof WalkInVetConflict409Schema>;
export type WalkInVetOk200 = z.infer<typeof WalkInVetOk200Schema>;
export type WalkInVetRequest = z.infer<typeof WalkInVetRequestSchema>;
export type WalkInVetRequest400 = z.infer<typeof WalkInVetRequest400Schema>;
export type WithdrawOwnNoChange200 = z.infer<typeof WithdrawOwnNoChange200Schema>;
export type WithdrawOwnNotApplicable409 = z.infer<typeof WithdrawOwnNotApplicable409Schema>;
export type WithdrawnOwn200 = z.infer<typeof WithdrawnOwn200Schema>;
export type WithdrawOwnOk200 = z.infer<typeof WithdrawOwnOk200Schema>;
export type WithdrawOwnRequest = z.infer<typeof WithdrawOwnRequestSchema>;
