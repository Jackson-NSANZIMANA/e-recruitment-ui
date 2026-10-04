// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — TanStack Query hooks for the officer console
//
// Two things the old hooks got structurally wrong, both fixed here:
//
//   1. `useApplicationList` took `page`, `pageSize` and `search` and returned a
//      `PaginatedResult`. NOTHING IN THE PLATFORM PAGINATES — `GET /v1/applications`
//      takes no query parameters at all and returns the officer's whole
//      RLS-scoped set. Those filters silently did nothing, so the console's
//      pagination controls were furniture.
//   2. `useTransitionApplication` invalidated only the list and hand-patched the
//      detail cache with the mutation response. But the response is
//      `{status, fromStatus, toStatus}` — NOT an application — so
//      `setQueryData(detail, updated)` wrote a transition receipt into the cache
//      slot the detail view reads, corrupting it until the next refetch.
//
// Every mutation here invalidates through INVALIDATION_MAP instead. No hand-patched
// caches: the projection (ADR-006) is a max-rank derivation the client cannot
// reproduce, so guessing the resulting status locally is guaranteed to drift.
// ══════════════════════════════════════════════════════════════════

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { Agency } from '@usrp/contracts';
import type { ApiClient } from '../transport.js';
import { applicationKeys, INVALIDATION_MAP, resolveInvalidation } from '../keys.js';
import {
  acceptApplication,
  adjudicateApplication,
  findApplicationById,
  getApplicationDetail,
  getStatusHistory,
  listAmberQueue,
  listApplications,
  recordFinalDecision,
  recordMedicalReview,
  registerWalkIn,
  verifyIdentity,
  vetWalkIn,
} from '../operations/applications.js';
import type {
  AcceptInput,
  AdjudicateInput,
  AmberQueueResponse,
  ApplicationByIdResponse,
  ApplicationDetailResponse,
  ApplicationListResponse,
  FinalDecisionInput,
  IdentityVerifyResponse,
  MedicalReviewInput,
  StatusHistoryResponse,
  TransitionResult,
  WalkInRegisterInput,
  WalkInRegisterResponse,
  WalkInVetResponse,
} from '../wire.js';

/**
 * The officer's applications.
 *
 * `agency` is a CACHE KEY, not a filter: the server scopes by RLS under the
 * officer's own DB role and ignores anything we might send. Keying by it stops
 * two consoles in one browser profile sharing a cache.
 */
export function useApplicationList(
  client: ApiClient,
  agency: Agency,
  enabled = true,
): UseQueryResult<ApplicationListResponse> {
  return useQuery({
    queryKey: applicationKeys.list(agency),
    queryFn: () => listApplications(client),
    enabled,
    staleTime: 30_000,
  });
}

export function useAmberQueue(
  client: ApiClient,
  agency: Agency,
  enabled = true,
): UseQueryResult<AmberQueueResponse> {
  return useQuery({
    queryKey: applicationKeys.amberQueue(agency),
    queryFn: () => listAmberQueue(client),
    enabled,
    // Shorter than the list: this queue is the exception-based dashboard's
    // reason to exist, and a stale one hides work that is waiting.
    staleTime: 15_000,
  });
}

export function useApplication(
  client: ApiClient,
  applicationId: string,
  enabled = true,
): UseQueryResult<ApplicationByIdResponse> {
  return useQuery({
    queryKey: applicationKeys.byId(applicationId),
    queryFn: () => findApplicationById(client, applicationId),
    enabled: enabled && applicationId.length > 0,
    staleTime: 10_000,
  });
}

export function useStatusHistory(
  client: ApiClient,
  applicationId: string,
  enabled = true,
): UseQueryResult<StatusHistoryResponse> {
  return useQuery({
    queryKey: applicationKeys.statusHistory(applicationId),
    queryFn: () => getStatusHistory(client, applicationId),
    enabled: enabled && applicationId.length > 0,
    staleTime: 10_000,
  });
}

