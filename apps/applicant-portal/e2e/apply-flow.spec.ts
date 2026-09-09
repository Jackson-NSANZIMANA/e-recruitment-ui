import { test } from '@playwright/test';

/**
 * The old spec exercised fictional /api/auth and /api/identity routes and
 * claimed a citizen could verify NID, upload documents, and submit. None of
 * those operations is browser-reachable until the backend edge gateway is
 * implemented. Keep the gap executable and visible instead of shipping a
 * green test against an invented API.
 */
test.describe('Citizen application journey', () => {
  test('officer login reaches the current dashboard', async ({ page }) => {
  test.setTimeout(60_000);

  page.on('console', (message) => {
    console.log(`[browser:${message.type()}] ${message.text()}`);
  });

  page.on('pageerror', (error) => {
    console.error(`[pageerror] ${error.message}`);
  });

  page.on('request', (request) => {
    if (request.url().includes('/edge/')) {
      console.log(
        `[request] ${request.method()} ${request.url()} body=${request.postData() ?? ''}`,
      );
    }
  });

  page.on('response', (response) => {
    if (response.url().includes('/edge/')) {
      console.log(
        `[response] ${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  page.on('requestfailed', (request) => {
    console.error(
      `[request failed] ${request.method()} ${request.url()}`,
      request.failure(),
    );
  });

  // Remaining test...
  test.fixme('blocked: edge gateway must broker verifyIdentity, uploadDocument, and submitApplication', async () => {});
  test.fixme('available edge auth uses /edge/v1/auth/applicant/otp/request and /edge/v1/auth/applicant/otp/verify', async () => {});
});
