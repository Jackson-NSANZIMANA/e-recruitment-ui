import { describe, expect, it } from 'vitest';
import {
  makeDraft,
  nextStep,
  parseDraft,
  previousStep,
  sanitizeDraft,
} from './draft.js';

describe('application draft model', () => {
  it('never persists credentials or raw identity secrets', () => {
    expect(sanitizeDraft({ school: 'GS Kicukiro', nationalId: 'secret', sessionToken: 'token' })).toEqual({
      school: 'GS Kicukiro',
    });
  });

  it('round-trips a versioned draft and rejects unknown versions', () => {
    const draft = makeDraft('education', { school: 'GS Kicukiro' }, new Date('2026-09-08T00:00:00.000Z'));
    expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseDraft(JSON.stringify({ ...draft, version: 1 }))).toBeNull();
  });

  it('moves through the wizard in both directions', () => {
    expect(nextStep('identity')).toBe('personal');
    expect(previousStep('personal')).toBe('identity');
    expect(nextStep('review')).toBeNull();
    expect(previousStep('identity')).toBeNull();
  });
});
