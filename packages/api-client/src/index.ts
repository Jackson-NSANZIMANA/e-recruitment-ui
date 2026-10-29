// ═══════════════════════════════════════════════════════════════
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
// ═══════════════════════════════════════════════════════════════

// ── Transport ──
export { createApiClient, CSRF_HEADER, CSRF_COOKIE_SECURE, CSRF_COOKIE_DEV, CORRELATION_HEADER } from './transport.js';
export type { ApiClient, ApiClientOptions, CallOptions, RequestRecord, ResponseMeta } from './transport.js';

// ── Paths (exact only, validated against the contract) ──
//
// `EdgeOperationId` is the WHITELIST. Any package that calls the edge should type
// its operation constants against it:
//
//   export const MY_OPERATIONS = ['listApplications'] as const
//     satisfies readonly EdgeOperationId[];
//
// so an operation the edge does not serve fails `pnpm typecheck` rather than a
// citizen's click. Four of the six feature slices were naming ids that do not
// exist — 11 of 27 calls — because `operationId: string` accepts anything.
export { EDGE_OPERATIONS, EDGE_PATHS, EDGE_BACKEND_SHA, operation, isEdgeOperationId, assertPathsMatchContract, ContractMismatchError } from './paths.js';
export type { EdgeOperation, EdgeOperationId, AnonymousEdgeOperationId } from './paths.js';

// ── Errors ──
export { ApiError, normaliseErrorBody, describeError, httpStatusOf, G2G_UNAVAILABLE_CODES } from './errors.js';
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
  ApplicationRecord,
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
  ApplicationCategory,
  SubmitApplicationInput,
  SubmitApplicationResponse,
  WithdrawResponse,
  PublicCampaign,
  PublicCampaignListResponse,
  PublicCampaignDetailResponse,
  UploadDocumentInput,
  UploadDocumentResponse,
  DocumentChecklist,
  MyIdentity,
  DocumentSatisfaction,
  VerifyAtVenueResponse,
  ExamInvitationState,
  ExamInvitationView,
  GateCandidate,
  AdmitAtGateInput,
  InvalidTicketReason,
  GateAdmissionResult,
} from './wire.js';

// ── Query keys and the invalidation map ──
export { staffKeys, searchKeys, evidenceKeys, erasureKeys, applicationKeys, applicantKeys, campaignKeys, documentKeys, examInvitationKeys, sessionKeys, INVALIDATION_MAP, resolveInvalidation } from './keys.js';
export type { InvalidationTarget } from './keys.js';

// ── Operations (framework-free; usable outside React) ──

// Session and auth
export {
  readSession,
  refreshSession,
  officerLogin,
  officerLogout,
  beginApplicantOnboarding,
  requestOtp,
  verifyOtp,
  applicantLogout,
} from './operations/session.js';
export type {
  OfficerLoginInput,
  OfficerLoginResponse,
  OnboardingBeginInput,
  OnboardingBeginResponse,
  OtpRequestInput,
  OtpRequestResponse,
  OtpVerifyInput,
  OtpVerifyResponse,
  ApplicantLogoutResponse,
} from './operations/session.js';

// Applications and identity
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
  submitMyApplication,
  uploadMyDocument,
  withdrawMyApplication,
  getMyErasureRequest,
  fileMyErasureRequest,
} from './operations/applicant.js';
export { listPublicCampaigns, getPublicCampaign } from './operations/campaigns.js';
export { getMyIdentity } from './operations/identity.js';
export { useMyIdentity } from './queries/identity.js';
export { getMyDocumentChecklist, getDocumentChecklist, verifyDocumentAtVenue } from './operations/documents.js';
export { getMyExamInvitation } from './operations/exam-invitation.js';
export { admitAtGate, gateResultFromRefusal } from './operations/gate.js';

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
  useSubmitMyApplication,
  useUploadMyDocument,
  useWithdrawMyApplication,
  useMyErasureRequest,
  useFileErasureRequest,
} from './queries/applicant.js';
export { usePublicCampaigns, usePublicCampaign } from './queries/campaigns.js';
export { useMyDocumentChecklist, useDocumentChecklist, useVerifyDocumentAtVenue } from './queries/documents.js';
export { useMyExamInvitation, EXAM_INVITATION_POLL_MS, EXAM_INVITATION_READY_POLL_MS } from './queries/exam-invitation.js';
export { useAdmitAtGate } from './queries/gate.js';

