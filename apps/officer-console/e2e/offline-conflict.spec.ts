import { test } from '@playwright/test';

/**
 * Kept visible on purpose. The route is mounted, but the conflict screen is a
 * placeholder and OFFLINE_CAPTURE_CAN_SYNC is false, so there is nothing real to
 * drive yet. Retire this when the supervisor sync centre lands
 * (frontend-revamp-plan W2-12); offline replay itself is Wave 4.
 */
test('offline capture reconnect conflict resolve', () => {
  test.fixme(true, 'BLOCKED: W2-12 — conflict screen is a placeholder; offline capture disabled until Wave 4 proof');
});
