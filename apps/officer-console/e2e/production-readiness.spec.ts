import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * ADR-FE-009 over the officer console's production bundle: the placeholder
 * screens that were reachable before S02 are not mounted (nor shipped), and
 * the gate and the walk-in desk point to the Field Station (ADR-FE-007)
 * instead of 404ing.
 */
const SESSION = {
  kind: 'officer',
  agency: 'RDF',
  roles: ['screening_officer', 'decision_authority'],
  permissions: ['admission.gate', 'walkin.register', 'application.read', 'adjudication.decide', 'erasure.queue.read'],
  idleExpiresAt: '2099-01-01T00:00:00.000Z',
  absoluteExpiresAt: '2099-01-02T00:00:00.000Z',
};

async function signedIn(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) }),
  );
  await page.route('**/edge/v1/applications**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

// The seven placeholders the programme listed as reachable, as the console
// mounted them before S02 (the three field-ops ones moved to the Field Station).
const RETIRED_PLACEHOLDERS = [
  '/adjudication/amber-queue',
  '/compliance/erasure-queue',
  '/scheduling/verify-invitation',
  '/field/walk-in',
  '/field/check-in',
  '/field/conflicts',
];

test('no placeholder screen is mounted in the production build', async ({ page }) => {
  await signedIn(page);
  for (const path of RETIRED_PLACEHOLDERS) {
    await page.goto(path);
    await expect(page.getByTestId('route-not-found'), path).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('readiness-not-built'), path).toHaveCount(0);
  }
});

test('/gate and /walk-in send the officer to the Field Station notice', async ({ page }) => {
  await signedIn(page);
  for (const path of ['/gate', '/walk-in']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/field-station$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /moved to the field station/i })).toBeVisible();
    await expect(page.getByTestId('field-station-notice')).toBeVisible();
  }
  // The station screens are gone from the console menu.
  await expect(page.getByRole('link', { name: /venue gate/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /walk-in lane/i })).toHaveCount(0);
});

test('a built screen carries no not-built banner', async ({ page }) => {
  await signedIn(page);
  await page.goto('/dashboard');
  await expect(page.getByTestId('metric-total-applications')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('readiness-not-built')).toHaveCount(0);
});

test('the production bundle ships none of the placeholder screens\' code', () => {
  // ADR-FE-009 lock 2 (tooling/surface-contract/src/vite-readiness.ts): each
  // placeholder's lazy chunk is emitted as an empty component, so the title
  // keys only those screens render must appear nowhere in dist/.
  const assets = fileURLToPath(new URL('../dist/assets/', import.meta.url));
  const shipped = readdirSync(assets)
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(`${assets}${name}`, 'utf8'))
    .join('\n');
  expect(shipped.length).toBeGreaterThan(10_000);
  for (const marker of ['adjudication.queue.title', 'compliance.queue.title', 'scheduling.verify.title', 'field_ops.check_in.title', 'field_ops.conflicts.title']) {
    expect(shipped.includes(marker), marker).toBe(false);
  }
});

test('an unauthenticated visit to a guarded path lands on sign-in, not a router crash', async ({ page }) => {
  // Regression for the duplicate react-router copy @usrp/auth pulled in (S02):
  // RouteGuard's <Navigate> threw outside the app's router until vite dedupes it.
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session**', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"INVALID_SESSION"}' }),
  );
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.locator('input[name="loginHandle"]')).toBeVisible();
});
