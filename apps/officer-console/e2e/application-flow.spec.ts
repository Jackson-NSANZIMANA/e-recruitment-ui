import { expect, test } from '@playwright/test';

const OFFICER_SESSION = {
  kind: 'officer',
  agency: 'RDF',
  roles: ['RECRUITMENT_OFFICER'],
  idleExpiresAt: '2099-01-01T00:00:00.000Z',
  absoluteExpiresAt: '2099-01-02T00:00:00.000Z',
};

test('officer login reaches the current dashboard', async ({ page }) => {
  let authenticated = false;

  await page.route('**/edge/v1/session', (route) =>
    route.fulfill(authenticated
      ? { status: 200, contentType: 'application/json', body: JSON.stringify(OFFICER_SESSION) }
      : { status: 401, body: '{"error":"INVALID_SESSION"}' }),
  );
  await page.route('**/edge/v1/auth/officer/login', (route) => {
    authenticated = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/edge/v1/applications', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ agency: 'RDF', applications: [{ applicationId: '00000000-0000-4000-8000-000000000001', processingCode: 'RDF-98001', category: 'Infantry Recruit', status: 'SUBMITTED', submittedAt: '2026-08-01T08:00:00.000Z' }] }) }),
  );
  await page.route('**/edge/v1/applications/amber-queue', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ agency: 'RDF', queue: [] }) }),
  );

  await page.goto('/login');
  await expect(page.getByLabel('Login handle')).toBeVisible();
  await page.getByLabel('Login handle').fill('j.nsanzimana');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId('metric-total-applications')).toBeVisible();
});
