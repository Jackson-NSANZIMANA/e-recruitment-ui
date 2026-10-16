/**
 * The ADS feature-flag allowlist, pinned.
 *
 * Every ADS flag is OFF unless named here. Widening the list changes ADS
 * behaviour in every app, so it must fail this test and be updated on purpose,
 * not slip in with a dependency bump.
 *
 * Imports the TypeScript source directly (Node 24 strips erasable types).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADS_ENABLED_FEATURE_FLAGS,
  resolveAdsFeatureFlag,
} from '../src/runtime/feature-flags.ts';

const R18_PORTAL_FIX = 'platform_design_system_team_portal_logic_r18_fix';

describe('ADS feature-flag resolver', () => {
  test('the allowlist is exactly the reviewed set', () => {
    assert.deepEqual([...ADS_ENABLED_FEATURE_FLAGS].sort(), [R18_PORTAL_FIX]);
  });

  test('the React 18 portal fix is on (W1-00: modals render empty under StrictMode without it)', () => {
    assert.equal(resolveAdsFeatureFlag(R18_PORTAL_FIX), true);
  });

  test('any other flag is off, including near-miss names', () => {
    for (const name of ['', 'platform_design_system_team_portal_logic', `${R18_PORTAL_FIX}_v2`, 'platform-visual-refresh-icons']) {
      assert.equal(resolveAdsFeatureFlag(name), false, name);
    }
  });
});
