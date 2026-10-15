// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/identity-service.yaml                     ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  df80f6517247a00ffd99518fd31bd7c68dd70d65          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/identity-service.yaml instead.   ║
// ╚══════════════════════════════════════════════════════════════╝

//
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.

import type { z } from 'zod';
import type {
  AgencySchema,
  AlreadyErasedOkSchema,
  ApplicationStatusSchema,
  UuidSchema,
  ApplicantApplicationSummarySchema,
  ApplicantAuth400Schema,
  ApplicantAuthError500Schema,
  ApplicantSessionIssued200Schema,
  ApplicationChannelSchema,
  DeclineErasureRequestSchema,
  DocumentChecklistItemSchema,
  DocumentChecklist200Schema,
  DocumentUploaded201Schema,
  EraseIdentityRequestSchema,
  ErasedOkSchema,
  EraseOk200Schema,
  RefusedAcceptLocked409Schema,
  RefusedActiveApplication409Schema,
  EraseRefused409Schema,
  ErasureDeclined200Schema,
  ErasureNotFound404Schema,
  ErasureNotPending409Schema,
  ErasureQueueEntrySchema,
  ErasureQueueOkSchema,
  ErasureRequestFiled202Schema,
  ErasureRequestNone404Schema,
  ExamInvitationAdmissionSchema,
  ExamInvitationPayloadSchema,
  ExamInvitationViewSchema,
  Forbidden403Schema,
  GateAdmissionRequestSchema,
  GateCandidateSchema,
  GateAdmitted200Schema,
  GateAlreadyAdmitted409Schema,
  GateIdentityMismatch409Schema,
  GateNotAdmissible409Schema,
  GateWrongDay409Schema,
  GateWrongVenue409Schema,
  GateConflict409Schema,
  GateInvalidTicket422Schema,
  IdentityAlreadyExists200Schema,
  IdentityCreated201Schema,
  IdentityError500Schema,
  IdentityNotConfirmed422Schema,
  InvalidApplicantId400Schema,
  InvalidOtp401Schema,
  InvalidSession401Schema,
  MyApplicationsOkSchema,
  MyErasureRequestOkSchema,
  NidaUnavailable503Schema,
  NotACitizen422Schema,
  NotFoundInNida404Schema,
  RawNationalIdSchema,
  OnboardingBeginBodySchema,
  OnboardingBegun200Schema,
  OnboardingExpired401Schema,
  OtpChallenged202Schema,
  OtpRequestBodySchema,
  OtpVerifyBodySchema,
  SubmitApplicationRequestSchema,
  SubmitApplicationResponseSchema,
  Unauthenticated401Schema,
  UploadDocumentFormSchema,
  UpstreamUnavailable502Schema,
  VerifyIdentity400Schema,
  VerifyIdentityRequestSchema,
  WithdrawNoChangeOkSchema,
  WithdrawnOkSchema,
  WithdrawMineOk200Schema,
  WithdrawMineRequestSchema,
  WithdrawNotApplicable409Schema,
  WithdrawNotFound404Schema,
} from './identity-service.zod.js';

