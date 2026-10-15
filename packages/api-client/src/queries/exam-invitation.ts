// @usrp/api-client — TanStack Query hook for the citizen's exam QR (ADR-033)
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { examInvitationKeys } from '../keys.js';
import { getMyExamInvitation } from '../operations/exam-invitation.js';
import type { ExamInvitationView } from '../wire.js';

/** How often to re-check while the application is still being vetted. */
export const EXAM_INVITATION_POLL_MS = 15_000;
/**
 * How often to re-check while a QR is shown (READY). The QR is single-use
 * (ADR-034): once the gate admits the citizen the page must stop showing it,
 * even if it was left open on a phone at the venue.
 */
export const EXAM_INVITATION_READY_POLL_MS = 60_000;

/**
 * The QR page's data. While PENDING (vetting, or green and awaiting a slot) it
 * polls, so the QR appears without a reload the moment the slot is assigned;
 * while READY it re-checks slowly, so a QR spent at the gate disappears; every
 * other state is settled and does not poll.
 */
export function useMyExamInvitation(client: ApiClient, applicationId: string | null): UseQueryResult<ExamInvitationView> {
  return useQuery({
    queryKey: examInvitationKeys.mine(applicationId ?? ''),
    queryFn: () => getMyExamInvitation(client, applicationId ?? ''),
    enabled: applicationId !== null,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === 'PENDING') return EXAM_INVITATION_POLL_MS;
      if (state === 'READY') return EXAM_INVITATION_READY_POLL_MS;
      return false;
    },
    staleTime: 10_000,
  });
}
