// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — campaign control (BUILD-001, ADR-030), S02 scaffold
//
// The seven officer writes behind the Campaign Studio (S05). Each:
//   • REQUIRES a caller-owned UUID Idempotency-Key — the key is the retry
//     identity, minted once per officer intent and reused for that intent;
//   • is never retried by this client (retryOnG2G: false in paths.ts);
//   • decodes its answer at the boundary: a 2xx body that is not the shape
//     the backend stores is an ApiError { kind: 'malformed' }, not a cast.
// 404/409/422 refusals stay ApiErrors carrying the backend's code, for the
// slice to name (packages/features/campaigns/src/model).
// ══════════════════════════════════════════════════════════════════

import { ApiError } from '../errors.js';
import type { ApiClient } from '../transport.js';
import type {
  CampaignCommandResult,
  CampaignDraftCreated,
  CampaignLifecycleChanged,
  CampaignLifecycleState,
  CampaignPolicyVersionCreated,
  CampaignPublicCodeInput,
  CampaignPublished,
  CampaignSessionConfigured,
  ConfigureCampaignSessionInput,
  CreateCampaignInput,
  CreateCampaignPolicyInput,
} from '../wire.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = Readonly<Record<string, unknown>>;

function malformed(operationId: string, detail: string): ApiError {
  return new ApiError({ kind: 'malformed', detail: `${operationId}: ${detail}` }, 'The server returned an unexpected response.');
}

function record(operationId: string, body: unknown): Body {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw malformed(operationId, 'body is not an object');
  return body as Body;
}

const str = (b: Body, k: string): boolean => typeof b[k] === 'string' && (b[k] as string).length > 0;
const int = (b: Body, k: string): boolean => typeof b[k] === 'number' && Number.isInteger(b[k]);

/** PURE. Narrow a 2xx campaign-command body to its documented shape, or throw malformed. */
export function decodeCampaignCommand(operationId: 'createCampaign', body: unknown): CampaignDraftCreated;
export function decodeCampaignCommand(operationId: 'createCampaignPolicy', body: unknown): CampaignPolicyVersionCreated;
export function decodeCampaignCommand(operationId: 'configureCampaignSession', body: unknown): CampaignSessionConfigured;
export function decodeCampaignCommand(operationId: 'publishCampaign', body: unknown): CampaignPublished;
export function decodeCampaignCommand(operationId: 'closeCampaignRegistration', body: unknown): CampaignLifecycleChanged<'REGISTRATION_CLOSED'>;
export function decodeCampaignCommand(operationId: 'completeCampaign', body: unknown): CampaignLifecycleChanged<'COMPLETED'>;
export function decodeCampaignCommand(operationId: 'cancelCampaign', body: unknown): CampaignLifecycleChanged<'CANCELLED'>;
export function decodeCampaignCommand(operationId: CampaignControlOperation, body: unknown): unknown {
  const b = record(operationId, body);
  if (!str(b, 'publicCode')) throw malformed(operationId, 'publicCode missing');
  const lifecycle = (state: CampaignLifecycleState): unknown => {
    if (b['status'] !== state || b['campaignStatus'] !== state) throw malformed(operationId, `expected ${state}`);
    return { status: state, publicCode: b['publicCode'], campaignStatus: state };
  };
  switch (operationId) {
    case 'createCampaign':
      if (b['status'] !== 'DRAFT_CREATED' || b['campaignStatus'] !== 'DRAFT') throw malformed(operationId, 'expected DRAFT_CREATED');
      return { status: 'DRAFT_CREATED', publicCode: b['publicCode'], campaignStatus: 'DRAFT' };
    case 'createCampaignPolicy':
      if (b['status'] !== 'POLICY_VERSION_CREATED' || !int(b, 'policyVersion') || !str(b, 'policyHash')) throw malformed(operationId, 'expected POLICY_VERSION_CREATED');
      return { status: 'POLICY_VERSION_CREATED', publicCode: b['publicCode'], policyVersion: b['policyVersion'], policyHash: b['policyHash'] };
    case 'configureCampaignSession': {
      if ((b['status'] !== 'SESSION_CONFIGURED' && b['status'] !== 'SESSION_UNCHANGED') || !str(b, 'district') || !int(b, 'coverageVersion') || !str(b, 'coverageHash')) {
        throw malformed(operationId, 'expected SESSION_CONFIGURED | SESSION_UNCHANGED');
      }
      const decision = b['capacityDecisionCode'];
      if (decision !== undefined && decision !== null && decision !== 'UNBOUNDED_CAPACITY') throw malformed(operationId, 'unknown capacityDecisionCode');
      return {
        status: b['status'], publicCode: b['publicCode'], district: b['district'],
        coverageVersion: b['coverageVersion'], coverageHash: b['coverageHash'],
        ...(decision === undefined ? {} : { capacityDecisionCode: decision }),
      };
    }
    case 'publishCampaign':
      if (b['status'] !== 'CAMPAIGN_PUBLISHED' || b['campaignStatus'] !== 'REGISTRATION_OPEN' || !int(b, 'policyVersion') || !int(b, 'coverageVersion') || !str(b, 'coverageHash')) {
        throw malformed(operationId, 'expected CAMPAIGN_PUBLISHED');
      }
      return {
        status: 'CAMPAIGN_PUBLISHED', publicCode: b['publicCode'], campaignStatus: 'REGISTRATION_OPEN',
        policyVersion: b['policyVersion'], coverageVersion: b['coverageVersion'], coverageHash: b['coverageHash'],
      };
    case 'closeCampaignRegistration':
      return lifecycle('REGISTRATION_CLOSED');
    case 'completeCampaign':
      return lifecycle('COMPLETED');
    case 'cancelCampaign':
      return lifecycle('CANCELLED');
  }
}

