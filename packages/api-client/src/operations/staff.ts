// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — staff administration (S01, ADR-036 + Addendum A)
//
// agency_admin only; the agency is the session's and never travels. The target
// is `targetOfficerId` (`officerId` is a forbidden field at the edge). Refusals
// are the screen's normal answers and come back as typed ApiError outcomes the
// feature maps; no write is ever retried (the registry says so).
//
// FOUR-EYES: createOfficer and reissueOfficerActivation never return a code.
// Only releaseOfficerActivation does, to a DIFFERENT administrator, once.
// ══════════════════════════════════════════════════════════════════

import type { ApiClient } from '../transport.js';
import type {
  ActivateOfficerInput,
  ActivateOfficerResponse,
  AssignOfficerPostsInput,
  CreateOfficerInput,
  OfficerChangeResponse,
  OfficerListResponse,
  OfficerOpenedResponse,
  OfficerReasonInput,
  OfficerReleasedResponse,
  OfficerTargetInput,
} from '../wire.js';

export const listOfficers = (client: ApiClient): Promise<OfficerListResponse> => client.call<OfficerListResponse>('listOfficers');
export const createOfficer = (client: ApiClient, input: CreateOfficerInput): Promise<OfficerOpenedResponse> =>
  client.call<OfficerOpenedResponse>('createOfficer', { body: input });
export const reissueOfficerActivation = (client: ApiClient, input: OfficerTargetInput): Promise<OfficerOpenedResponse> =>
  client.call<OfficerOpenedResponse>('reissueOfficerActivation', { body: input });
/** CONTRACT-PENDING: S06 (backend PR #45). See ../pending.ts. */
export const releaseOfficerActivation = (client: ApiClient, input: OfficerTargetInput): Promise<OfficerReleasedResponse> =>
  client.call<OfficerReleasedResponse>('releaseOfficerActivation', { body: input });
export const assignOfficerPosts = (client: ApiClient, input: AssignOfficerPostsInput): Promise<OfficerChangeResponse> =>
  client.call<OfficerChangeResponse>('assignOfficerPosts', { body: input });
export const disableOfficer = (client: ApiClient, input: OfficerReasonInput): Promise<OfficerChangeResponse> =>
  client.call<OfficerChangeResponse>('disableOfficer', { body: input });
export const enableOfficer = (client: ApiClient, input: OfficerReasonInput): Promise<OfficerChangeResponse> =>
  client.call<OfficerChangeResponse>('enableOfficer', { body: input });
export const revokeOfficerSessions = (client: ApiClient, input: OfficerReasonInput): Promise<OfficerChangeResponse> =>
  client.call<OfficerChangeResponse>('revokeOfficerSessions', { body: input });
/** Anonymous: the one-time code is the credential. 204 on success; 401 ACTIVATION_REJECTED is one answer for every failure. */
export const activateOfficer = (client: ApiClient, input: ActivateOfficerInput): Promise<ActivateOfficerResponse> =>
  client.call<ActivateOfficerResponse>('activateOfficer', { body: input });
