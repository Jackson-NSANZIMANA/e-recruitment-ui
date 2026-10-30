// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — advisory document checklist + venue verification (ADR-032)
//
// The checklist NEVER gates an application. Venue verification is the
// front-door check-in post seeing a paper; it is idempotent server-side, but
// as a write it is still never retried automatically by this client.
// ══════════════════════════════════════════════════════════════════

import type { ApiClient } from '../transport.js';
import type { AttachClearanceResponse, DocumentChecklist, VerifyAtVenueResponse } from '../wire.js';

/** The citizen's own application (subject from the session). */
export function getMyDocumentChecklist(client: ApiClient, applicationId: string): Promise<DocumentChecklist> {
  return client.call<DocumentChecklist>('getMyDocumentChecklist', { query: { applicationId } });
}

/** An application of the officer's own agency (needs application.read). */
export function getDocumentChecklist(client: ApiClient, applicationId: string): Promise<DocumentChecklist> {
  return client.call<DocumentChecklist>('getDocumentChecklist', { query: { applicationId } });
}

/** The check-in officer saw the paper (needs document.verify.venue). */
export function verifyDocumentAtVenue(
  client: ApiClient,
  input: { readonly applicationId: string; readonly documentType: string },
): Promise<VerifyAtVenueResponse> {
  return client.call<VerifyAtVenueResponse>('verifyDocumentAtVenue', { body: input });
}

/**
 * ADR-048 §2.3: the citizen gives the number of their Irembo criminal-record
 * certificate.
 *
 * A WRITE, so it is never retried by the transport. A 202 is an acceptance, not
 * a verdict: the result arrives on the checklist as the RIB item's `clearance`
 * block, so the caller re-reads the checklist rather than trusting this body.
 */
export function attachMyClearanceCertificate(
  client: ApiClient,
  input: { readonly applicationId: string; readonly clearanceCertificateNumber: string },
): Promise<AttachClearanceResponse> {
  return client.call<AttachClearanceResponse>('attachMyClearanceCertificate', { body: input });
}
