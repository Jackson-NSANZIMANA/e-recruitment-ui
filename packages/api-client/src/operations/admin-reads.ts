// ═════════════════════════════════════════════════════════════════
// @usrp/api-client — administration reads: the agency's campaigns with
// occupancy (S04, ADR-039) and its tablet fleet (S09). Read-only; the
// agency comes from the officer session, never from the request.
// ═════════════════════════════════════════════════════════════════

import type { ApiClient } from '../transport.js';
import type { AgencyCampaignListResponse, AgencyCampaignQuery, CampaignAdminDetailResponse, FieldDeviceListResponse } from '../wire.js';

/** PURE. The query string record for listAgencyCampaigns; statuses travel comma-separated. */
export function agencyCampaignQuery(q: AgencyCampaignQuery): Record<string, string> {
  const out: Record<string, string> = {};
  if (q.q !== undefined && q.q !== '') out['q'] = q.q;
  if (q.status !== undefined && q.status.length > 0) out['status'] = q.status.join(',');
  if (q.limit !== undefined) out['limit'] = String(q.limit);
  if (q.cursor !== undefined && q.cursor !== '') out['cursor'] = q.cursor;
  return out;
}

export const listAgencyCampaigns = (client: ApiClient, q: AgencyCampaignQuery = {}): Promise<AgencyCampaignListResponse> =>
  client.call<AgencyCampaignListResponse>('listAgencyCampaigns', { query: agencyCampaignQuery(q) });

export const getCampaignAdminDetail = (client: ApiClient, publicCode: string): Promise<CampaignAdminDetailResponse> =>
  client.call<CampaignAdminDetailResponse>('getCampaignAdminDetail', { query: { publicCode } });

export const listFieldDevices = (client: ApiClient): Promise<FieldDeviceListResponse> =>
  client.call<FieldDeviceListResponse>('listFieldDevices');
