import { expect, test, type Page } from '@playwright/test';

/**
 * Field Station shell over the real production bundle, with the edge
 * intercepted: eager officer sign-in lands on the station picker, the picker
 * lists only what the session grants (ADR-FE-011), and the production build
 * does not mount the placeholder stations (ADR-FE-009).
 */
const SESSION = (permissions: string[], agency = 'RDF') => ({
  kind: 'officer',
  agency,
  roles: ['screening_officer'],
  permissions,
  idleExpiresAt: '2099-01-01T00:00:00.000Z',
  absoluteExpiresAt: '2099-01-02T00:00:00.000Z',
});

async function signedIn(page: Page, permissions: string[], agency = 'RDF'): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION(permissions, agency)) }),
  );
}

test('officer sign-in lands on the station picker, which lists only what the session grants', async ({ page }) => {
  let authenticated = false;
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill(authenticated
      ? { status: 200, contentType: 'application/json', body: JSON.stringify(SESSION(['admission.gate', 'walkin.register', 'medical.review'])) }
      : { status: 401, contentType: 'application/json', body: '{"error":"INVALID_SESSION"}' }),
  );
  // No refresh is possible without a session: the probe falls back to sign-in.
  await page.route('**/edge/v1/session/refresh', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"INVALID_SESSION"}' }),
  );
  const logins: unknown[] = [];
  await page.route('**/edge/v1/auth/officer/login', (route) => {
    logins.push(route.request().postDataJSON());
    authenticated = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await page.locator('input[name="loginHandle"]').fill('rdf.officer');
  await page.locator('input[name="password"]').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/stations/, { timeout: 15_000 });
  expect(logins).toEqual([{ loginHandle: 'rdf.officer', password: 'correct-horse-battery-staple' }]);
  await expect(page.getByRole('heading', { name: /choose your station/i })).toBeVisible();
  await expect(page.getByTestId('station-gate').getByRole('link', { name: /open station/i })).toBeVisible();
  await expect(page.getByTestId('station-walk_in').getByRole('link', { name: /open station/i })).toBeVisible();
  await expect(page.getByTestId('station-medical').getByRole('link', { name: /open station/i })).toBeVisible();
  // Not granted: not shown at all.
  await expect(page.getByTestId('station-documents')).toHaveCount(0);
  await expect(page.getByTestId('station-supervisor')).toHaveCount(0);

  await page.getByTestId('station-gate').getByRole('link', { name: /open station/i }).click();
  await expect(page).toHaveURL(/\/gate$/);
  await expect(page.getByLabel(/this gate's venue/i)).toBeVisible({ timeout: 15_000 });
});

test('the walk-in desk is RDF-only even when another agency holds the permission', async ({ page }) => {
  await signedIn(page, ['walkin.register', 'walkin.vet'], 'RNP');
  await page.goto('/stations');
  await expect(page.getByText(/no station for this account/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('station-walk_in')).toHaveCount(0);
  // Typing the URL does not open it either: the route is guarded by the same rule.
  await page.goto('/walk-in');
  await expect(page.getByTestId('station-unavailable')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel(/national id number/i)).toHaveCount(0);
});

test('station links navigate inside the app, without a full reload', async ({ page }) => {
  await signedIn(page, ['admission.gate']);
  await page.goto('/stations');
  await expect(page.getByTestId('station-gate')).toBeVisible({ timeout: 15_000 });
  // A marker on window survives client-side navigation and is lost on a reload.
  await page.evaluate(() => { (window as unknown as { __noReload?: boolean }).__noReload = true; });
  await page.getByTestId('station-gate').getByRole('link', { name: /open station/i }).click();
  await expect(page.getByLabel(/this gate's venue/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('link', { name: /^stations$/i }).click();
  await expect(page.getByTestId('station-gate')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
});
