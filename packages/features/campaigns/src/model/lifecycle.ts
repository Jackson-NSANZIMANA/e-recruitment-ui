// ══════════════════════════════════════════════════════════════════
// campaigns — the campaign lifecycle as the backend enforces it (ADR-030)
//
// PURE. Transcribed from application-service campaign-control.pg-repository.ts
// at the pinned backend SHA: which command each lifecycle state accepts, what
// it moves to, and what each refusal code means for the officer. The server
// remains the authority; this model only stops the Studio from offering a
// button the server will refuse, and names the refusal when it does.
// ══════════════════════════════════════════════════════════════════

import type { CampaignControlOperation } from '@usrp/api-client';

export const CAMPAIGN_STATES = ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'COMPLETED', 'CANCELLED'] as const;
export type CampaignState = (typeof CAMPAIGN_STATES)[number];

/** Commands that move a campaign between lifecycle states. */
export type LifecycleCommand = Extract<CampaignControlOperation, 'publishCampaign' | 'closeCampaignRegistration' | 'completeCampaign' | 'cancelCampaign'>;

const TRANSITIONS: Readonly<Record<LifecycleCommand, Readonly<Partial<Record<CampaignState, CampaignState>>>>> = {
  publishCampaign: { DRAFT: 'REGISTRATION_OPEN' },
  closeCampaignRegistration: { REGISTRATION_OPEN: 'REGISTRATION_CLOSED' },
  completeCampaign: { REGISTRATION_CLOSED: 'COMPLETED' },
  // cancellableStatus(): only a draft or an open campaign, and the server may
  // still refuse an open one because applications exist.
  cancelCampaign: { DRAFT: 'CANCELLED', REGISTRATION_OPEN: 'CANCELLED' },
};

/** The state a lifecycle command leads to, or null when the server would refuse it (INVALID_STATE). */
export function nextCampaignState(state: CampaignState, command: LifecycleCommand): CampaignState | null {
  return TRANSITIONS[command][state] ?? null;
}

/** Draft-only commands: the policy and the session set are amended while the campaign is a draft. */
export function acceptsDraftEdits(state: CampaignState): boolean {
  return state === 'DRAFT';
}

/** The lifecycle commands a state offers, in a stable order. */
export function availableCommands(state: CampaignState): readonly LifecycleCommand[] {
  return (Object.keys(TRANSITIONS) as LifecycleCommand[]).filter((command) => nextCampaignState(state, command) !== null);
}

export function isTerminal(state: CampaignState): boolean {
  return availableCommands(state).length === 0;
}

/** Every refusal code the campaign-control and campaign-session writes return (404/409/422). */
export const CAMPAIGN_REFUSALS = [
  'CAMPAIGN_NOT_FOUND',
  'PUBLIC_CODE_ALREADY_EXISTS',
  'CAMPAIGN_LABEL_ALREADY_EXISTS',
  'INVALID_STATE',
  'POLICY_NOT_SET',
  'POLICY_VERSION_CONFLICT',
  'POLICY_HASH_MISMATCH',
  'POLICY_CATEGORY_COVERAGE_MISMATCH',
  'INCOMPLETE_COVERAGE',
  'STALE_COVERAGE',
  'INVALID_CAPACITY',
  'CAPACITY_DECISION_REQUIRED',
  'SESSION_ALREADY_RESERVED',
  'SESSION_CONFLICT',
  'INVALID_SESSION_DATE',
  'INVALID_REPORTING_HOUR',
  'DISTRICT_PROVINCE_MISMATCH',
  'CAMPAIGN_WRITE_CONFLICT',
] as const;
export type CampaignRefusal = (typeof CAMPAIGN_REFUSALS)[number];

const KNOWN: ReadonlySet<string> = new Set(CAMPAIGN_REFUSALS);

export function isCampaignRefusal(code: string): code is CampaignRefusal {
  return KNOWN.has(code);
}

/** The i18n key that names a refusal for the officer; unknown codes fall back to the generic one. */
export function campaignRefusalKey(code: string): string {
  return isCampaignRefusal(code) ? `campaigns.refusals.${code}` : 'campaigns.refusals.UNKNOWN';
}