// ── Campaign control (BUILD-001, ADR-030): typed in S02, screens in S05 ──
export {
  createCampaign,
  createCampaignPolicy,
  configureCampaignSession,
  publishCampaign,
  closeCampaignRegistration,
  completeCampaign,
  cancelCampaign,
  decodeCampaignCommand,
  CAMPAIGN_CONTROL_OPERATIONS,
} from './operations/campaign-control.js';
export type { CampaignControlOperation } from './operations/campaign-control.js';
export {
  useCreateCampaign, useCreateCampaignPolicy, useConfigureCampaignSession, usePublishCampaign,
  useCloseCampaignRegistration, useCompleteCampaign, useCancelCampaign,
} from './queries/campaign-control.js';
export type { KeyedCommand } from './queries/campaign-control.js';
export type {
  CreateCampaignInput,
  CampaignCategoryPolicy,
  CreateCampaignPolicyInput,
  ConfigureCampaignSessionInput,
  CampaignPublicCodeInput,
  CampaignDraftCreated,
  CampaignPolicyVersionCreated,
  CampaignSessionConfigured,
  CampaignPublished,
  CampaignLifecycleState,
  CampaignLifecycleChanged,
  CampaignCommandResult,
} from './wire.js';

// ── Staff administration (S01), operational reads (S04), biometric evidence (B1) ──
export {
  listOfficers, createOfficer, reissueOfficerActivation, releaseOfficerActivation,
  assignOfficerPosts, disableOfficer, enableOfficer, revokeOfficerSessions, activateOfficer,
} from './operations/staff.js';
export { searchApplications, searchQuery, getBiometricEvidence, listErasureRequests, decideErasureRequest } from './operations/ops-reads.js';
export {
  useOfficers, useCreateOfficer, useReissueActivation, useReleaseActivation, useAssignPosts,
  useDisableOfficer, useEnableOfficer, useRevokeSessions,
} from './queries/staff.js';
export { useSearchApplications, useBiometricEvidence, useErasureQueue, useDecideErasure } from './queries/ops.js';
export {
  ASSIGNABLE_POSTS, ASSIGN_POSTS_REASONS, DISABLE_REASONS, ENABLE_REASONS, REVOKE_SESSIONS_REASONS,
} from './wire.js';
export type {
  OfficerRow, OfficerStatus, ActivationState, OfficerListResponse, CreateOfficerInput, OfficerOpenedResponse,
  OfficerTargetInput, OfficerReleasedResponse, AssignablePost, AssignOfficerPostsInput, OfficerReasonInput,
  OfficerChangeResponse, ActivateOfficerInput, ActivateOfficerResponse, ApplicationSearchRow, ApplicationSearchResponse,
  ApplicationSearchQuery, BiometricEvidenceRow, BiometricEvidenceResponse, ErasureRequestRow,
  ErasureQueueResponse, ErasureDecisionInput, ErasureDecisionResponse,
} from './wire.js';

// ── Field Station (S08) ──
export {
  enrollFieldDevice, syncFieldScores, resolveFieldSyncConflict, answerFromError,
  getVenueRoster, getVenueLiveCounts, getBiometricPolicy,
} from './operations/field-sync.js';
export type {
  EnrollFieldDeviceInput, EnrollFieldDeviceResponse, FieldScoreWireRecord, FieldSyncAnswer, ResolveFieldConflictInput,
  VenueQuery, VenueRosterCandidate, VenueRosterResponse, VenueLiveCountsResponse, BiometricMode, BiometricPolicyResponse,
} from './wire.js';

// ── Administration reads (admin dashboard) ──
export { agencyCampaignQuery, listAgencyCampaigns, getCampaignAdminDetail, listFieldDevices } from './operations/admin-reads.js';
export { useAgencyCampaigns, useCampaignAdminDetail, useFieldDevices } from './queries/admin.js';
export { adminKeys } from './keys.js';
export type {
  CampaignStatus, CampaignOccupancy, CampaignAdminSummary, AgencyCampaignListResponse, AgencyCampaignQuery,
  CampaignSessionOccupancy, CampaignAdminDetail, CampaignAdminDetailResponse, DeviceRevokeReason, FleetDevice, FieldDeviceListResponse,
} from './wire.js';
