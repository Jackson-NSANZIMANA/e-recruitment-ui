import { test } from '@playwright/test';

/**
 * Kept visible on purpose. The backend enforces erasure.queue.read /
 * erasure.decide at the service, but the DPO queue and decline operations are
 * not browser-edge operations, so no screen can call them (baseline B-13).
 */
test.describe('erasure queue', () => {
  test.fixme('BLOCKED: B-13 — DPO queue read is not an edge operation');
  test.fixme('BLOCKED: B-13 — erasure decline with mandatory grounds is not an edge operation');
});
