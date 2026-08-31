// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — citizen self-service operations (ADR-018, ADR-020, ADR-015)
//
// Everything here derives the applicant from the SESSION, never from a body
// field. `POST /v1/applicants/me/applications/withdraw` takes only an
// `applicationId`, and ownership is enforced upstream inside the write
// transaction against the session-derived `applicantId`. A client that also sent
// an `applicantId` would be offering an id the server correctly ignores — and
// inviting the next reader to think it matters.
// ══════════════════════════════════════════════════════════════════

import type { ApiClient } from '../transport.js';
import type { MyApplicationsResponse, WithdrawResponse } from '../wire.js';

export function listMyApplications(client: ApiClient, correlationId?: string): Promise<MyApplicationsResponse> {
  return client.call<MyApplicationsResponse>('listMyApplications', correlationId === undefined ? {} : { correlationId });
}

/** ADR-020. Ownership is a server-side property of the session, not an argument. */
export function withdrawMyApplication(client: ApiClient, applicationId: string, correlationId?: string): Promise<WithdrawResponse> {
  return client.call<WithdrawResponse>('withdrawMyApplication', {
    body: { applicationId },
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

/** ADR-015. A 404 here means "no request on file", which is a normal state. */
export function getMyErasureRequest(client: ApiClient, correlationId?: string): Promise<Readonly<Record<string, unknown>>> {
  return client.call<Readonly<Record<string, unknown>>>('getMyErasureRequest', correlationId === undefined ? {} : { correlationId });
}

/** ADR-015. Answers 202: filed, not yet actioned. The UI must not claim erasure happened. */
export function fileMyErasureRequest(client: ApiClient, correlationId?: string): Promise<Readonly<Record<string, unknown>>> {
  return client.call<Readonly<Record<string, unknown>>>('fileMyErasureRequest', correlationId === undefined ? {} : { correlationId });
}
