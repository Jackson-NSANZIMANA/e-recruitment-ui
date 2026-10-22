// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — operational reads (S04, ADR-039) and advisory biometric
// evidence (B1, ADR-037)
// ══════════════════════════════════════════════════════════════════

import type { ApiClient } from '../transport.js';
import type {
  ApplicationSearchQuery,
  ApplicationSearchResponse,
  BiometricEvidenceResponse,
  ErasureDecisionInput,
  ErasureDecisionResponse,
  ErasureQueueResponse,
} from '../wire.js';

/** PURE. The query string record for searchApplications; repeatable filters travel comma-separated. */
export function searchQuery(q: ApplicationSearchQuery): Record<string, string> {
  const out: Record<string, string> = {};
  if (q.status !== undefined && q.status.length > 0) out['status'] = q.status.join(',');
  for (const key of ['category', 'campaign', 'district', 'submittedFrom', 'submittedTo', 'cursor'] as const) {
    const v = q[key];
    if (v !== undefined && v !== '') out[key] = v;
  }
  if (q.limit !== undefined) out['limit'] = String(q.limit);
  return out;
}

export const searchApplications = (client: ApiClient, q: ApplicationSearchQuery): Promise<ApplicationSearchResponse> =>
  client.call<ApplicationSearchResponse>('searchApplications', { query: searchQuery(q) });

/** ADVISORY evidence, never a verdict. SHADOW evidence is invisible to every officer (engine RLS). */
export const getBiometricEvidence = (client: ApiClient, applicationId: string): Promise<BiometricEvidenceResponse> =>
  client.call<BiometricEvidenceResponse>('getBiometricEvidence', { query: { applicationId } });

export const listErasureRequests = (client: ApiClient): Promise<ErasureQueueResponse> =>
  client.call<ErasureQueueResponse>('listErasureRequests');

/** DECLINE needs written grounds; EXECUTE is irreversible. Never retried. */
export const decideErasureRequest = (client: ApiClient, input: ErasureDecisionInput): Promise<ErasureDecisionResponse> =>
  client.call<ErasureDecisionResponse>('decideErasureRequest', { body: input });
