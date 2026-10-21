// campaigns — the edge operations in this slice's domain. `satisfies` is the
// gate: an id the edge does not serve fails `pnpm typecheck` (ADR-FE-006).
import type { ApiClient, CallOptions, EdgeOperationId } from '@usrp/api-client';

export type { ApiClient, CallOptions };

export const CAMPAIGNS_OPERATIONS = [
  'listCampaigns',
  'getCampaignDetail',
  'createCampaign',
  'createCampaignPolicy',
  'configureCampaignSession',
  'publishCampaign',
  'closeCampaignRegistration',
  'completeCampaign',
  'cancelCampaign',
] as const satisfies readonly EdgeOperationId[];

export type CampaignsOperation = (typeof CAMPAIGNS_OPERATIONS)[number];
