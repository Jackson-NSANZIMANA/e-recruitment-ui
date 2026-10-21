import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_STATES,
  acceptsDraftEdits,
  availableCommands,
  campaignRefusalKey,
  isTerminal,
  nextCampaignState,
} from './lifecycle.ts';
import { canonicalJson, keyForIntent } from './intent.ts';

describe('campaign lifecycle', () => {
  it('matches the backend transitions exactly', () => {
    const table = Object.fromEntries(CAMPAIGN_STATES.map((s) => [s, availableCommands(s)]));
    expect(table).toEqual({
      DRAFT: ['publishCampaign', 'cancelCampaign'],
      REGISTRATION_OPEN: ['closeCampaignRegistration', 'cancelCampaign'],
      REGISTRATION_CLOSED: ['completeCampaign'],
      COMPLETED: [],
      CANCELLED: [],
    });
    expect(nextCampaignState('DRAFT', 'publishCampaign')).toBe('REGISTRATION_OPEN');
    expect(nextCampaignState('REGISTRATION_CLOSED', 'cancelCampaign')).toBeNull();
  });

  it('allows policy and session edits only on a draft, and ends in two terminal states', () => {
    expect(CAMPAIGN_STATES.filter(acceptsDraftEdits)).toEqual(['DRAFT']);
    expect(CAMPAIGN_STATES.filter(isTerminal)).toEqual(['COMPLETED', 'CANCELLED']);
  });

  it('names every known refusal and falls back for an unknown one', () => {
    expect(campaignRefusalKey('INCOMPLETE_COVERAGE')).toBe('campaigns.refusals.INCOMPLETE_COVERAGE');
    expect(campaignRefusalKey('SOMETHING_NEW')).toBe('campaigns.refusals.UNKNOWN');
  });
});

describe('idempotency key per intent', () => {
  let n = 0;
  const uuid = (): string => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

  it('reuses the key for the same intent regardless of field order', () => {
    const first = keyForIntent(null, { publicCode: 'A', isActive: true }, uuid);
    const retry = keyForIntent(first, { isActive: true, publicCode: 'A' }, uuid);
    expect(retry).toBe(first);
  });

  it('mints a new key when the intent changes', () => {
    const first = keyForIntent(null, { publicCode: 'A' }, uuid);
    const changed = keyForIntent(first, { publicCode: 'B' }, uuid);
    expect(changed.key).not.toBe(first.key);
  });

  it('canonicalises nested values and drops undefined fields', () => {
    expect(canonicalJson({ b: [2, { d: 1, c: undefined }], a: null })).toBe('{"a":null,"b":[2,{"d":1}]}');
  });
});