/** One request for the exact edge detail projection. History is part of this response. */
export function useApplicationDetail(
  client: ApiClient,
  applicationId: string,
  enabled = true,
): UseQueryResult<ApplicationDetailResponse> {
  return useQuery({
    queryKey: applicationKeys.detail(applicationId),
    queryFn: () => getApplicationDetail(client, applicationId),
    enabled: enabled && applicationId.length > 0,
    staleTime: 10_000,
  });
}

async function invalidate(
  qc: QueryClient,
  operationId: string,
  context: { agency?: Agency; applicationId?: string },
): Promise<void> {
  const targets = INVALIDATION_MAP[operationId] ?? [];
  await Promise.all(
    resolveInvalidation(targets, context).map((key) => qc.invalidateQueries({ queryKey: key })),
  );
}

/** Medical review (ADR-013). The input union enforces the agency mode. */
export function useRecordMedicalReview(
  client: ApiClient,
  agency: Agency,
): UseMutationResult<TransitionResult, Error, MedicalReviewInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MedicalReviewInput) => recordMedicalReview(client, input),
    onSuccess: async (_result, input) => { await invalidate(qc, 'recordMedicalReview', { agency, applicationId: input.applicationId }); },
  });
}

export function useRecordFinalDecision(
  client: ApiClient,
  agency: Agency,
): UseMutationResult<TransitionResult, Error, FinalDecisionInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FinalDecisionInput) => recordFinalDecision(client, input),
    onSuccess: async (_result, input) => { await invalidate(qc, 'recordFinalDecision', { agency, applicationId: input.applicationId }); },
  });
}

/**
 * Accept (ADR-014). The only transition that can 409 `CROSS_AGENCY_LOCKED`, and
 * the only one whose success invalidates citizen-facing caches (ADR-017
 * auto-withdrawal of the same citizen's other applications).
 */
export function useAcceptApplication(client: ApiClient, agency: Agency): UseMutationResult<TransitionResult, Error, AcceptInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AcceptInput) => acceptApplication(client, input),
    onSuccess: async (_result, input) => { await invalidate(qc, 'acceptApplication', { agency, applicationId: input.applicationId }); },
  });
}

export function useAdjudicateApplication(
  client: ApiClient,
  agency: Agency,
): UseMutationResult<TransitionResult, Error, AdjudicateInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjudicateInput) => adjudicateApplication(client, input),
    onSuccess: async (_result, input) => { await invalidate(qc, 'adjudicateApplication', { agency, applicationId: input.applicationId }); },
  });
}

/**
 * The walk-in flow as it actually is: THREE calls, exposed as three hooks.
 *
 * Not collapsed into one convenience mutation, because the officer must see and
 * act on what happens between them — `verifyIdentity` yields the `applicantId`
 * that `register` needs, and `vet` legitimately answers `409 AGE_PENDING` while
 * the candidate waits at the desk. Hiding that behind one call would turn a
 * normal, explainable pause into an error.
 */
export function useVerifyIdentity(client: ApiClient): UseMutationResult<IdentityVerifyResponse, Error, { nationalId: string; channel?: string }> {
  return useMutation({
    mutationFn: ({ nationalId, channel }: { nationalId: string; channel?: string }) =>
      verifyIdentity(client, nationalId, channel ?? 'WALK_IN'),
  });
}

export function useRegisterWalkIn(client: ApiClient, agency: Agency): UseMutationResult<WalkInRegisterResponse, Error, WalkInRegisterInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WalkInRegisterInput) => registerWalkIn(client, input),
    onSuccess: async () => { await invalidate(qc, 'registerWalkIn', { agency }); },
  });
}

export function useVetWalkIn(client: ApiClient, agency: Agency): UseMutationResult<WalkInVetResponse, Error, { applicationId: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId }: { applicationId: string }) => vetWalkIn(client, applicationId),
    onSuccess: async (_result, input) => { await invalidate(qc, 'vetWalkIn', { agency, applicationId: input.applicationId }); },
  });
}
