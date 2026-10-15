// @usrp/api-client — the citizen's exam QR (ADR-033)
import type { ApiClient } from '../transport.js';
import type { ExamInvitationView } from '../wire.js';

/** The citizen's own application (subject from the session). */
export function getMyExamInvitation(client: ApiClient, applicationId: string): Promise<ExamInvitationView> {
  return client.call<ExamInvitationView>('getMyExamInvitation', { query: { applicationId } });
}
