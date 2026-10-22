// @usrp/api-client — staff administration hooks (S01). Every mutation refetches the list; none retries.
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { staffKeys } from '../keys.js';
import {
  assignOfficerPosts,
  createOfficer,
  disableOfficer,
  enableOfficer,
  listOfficers,
  reissueOfficerActivation,
  releaseOfficerActivation,
  revokeOfficerSessions,
} from '../operations/staff.js';
import type {
  AssignOfficerPostsInput,
  CreateOfficerInput,
  OfficerChangeResponse,
  OfficerListResponse,
  OfficerOpenedResponse,
  OfficerReasonInput,
  OfficerReleasedResponse,
  OfficerTargetInput,
} from '../wire.js';

export function useOfficers(client: ApiClient, enabled = true): UseQueryResult<OfficerListResponse, Error> {
  return useQuery({ queryKey: staffKeys.list(), queryFn: () => listOfficers(client), enabled, retry: false });
}

function useStaffMutation<I, O>(client: ApiClient, fn: (c: ApiClient, input: I) => Promise<O>): UseMutationResult<O, Error, I> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: I) => fn(client, input),
    retry: false,
    // Success or refusal, the list is re-read: the row may have changed under us.
    onSettled: () => qc.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export const useCreateOfficer = (client: ApiClient): UseMutationResult<OfficerOpenedResponse, Error, CreateOfficerInput> => useStaffMutation(client, createOfficer);
export const useReissueActivation = (client: ApiClient): UseMutationResult<OfficerOpenedResponse, Error, OfficerTargetInput> => useStaffMutation(client, reissueOfficerActivation);
/** CONTRACT-PENDING: S06. The code in the result must be shown once and never cached: gcTime 0 on the caller's mutation result. */
export const useReleaseActivation = (client: ApiClient): UseMutationResult<OfficerReleasedResponse, Error, OfficerTargetInput> => useStaffMutation(client, releaseOfficerActivation);
export const useAssignPosts = (client: ApiClient): UseMutationResult<OfficerChangeResponse, Error, AssignOfficerPostsInput> => useStaffMutation(client, assignOfficerPosts);
export const useDisableOfficer = (client: ApiClient): UseMutationResult<OfficerChangeResponse, Error, OfficerReasonInput> => useStaffMutation(client, disableOfficer);
export const useEnableOfficer = (client: ApiClient): UseMutationResult<OfficerChangeResponse, Error, OfficerReasonInput> => useStaffMutation(client, enableOfficer);
export const useRevokeSessions = (client: ApiClient): UseMutationResult<OfficerChangeResponse, Error, OfficerReasonInput> => useStaffMutation(client, revokeOfficerSessions);
