import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRehearsalCampaign, REHEARSAL_CODE_PREFIX, REHEARSAL_LABEL_PREFIX } from '../src/rehearsal.js';

test('a rehearsal is recognised from either backend marker', () => {
  assert.equal(REHEARSAL_CODE_PREFIX, 'REH-');
  assert.equal(REHEARSAL_LABEL_PREFIX, '[REHEARSAL]');
  assert.equal(isRehearsalCampaign({ publicCode: 'REH-RDF-20261016' }), true);
  assert.equal(isRehearsalCampaign({ campaignLabel: '[REHEARSAL] RDF 16 Oct' }), true);
  assert.equal(isRehearsalCampaign({ publicCode: null, campaignLabel: '[REHEARSAL] RCS 16 Oct' }), true);
});

test('a real campaign is never marked as a rehearsal', () => {
  assert.equal(isRehearsalCampaign({ publicCode: 'RDF-2026', campaignLabel: 'RDF-2026' }), false);
  assert.equal(isRehearsalCampaign({ publicCode: 'PREH-1', campaignLabel: 'Rehearsal of the band' }), false);
  assert.equal(isRehearsalCampaign({}), false);
});
