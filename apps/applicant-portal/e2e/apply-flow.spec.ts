import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Campaign-bound filing (ADR-027, ADR-030) over the real bundle, with the edge
 * intercepted. Proves the wizard names the chosen campaign, never sends an
 * agency or identity, keeps one Idempotency-Key across a retry of the same
 * intent, and renders the replay, duplicate and key-reuse answers distinctly.
 */
const APP = '33333333-3333-4333-8333-333333333333';
const CAMPAIGN = {
  publicCode: 'RDF-2026',
  campaignLabel: 'RDF 2026 general enlistment',
  agency: 'RDF',
  status: 'REGISTRATION_OPEN',
  registrationOpensAt: '2026-10-01T00:00:00.000Z',
  registrationClosesAt: '2099-11-30T00:00:00.000Z',
  examinationStartDate: '2099-12-10',
  examinationEndDate: '2099-12-20',
  targetCategories: ['GENERAL_ENLISTMENT'],
  targetDistricts: ['GASABO'],
  allowsWalkIn: true,
  contactPhoneNumbers: null,
  contactWebsite: null,
};
const FILED = { status: 'SUBMITTED', applicationId: APP, processingCode: 'RDF-10001', agency: 'RDF' };

async function mockEdge(page: Page): Promise<void> {
  // Pin the language: these specs prove the flow, not the host machine's locale.
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kind: 'applicant', idleExpiresAt: '2099-01-01T00:00:00.000Z', absoluteExpiresAt: '2099-01-02T00:00:00.000Z' }),
    }),
  );
  await page.route('**/edge/v1/campaigns', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaigns: [CAMPAIGN] }) })
      : route.fulfill({ status: 405 }),
  );
}

async function walkToReview(page: Page): Promise<void> {
  await page.goto('/apply');
  await page.getByRole('button', { name: /apply to this recruitment/i }).click({ timeout: 15_000 });
  await page.getByLabel(/recruitment category/i).click();
  await page.getByText('RDF general enlistment', { exact: true }).click();
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByLabel(/nesa index number/i).fill('RW2026/1001');
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByRole('button', { name: /i agree/i }).click();
}

const submit = (page: Page): Promise<void> => page.getByRole('button', { name: /submit application/i }).click();

test('a retry of the same intent reuses the key and is shown as a replay, not a second filing', async ({ page }) => {
  await mockEdge(page);
  const keys: string[] = [];
  const bodies: unknown[] = [];
  await page.route('**/edge/v1/me/applications', async (route: Route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    bodies.push(route.request().postDataJSON());
    // The first response is lost on the wire; the browser never sees it.
    if (keys.length === 1) return route.abort('connectionreset');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Idempotency-Replayed': 'true' },
      body: JSON.stringify(FILED),
    });
  });

  await walkToReview(page);
  await submit(page);
  await expect(page.getByText(/application could not be submitted|offline|connection/i).first()).toBeVisible({ timeout: 15_000 });
  await submit(page);

  await expect(page.getByText(/replayed — previous filing confirmed/i)).toBeVisible({ timeout: 15_000 });
  expect(keys).toHaveLength(2); // one request per click: the client never retries a write itself
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/i);
  expect(keys[1]).toBe(keys[0]);
  expect(bodies[0]).toEqual({ category: 'GENERAL_ENLISTMENT', campaignCode: 'RDF-2026', nesaIndexNumber: 'RW2026/1001' });
});

test('ALREADY_APPLIED points the citizen at the existing application', async ({ page }) => {
  await mockEdge(page);
  await page.route('**/edge/v1/me/applications', (route) =>
    route.request().method() !== 'POST'
      ? route.fallback()
      : route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ status: 'ALREADY_APPLIED', applicationId: APP, processingCode: 'RDF-10001' }) }),
  );

  await walkToReview(page);
  await submit(page);
  await expect(page.getByText(/already_applied — application already exists/i)).toBeVisible({ timeout: 15_000 });
});

test('KEY_REUSED offers a new attempt, and the new attempt carries a new key', async ({ page }) => {
  await mockEdge(page);
  const keys: string[] = [];
  await page.route('**/edge/v1/me/applications', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    return keys.length === 1
      ? route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'KEY_REUSED' }) })
      : route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(FILED) });
  });

  await walkToReview(page);
  await submit(page);
  await page.getByRole('button', { name: /new attempt|start a new|try a new/i }).click({ timeout: 15_000 });
  await submit(page);

  await expect(page.getByText(/submitted — application filed/i)).toBeVisible({ timeout: 15_000 });
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});
