import { test } from '@playwright/test';

/**
 * OTP is the real citizen-facing authentication surface. The app has not yet
 * mounted the edge auth slice, so this remains an explicit implementation
 * checkpoint rather than a fake /api/* happy path.
 */
test.describe('Citizen edge authentication', () => {
  test.fixme('mount applicant OTP flow against /edge/v1/auth/applicant/otp/request and /edge/v1/auth/applicant/otp/verify', async () => {});
  test.fixme('NID verification, document upload, and application submission wait for the backend edge gateway', async () => {});
});
