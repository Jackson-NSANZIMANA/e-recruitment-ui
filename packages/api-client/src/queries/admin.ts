// @usrp/api-client — administration read hooks (the admin dashboard)
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { adminKeys } from '../keys.js';
import { getCampaignAdminDetail, listAgencyCampaigns, listFieldDevices } from '../operations/admin-reads.js';
import type { AgencyCampaignListResponse, AgencyCampaignQuery, CampaignAdminDetailResponse, FieldDeviceListResponse } from '../wire.js';

export function useAgencyCampaigns(client: ApiClient, q: AgencyCampaignQuery = {}, enabled = true): UseQueryResult<AgencyCampaignListResponse, Error> {
  return useQuery({ queryKey: adminKeys.campaigns(q), queryFn: () => listAgencyCampaigns(client, q), enabled, retry: false, staleTime: 60_000 });
}

export function useCampaignAdminDetail(client: ApiClient, publicCode: string, enabled = true): UseQueryResult<CampaignAdminDetailResponse, Error> {
  return useQuery({ queryKey: adminKeys.campaign(publicCode), queryFn: () => getCampaignAdminDetail(client, publicCode), enabled, retry: false, staleTime: 60_000 });
}

export function useFieldDevices(client: ApiClient, enabled = true): UseQueryResult<FieldDeviceListResponse, Error> {
  return useQuery({ queryKey: adminKeys.fleet(), queryFn: () => listFieldDevices(client), enabled, retry: false, staleTime: 60_000 });
}