export type Agency = z.infer<typeof AgencySchema>;
export type AlreadyErasedOk = z.infer<typeof AlreadyErasedOkSchema>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type Uuid = z.infer<typeof UuidSchema>;
export type ApplicantApplicationSummary = z.infer<typeof ApplicantApplicationSummarySchema>;
export type ApplicantAuth400 = z.infer<typeof ApplicantAuth400Schema>;
export type ApplicantAuthError500 = z.infer<typeof ApplicantAuthError500Schema>;
export type ApplicantSessionIssued200 = z.infer<typeof ApplicantSessionIssued200Schema>;
export type ApplicationChannel = z.infer<typeof ApplicationChannelSchema>;
export type DeclineErasureRequest = z.infer<typeof DeclineErasureRequestSchema>;
export type DocumentChecklistItem = z.infer<typeof DocumentChecklistItemSchema>;
export type DocumentChecklist200 = z.infer<typeof DocumentChecklist200Schema>;
export type DocumentUploaded201 = z.infer<typeof DocumentUploaded201Schema>;
export type EraseIdentityRequest = z.infer<typeof EraseIdentityRequestSchema>;
export type ErasedOk = z.infer<typeof ErasedOkSchema>;
export type EraseOk200 = z.infer<typeof EraseOk200Schema>;
export type RefusedAcceptLocked409 = z.infer<typeof RefusedAcceptLocked409Schema>;
export type RefusedActiveApplication409 = z.infer<typeof RefusedActiveApplication409Schema>;
export type EraseRefused409 = z.infer<typeof EraseRefused409Schema>;
export type ErasureDeclined200 = z.infer<typeof ErasureDeclined200Schema>;
export type ErasureNotFound404 = z.infer<typeof ErasureNotFound404Schema>;
export type ErasureNotPending409 = z.infer<typeof ErasureNotPending409Schema>;
export type ErasureQueueEntry = z.infer<typeof ErasureQueueEntrySchema>;
export type ErasureQueueOk = z.infer<typeof ErasureQueueOkSchema>;
export type ErasureRequestFiled202 = z.infer<typeof ErasureRequestFiled202Schema>;
export type ErasureRequestNone404 = z.infer<typeof ErasureRequestNone404Schema>;
export type ExamInvitationAdmission = z.infer<typeof ExamInvitationAdmissionSchema>;
export type ExamInvitationPayload = z.infer<typeof ExamInvitationPayloadSchema>;
export type ExamInvitationView = z.infer<typeof ExamInvitationViewSchema>;
export type Forbidden403 = z.infer<typeof Forbidden403Schema>;
export type GateAdmissionRequest = z.infer<typeof GateAdmissionRequestSchema>;
export type GateCandidate = z.infer<typeof GateCandidateSchema>;
export type GateAdmitted200 = z.infer<typeof GateAdmitted200Schema>;
export type GateAlreadyAdmitted409 = z.infer<typeof GateAlreadyAdmitted409Schema>;
export type GateIdentityMismatch409 = z.infer<typeof GateIdentityMismatch409Schema>;
export type GateNotAdmissible409 = z.infer<typeof GateNotAdmissible409Schema>;
export type GateWrongDay409 = z.infer<typeof GateWrongDay409Schema>;
export type GateWrongVenue409 = z.infer<typeof GateWrongVenue409Schema>;
export type GateConflict409 = z.infer<typeof GateConflict409Schema>;
export type GateInvalidTicket422 = z.infer<typeof GateInvalidTicket422Schema>;
export type IdentityAlreadyExists200 = z.infer<typeof IdentityAlreadyExists200Schema>;
export type IdentityCreated201 = z.infer<typeof IdentityCreated201Schema>;
export type IdentityError500 = z.infer<typeof IdentityError500Schema>;
export type IdentityNotConfirmed422 = z.infer<typeof IdentityNotConfirmed422Schema>;
export type InvalidApplicantId400 = z.infer<typeof InvalidApplicantId400Schema>;
export type InvalidOtp401 = z.infer<typeof InvalidOtp401Schema>;
export type InvalidSession401 = z.infer<typeof InvalidSession401Schema>;
export type MyApplicationsOk = z.infer<typeof MyApplicationsOkSchema>;
export type MyErasureRequestOk = z.infer<typeof MyErasureRequestOkSchema>;
export type NidaUnavailable503 = z.infer<typeof NidaUnavailable503Schema>;
export type NotACitizen422 = z.infer<typeof NotACitizen422Schema>;
export type NotFoundInNida404 = z.infer<typeof NotFoundInNida404Schema>;
export type RawNationalId = z.infer<typeof RawNationalIdSchema>;
export type OnboardingBeginBody = z.infer<typeof OnboardingBeginBodySchema>;
export type OnboardingBegun200 = z.infer<typeof OnboardingBegun200Schema>;
export type OnboardingExpired401 = z.infer<typeof OnboardingExpired401Schema>;
export type OtpChallenged202 = z.infer<typeof OtpChallenged202Schema>;
export type OtpRequestBody = z.infer<typeof OtpRequestBodySchema>;
export type OtpVerifyBody = z.infer<typeof OtpVerifyBodySchema>;
export type SubmitApplicationRequest = z.infer<typeof SubmitApplicationRequestSchema>;
export type SubmitApplicationResponse = z.infer<typeof SubmitApplicationResponseSchema>;
export type Unauthenticated401 = z.infer<typeof Unauthenticated401Schema>;
export type UploadDocumentForm = z.infer<typeof UploadDocumentFormSchema>;
export type UpstreamUnavailable502 = z.infer<typeof UpstreamUnavailable502Schema>;
export type VerifyIdentity400 = z.infer<typeof VerifyIdentity400Schema>;
export type VerifyIdentityRequest = z.infer<typeof VerifyIdentityRequestSchema>;
export type WithdrawNoChangeOk = z.infer<typeof WithdrawNoChangeOkSchema>;
export type WithdrawnOk = z.infer<typeof WithdrawnOkSchema>;
export type WithdrawMineOk200 = z.infer<typeof WithdrawMineOk200Schema>;
export type WithdrawMineRequest = z.infer<typeof WithdrawMineRequestSchema>;
export type WithdrawNotApplicable409 = z.infer<typeof WithdrawNotApplicable409Schema>;
export type WithdrawNotFound404 = z.infer<typeof WithdrawNotFound404Schema>;