export const CAMPAIGN_CONTROL_OPERATIONS = [
  'createCampaign',
  'createCampaignPolicy',
  'configureCampaignSession',
  'publishCampaign',
  'closeCampaignRegistration',
  'completeCampaign',
  'cancelCampaign',
] as const;
export type CampaignControlOperation = (typeof CAMPAIGN_CONTROL_OPERATIONS)[number];

async function command<T>(
  client: ApiClient,
  operationId: CampaignControlOperation,
  body: unknown,
  idempotencyKey: string,
  decode: (raw: unknown) => T,
  correlationId: string | undefined,
): Promise<CampaignCommandResult<T>> {
  // A malformed key is refused here rather than spent at the edge as a 400:
  // the caller's retry identity must be a real UUID from the first attempt.
  if (!UUID.test(idempotencyKey)) throw new ApiError({ kind: 'malformed', detail: `${operationId}: Idempotency-Key must be a UUID` }, 'Invalid idempotency key.');
  let replayed = false;
  const raw = await client.call<unknown>(operationId, {
    body,
    idempotencyKey,
    onResponse: (meta) => { replayed = meta.headers.get('Idempotency-Replayed') === 'true'; },
    ...(correlationId === undefined ? {} : { correlationId }),
  });
  return { result: decode(raw), replayed };
}

export function createCampaign(client: ApiClient, input: CreateCampaignInput, idempotencyKey: string, correlationId?: string): Promise<CampaignCommandResult<CampaignDraftCreated>> {
  return command(client, 'createCampaign', input, idempotencyKey, (r) => decodeCampaignCommand('createCampaign', r), correlationId);
}

export function createCampaignPolicy(client: ApiClient, input: CreateCampaignPolicyInput, idempotencyKey: string, correlationId?: string): Promise<CampaignCommandResult<CampaignPolicyVersionCreated>> {
  return command(client, 'createCampaignPolicy', input, idempotencyKey, (r) => decodeCampaignCommand('createCampaignPolicy', r), correlationId);
}

export function configureCampaignSession(client: ApiClient, input: ConfigureCampaignSessionInput, idempotencyKey: string, correlationId?: string): Promise<CampaignCommandResult<CampaignSessionConfigured>> {
  return command(client, 'configureCampaignSession', input, idempotencyKey, (r) => decodeCampaignCommand('configureCampaignSession', r), correlationId);
}

export function publishCampaign(client: ApiClient, input: CampaignPublicCodeInput, idempotencyKey: string, correlationId?: string): Promise<CampaignCommandResult<CampaignPublished>> {
  return command(client, 'publishCampaign', { publicCode: input.publicCode }, idempotencyKey, (r) => decodeCampaignCommand('publishCampaign', r), correlationId);
}

export function closeCampaignRegistration(client: ApiClient, input: CampaignPublicCodeInput, idempotencyKey: string, correlationId?: string): Promise<CampaignCommandResult<CampaignLifecycleChanged<'REGISTRATION_CLOSED'>>> {
  return command(client, 'closeCampaignRegistration', { publicCode: input.publicCode }, idempotencyKey, (r) => decodeCampaignCommand('closeCampaignRegistration', r), correlationId);
}

export function completeCampaign(client: ApiClient, input: CampaignPublicCodeInput, idempotencyKey: string, correlationId?: string): Promise<CampaignCommandResult<CampaignLifecycleChanged<'COMPLETED'>>> {
  return command(client, 'completeCampaign', { publicCode: input.publicCode }, idempotencyKey, (r) => decodeCampaignCommand('completeCampaign', r), correlationId);
}

export function cancelCampaign(client: ApiClient, input: CampaignPublicCodeInput, idempotencyKey: string, correlationId?: string): Promise<CampaignCommandResult<CampaignLifecycleChanged<'CANCELLED'>>> {
  return command(client, 'cancelCampaign', { publicCode: input.publicCode }, idempotencyKey, (r) => decodeCampaignCommand('cancelCampaign', r), correlationId);
}
