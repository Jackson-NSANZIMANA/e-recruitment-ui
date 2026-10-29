// @usrp/api-client — campaign-control write hooks (S05, the Campaign Studio)
//
// One mutation per BUILD-001 command. The caller supplies the Idempotency-Key
// WITH the input (`{ input, idempotencyKey }`): the key is the retry identity of
// an officer intent, so it must outlive one React render and one mutation. None
// of these retries; success or refusal, the admin reads are re-read.
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { adminKeys } from '../keys.js';
import {
  cancelCampaign,
  closeCampaignRegistration,
  completeCampaign,
  configureCampaignSession,
  createCampaign,
  createCampaignPolicy,
  publishCampaign,
} from '../operations/campaign-control.js';
import type {
  CampaignCommandResult,
  CampaignDraftCreated,
  CampaignLifecycleChanged,
  CampaignPolicyVersionCreated,
  CampaignPublicCodeInput,
  CampaignPublished,
  CampaignSessionConfigured,
  ConfigureCampaignSessionInput,
  CreateCampaignInput,
  CreateCampaignPolicyInput,
} from '../wire.js';

export interface KeyedCommand<I> {
  readonly input: I;
  readonly idempotencyKey: string;
}

type Command<I, O> = UseMutationResult<CampaignCommandResult<O>, Error, KeyedCommand<I>>;

function useCampaignWrite<I, O>(client: ApiClient, run: (c: ApiClient, input: I, key: string) => Promise<CampaignCommandResult<O>>): Command<I, O> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: KeyedCommand<I>) => run(client, input, idempotencyKey),
    retry: false,
    onSettled: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export const useCreateCampaign = (client: ApiClient): Command<CreateCampaignInput, CampaignDraftCreated> => useCampaignWrite(client, createCampaign);
export const useCreateCampaignPolicy = (client: ApiClient): Command<CreateCampaignPolicyInput, CampaignPolicyVersionCreated> => useCampaignWrite(client, createCampaignPolicy);
export const useConfigureCampaignSession = (client: ApiClient): Command<ConfigureCampaignSessionInput, CampaignSessionConfigured> => useCampaignWrite(client, configureCampaignSession);
export const usePublishCampaign = (client: ApiClient): Command<CampaignPublicCodeInput, CampaignPublished> => useCampaignWrite(client, publishCampaign);
export const useCloseCampaignRegistration = (client: ApiClient): Command<CampaignPublicCodeInput, CampaignLifecycleChanged<'REGISTRATION_CLOSED'>> => useCampaignWrite(client, closeCampaignRegistration);
export const useCompleteCampaign = (client: ApiClient): Command<CampaignPublicCodeInput, CampaignLifecycleChanged<'COMPLETED'>> => useCampaignWrite(client, completeCampaign);
export const useCancelCampaign = (client: ApiClient): Command<CampaignPublicCodeInput, CampaignLifecycleChanged<'CANCELLED'>> => useCampaignWrite(client, cancelCampaign);
