// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — TanStack Query hooks for public campaigns (ADR-030)
// ══════════════════════════════════════════════════════════════════

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { campaignKeys } from '../keys.js';
import { getPublicCampaign, listPublicCampaigns } from '../operations/campaigns.js';
import type { PublicCampaignDetailResponse, PublicCampaignListResponse } from '../wire.js';

/** Campaigns currently open for registration. Anonymous; safe to cache briefly. */
export function usePublicCampaigns(client: ApiClient): UseQueryResult<PublicCampaignListResponse> {
  return useQuery({
    queryKey: campaignKeys.list(),
    queryFn: () => listPublicCampaigns(client),
    staleTime: 60_000,
  });
}

export function usePublicCampaign(client: ApiClient, publicCode: string | null): UseQueryResult<PublicCampaignDetailResponse> {
  return useQuery({
    queryKey: campaignKeys.detail(publicCode ?? ''),
    queryFn: () => getPublicCampaign(client, publicCode ?? ''),
    enabled: publicCode !== null,
    staleTime: 60_000,
  });
}
