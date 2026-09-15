import { test } from '@playwright/test';

/**
 * The old spec exercised fictional /api/auth and /api/identity routes and
 * claimed a citizen could verify NID, upload documents, and submit. None of
 * those operations is browser-reachable until the backend edge gateway is
 * implemented. Keep the gap executable and visible instead of shipping a
 * green test against an invented API.
 */
test.describe('Citizen application journey', () => {
  test.fixme('blocked: edge gateway must broker verifyIdentity, uploadDocument, and submitApplication', async () => {});
  test.fixme('available edge auth uses /edge/v1/auth/applicant/otp/request and /edge/v1/auth/applicant/otp/verify', async () => {});
});
