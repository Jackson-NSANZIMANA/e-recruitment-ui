// @usrp/api-client — TanStack Query hooks for the document checklist (ADR-032)

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { documentKeys } from '../keys.js';
import { getDocumentChecklist, getMyDocumentChecklist, verifyDocumentAtVenue } from '../operations/documents.js';
import type { DocumentChecklist, VerifyAtVenueResponse } from '../wire.js';

export function useMyDocumentChecklist(client: ApiClient, applicationId: string | null): UseQueryResult<DocumentChecklist> {
  return useQuery({
    queryKey: documentKeys.mine(applicationId ?? ''),
    queryFn: () => getMyDocumentChecklist(client, applicationId ?? ''),
    enabled: applicationId !== null,
    staleTime: 30_000,
  });
}

export function useDocumentChecklist(client: ApiClient, applicationId: string | null): UseQueryResult<DocumentChecklist> {
  return useQuery({
    queryKey: documentKeys.officer(applicationId ?? ''),
    queryFn: () => getDocumentChecklist(client, applicationId ?? ''),
    enabled: applicationId !== null,
    staleTime: 15_000,
  });
}

export function useVerifyDocumentAtVenue(
  client: ApiClient,
): UseMutationResult<VerifyAtVenueResponse, Error, { applicationId: string; documentType: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { applicationId: string; documentType: string }) => verifyDocumentAtVenue(client, input),
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: documentKeys.officer(input.applicationId) });
    },
  });
}
