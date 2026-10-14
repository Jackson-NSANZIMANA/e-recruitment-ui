// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — public campaign reads (BUILD-001, ADR-030)
//
// ANONYMOUS and retry-safe. A citizen picks a campaign from this list and the
// PUBLIC code travels with their submission; the server resolves everything
// else. There is no internal id in any shape here, by construction.
// ══════════════════════════════════════════════════════════════════

import type { ApiClient } from '../transport.js';
import type { PublicCampaignDetailResponse, PublicCampaignListResponse } from '../wire.js';

export function listPublicCampaigns(client: ApiClient, correlationId?: string): Promise<PublicCampaignListResponse> {
  return client.call<PublicCampaignListResponse>('listCampaigns', correlationId === undefined ? {} : { correlationId });
}

export function getPublicCampaign(client: ApiClient, publicCode: string, correlationId?: string): Promise<PublicCampaignDetailResponse> {
  return client.call<PublicCampaignDetailResponse>('getCampaignDetail', {
    query: { publicCode },
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}
