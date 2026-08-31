// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — public surface
//
// Rebuilt on the routes that exist, fronted by the edge specified in
// docs/architecture/edge-contract.md. Domain vocabulary comes from
// @usrp/contracts; every path is a registry constant validated against the
// contract's ROUTE_TABLE at module load.
//
// Gone, with reasons in the files that used to hold them: `createApiClient`'s
// `get/post/patch/del` path helpers, `useTransitionApplication`,
// `useDashboardMetrics`, `useNidaVerification`, `useSession`, `refreshDashboard`.
// ══════════════════════════════════════════════════════════════════

// ── Transport ──
export { createApiClient, CSRF_HEADER, CSRF_COOKIE_SECURE, CSRF_COOKIE_DEV, CORRELATION_HEADER } from './transport.js';
export type { ApiClient, ApiClientOptions, CallOptions, RequestRecord } from './transport.js';

// ── Paths (exact only, validated against the contract) ──
export { EDGE_OPERATIONS, EDGE_PATHS, operation, assertPathsMatchContract, ContractMismatchError } from './paths.js';
export type { EdgeOperation } from './paths.js';

// ── Errors ──
export { ApiError, normaliseErrorBody, describeError, G2G_UNAVAILABLE_CODES } from './errors.js';
export type { NormalisedError } from './errors.js';

// ── Retry ──
export { withRetry, shouldRetry, backoffDelayMs, DEFAULT_RETRY_POLICY } from './retry.js';
export type { RetryPolicy } from './retry.js';

// ── Wire shapes ──
export type {
  Agency,
  ApplicationStatus,
  StatusFor,
  ApplicationListResponse,
  ApplicationListRow,
  ApplicationByIdResponse,
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
  MyApplicationsResponse,
  MyApplicationRow,
  WithdrawResponse,
  RowFor,
} from './wire.js';

// ── Query keys and the invalidation map ──
export { applicationKeys, applicantKeys, sessionKeys, INVALIDATION_MAP, resolveInvalidation } from './keys.js';
export type { InvalidationTarget } from './keys.js';

// ── Operations (framework-free; usable outside React) ──
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
} from './operations/applications.js';
export {
  listMyApplications,
  withdrawMyApplication,
  getMyErasureRequest,
  fileMyErasureRequest,
} from './operations/applicant.js';

// ── TanStack Query hooks ──
export {
  useApplicationList,
  useAmberQueue,
  useApplication,
  useStatusHistory,
  useApplicationDetail,
  useRecordMedicalReview,
  useRecordFinalDecision,
  useAcceptApplication,
  useAdjudicateApplication,
  useVerifyIdentity,
  useRegisterWalkIn,
  useVetWalkIn,
} from './queries/applications.js';
export {
  useMyApplications,
  useWithdrawMyApplication,
  useMyErasureRequest,
  useFileErasureRequest,
} from './queries/applicant.js';
