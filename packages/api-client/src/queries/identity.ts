// @usrp/api-client - TanStack Query hook for the citizen's own identity (ADR-049).

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { documentKeys, identityKeys } from '../keys.js';
import { attachMyClearanceCertificate, getMyIdentity } from '../operations/identity.js';
import type { AttachClearanceResponse, MyIdentity } from '../wire.js';

export function useAttachMyClearanceCertificate(client: ApiClient): UseMutationResult<AttachClearanceResponse, Error, { applicationId: string; clearanceCertificateNumber: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, clearanceCertificateNumber }) => attachMyClearanceCertificate(client, applicationId, clearanceCertificateNumber),
    onSuccess: (_data, { applicationId }) => { void qc.invalidateQueries({ queryKey: documentKeys.mine(applicationId) }); },
  });
}

export function useMyIdentity(client: ApiClient): UseQueryResult<MyIdentity> {
  return useQuery({ queryKey: identityKeys.mine, queryFn: () => getMyIdentity(client), staleTime: 5 * 60_000, retry: false });
}
