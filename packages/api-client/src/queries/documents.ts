// @usrp/api-client — TanStack Query hooks for the document checklist (ADR-032)

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { documentKeys } from '../keys.js';
import { attachMyClearanceCertificate, getDocumentChecklist, getMyDocumentChecklist, verifyDocumentAtVenue } from '../operations/documents.js';
import type { AttachClearanceResponse, DocumentChecklist, VerifyAtVenueResponse } from '../wire.js';

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

/**
 * ADR-048 §2.3. Invalidates the CITIZEN checklist, not the officer one: the
 * clearance block is read on the citizen's own documents screen, and the write
 * changes nothing an officer list shows until the registry answers.
 */
export function useAttachMyClearanceCertificate(
  client: ApiClient,
): UseMutationResult<AttachClearanceResponse, Error, { applicationId: string; clearanceCertificateNumber: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { applicationId: string; clearanceCertificateNumber: string }) => attachMyClearanceCertificate(client, input),
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: documentKeys.mine(input.applicationId) });
    },
  });
}
