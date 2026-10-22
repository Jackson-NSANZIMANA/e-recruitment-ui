// @usrp/api-client — operational read hooks (S04) and evidence (B1)
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { evidenceKeys, erasureKeys, searchKeys } from '../keys.js';
import { decideErasureRequest, getBiometricEvidence, listErasureRequests, searchApplications } from '../operations/ops-reads.js';
import type {
  ApplicationSearchQuery,
  ApplicationSearchResponse,
  BiometricEvidenceResponse,
  ErasureDecisionInput,
  ErasureDecisionResponse,
  ErasureQueueResponse,
} from '../wire.js';

export function useSearchApplications(client: ApiClient, q: ApplicationSearchQuery): UseQueryResult<ApplicationSearchResponse, Error> {
  return useQuery({ queryKey: searchKeys.query(q), queryFn: () => searchApplications(client, q), retry: false });
}

export function useBiometricEvidence(client: ApiClient, applicationId: string, enabled = true): UseQueryResult<BiometricEvidenceResponse, Error> {
  return useQuery({ queryKey: evidenceKeys.byApplication(applicationId), queryFn: () => getBiometricEvidence(client, applicationId), enabled, retry: false });
}

export function useErasureQueue(client: ApiClient, enabled = true): UseQueryResult<ErasureQueueResponse, Error> {
  return useQuery({ queryKey: erasureKeys.queue(), queryFn: () => listErasureRequests(client), enabled, retry: false });
}

export function useDecideErasure(client: ApiClient): UseMutationResult<ErasureDecisionResponse, Error, ErasureDecisionInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ErasureDecisionInput) => decideErasureRequest(client, input),
    retry: false,
    onSettled: () => qc.invalidateQueries({ queryKey: erasureKeys.all }),
  });
}
