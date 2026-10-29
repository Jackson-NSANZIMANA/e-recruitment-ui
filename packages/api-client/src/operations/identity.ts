// @usrp/api-client - the citizen's own verified identity (ADR-049). The subject is the session.
// CONTRACT-PENDING: S12c.

import type { ApiClient } from '../transport.js';
import type { AttachClearanceResponse, MyIdentity } from '../wire.js';

/** ADR-048 section 2.3. A write: never retried automatically; a 422 CLEARANCE_NUMBER_MALFORMED is the citizen's to correct. */
export function attachMyClearanceCertificate(client: ApiClient, applicationId: string, clearanceCertificateNumber: string): Promise<AttachClearanceResponse> {
  return client.call<AttachClearanceResponse>('attachMyClearanceCertificate', { body: { applicationId, clearanceCertificateNumber } });
}

export function getMyIdentity(client: ApiClient): Promise<MyIdentity> {
  return client.call<MyIdentity>('getMyIdentity');
}
