// @usrp/api-client — TanStack Query hook for the citizen's exam QR (ADR-033)
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { examInvitationKeys } from '../keys.js';
import { getMyExamInvitation } from '../operations/exam-invitation.js';
import type { ExamInvitationView } from '../wire.js';

/** How often to re-check while the application is still being vetted. */
export const EXAM_INVITATION_POLL_MS = 15_000;

/**
 * The QR page's data. While PENDING (vetting, or green and awaiting a slot) it
 * polls, so the QR appears without a reload the moment the slot is assigned;
 * every other state is settled and does not poll.
 */
export function useMyExamInvitation(client: ApiClient, applicationId: string | null): UseQueryResult<ExamInvitationView> {
  return useQuery({
    queryKey: examInvitationKeys.mine(applicationId ?? ''),
    queryFn: () => getMyExamInvitation(client, applicationId ?? ''),
    enabled: applicationId !== null,
    refetchInterval: (query) => (query.state.data?.state === 'PENDING' ? EXAM_INVITATION_POLL_MS : false),
    staleTime: 10_000,
  });
}
