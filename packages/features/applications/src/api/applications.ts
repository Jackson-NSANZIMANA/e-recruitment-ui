// ═══════════════════════════════════════════════════════════════
// applications — public feature API
//
// The feature does not maintain a second wire contract. The edge client is the
// single transport/schema owner; re-exporting its operations here keeps feature
// consumers on the same operation ids and response shapes without duplicating
// types that can drift.
// ═══════════════════════════════════════════════════════════════

export {
  listApplications,
  listAmberQueue,
  findApplicationById,
  getStatusHistory,
  getApplicationDetail,
  recordMedicalReview,
  recordFinalDecision,
  acceptApplication,
  adjudicateApplication,
  registerWalkIn,
  vetWalkIn,
  verifyIdentity,
} from '@usrp/api-client';

export type {
  ApplicationListRow as ApplicationSummary,
  ApplicationListResponse,
  ApplicationDetailResponse,
  AmberQueueResponse,
  StatusHistoryEntry,
  StatusHistoryResponse,
  TransitionResult,
  MedicalReviewInput,
  FinalDecisionInput,
  AcceptInput,
  AdjudicateInput,
  WalkInRegisterInput,
  WalkInRegisterResponse,
  WalkInVetResponse,
  IdentityVerifyResponse,
} from '@usrp/api-client';

/** Applications are intentionally not paginated: the current edge operation
 * returns the officer's RLS-scoped collection as one response. */
export const SUPPORTS_PAGINATION = false;
