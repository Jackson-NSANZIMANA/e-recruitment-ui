import { expect, test, type Page } from '@playwright/test';

/**
 * RDF walk-in lane (ADR-012) over the real bundle, with the edge intercepted:
 * brokered NIDA check → register → on-site vetting. `409 AGE_PENDING` is the
 * officer's retry, not the client's, so the screen must show it and wait.
 */
const NID = '1199880012345678';
const APPLICANT = '44444444-4444-4444-8444-444444444444';
const APP = '55555555-5555-4555-8555-555555555555';

async function mockSession(page: Page): Promise<void> {
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'officer',
        agency: 'RDF',
        roles: ['screening_officer'],
        permissions: ['walkin.register', 'walkin.vet', 'identity.verify', 'application.read'],
        idleExpiresAt: '2099-01-01T00:00:00.000Z',
        absoluteExpiresAt: '2099-01-02T00:00:00.000Z',
      }),
    }),
  );
}

async function register(page: Page): Promise<{ verify: unknown; register: unknown }> {
  const bodies: { verify: unknown; register: unknown } = { verify: null, register: null };
  await page.route('**/edge/v1/identities/verify', async (route) => {
    bodies.verify = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ status: 'CREATED', applicantId: APPLICANT }) });
  });
  await page.route('**/edge/v1/applications/walk-in/register', async (route) => {
    bodies.register = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'REGISTERED', applicationId: APP, processingCode: 'RDF-W-0001', qrInvitationCode: 'WALKIN-0001' }),
    });
  });
  await page.goto('/walk-in');
  await page.getByLabel(/national id number/i).fill(NID);
  await page.getByLabel(/recruitment category/i).fill('GENERAL_ENLISTMENT');
  await page.getByRole('button', { name: /register walk-in/i }).click();
  await expect(page.getByText(/walk-in registered/i)).toBeVisible({ timeout: 15_000 });
  return bodies;
}

test('a walk-in is verified, registered and vetted, with the agency never sent by the browser', async ({ page }) => {
  await mockSession(page);
  await page.route('**/edge/v1/applications/walk-in/vet', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'WALK_IN_ON_SITE_VETTING', applicationId: APP }) }),
  );

  const bodies = await register(page);
  await expect(page.getByText('RDF-W-0001')).toBeVisible();
  await page.getByRole('button', { name: /record on-site vetting/i }).click();
  await expect(page.getByText(/on-site vetting recorded/i)).toBeVisible({ timeout: 15_000 });

  expect(bodies.verify).toEqual({ nationalId: NID, channel: 'WALK_IN' });
  expect(bodies.register).toEqual({ applicantId: APPLICANT, category: 'GENERAL_ENLISTMENT' });
});

test('AGE_PENDING is shown to the officer and cleared only by the officer retrying', async ({ page }) => {
  await mockSession(page);
  let vets = 0;
  await page.route('**/edge/v1/applications/walk-in/vet', (route) => {
    vets += 1;
    return vets === 1
      ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ status: 'AGE_PENDING' }) })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'WALK_IN_ON_SITE_VETTING', applicationId: APP }) });
  });

  await register(page);
  await page.getByRole('button', { name: /record on-site vetting/i }).click();
  await expect(page.getByText(/age verification still in progress/i)).toBeVisible({ timeout: 15_000 });
  expect(vets).toBe(1); // no silent client retry

  await page.getByRole('button', { name: /retry vetting/i }).click();
  await expect(page.getByText(/on-site vetting recorded/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/age verification still in progress/i)).toHaveCount(0);
  expect(vets).toBe(2);
});
