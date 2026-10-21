// ══════════════════════════════════════════════════════════════════
// campaigns — the adapter the Campaign Studio (S05) calls.
//
// Binds the typed api-client operations to one client and turns an ApiError
// refusal into the slice's vocabulary. It adds no transport: every request
// goes through @usrp/api-client's one contract-asserted client, never retried.
// ══════════════════════════════════════════════════════════════════

import {
  ApiError,
  cancelCampaign,
  closeCampaignRegistration,
  completeCampaign,
  configureCampaignSession,
  createCampaign,
  createCampaignPolicy,
  getPublicCampaign,
  listPublicCampaigns,
  publishCampaign,
  type ApiClient,
} from '@usrp/api-client';
import { campaignRefusalKey } from '../model/lifecycle.ts';

export function campaignCommands(client: ApiClient) {
  return {
    create: (input: Parameters<typeof createCampaign>[1], key: string) => createCampaign(client, input, key),
    createPolicy: (input: Parameters<typeof createCampaignPolicy>[1], key: string) => createCampaignPolicy(client, input, key),
    configureSession: (input: Parameters<typeof configureCampaignSession>[1], key: string) => configureCampaignSession(client, input, key),
    publish: (publicCode: string, key: string) => publishCampaign(client, { publicCode }, key),
    closeRegistration: (publicCode: string, key: string) => closeCampaignRegistration(client, { publicCode }, key),
    complete: (publicCode: string, key: string) => completeCampaign(client, { publicCode }, key),
    cancel: (publicCode: string, key: string) => cancelCampaign(client, { publicCode }, key),
    listPublic: () => listPublicCampaigns(client),
    getPublic: (publicCode: string) => getPublicCampaign(client, publicCode),
  } as const;
}

export type CampaignCommands = ReturnType<typeof campaignCommands>;

/** A refusal the officer can act on (404/409/422 with a code), or null for an infrastructure fault. */
export function campaignRefusal(error: unknown): { readonly code: string; readonly key: string } | null {
  if (!(error instanceof ApiError)) return null;
  const n = error.normalised;
  if (n.kind === 'conflict' || n.kind === 'unprocessable') return { code: n.outcome, key: campaignRefusalKey(n.outcome) };
  if (n.kind === 'notFound') return { code: 'CAMPAIGN_NOT_FOUND', key: campaignRefusalKey('CAMPAIGN_NOT_FOUND') };
  return null;
}
