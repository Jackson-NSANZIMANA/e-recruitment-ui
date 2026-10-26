import { expect, test } from '@playwright/test';
import { ID1, ID2, POSTS, json, signIn } from './support';

const queue = { requests: [{ requestId: ID1, requestedAt: '2026-10-19T08:00:00.000Z' }, { requestId: ID2, requestedAt: '2026-10-21T08:00:00.000Z' }] };

test('the DPO sees request ids and ages only, never who the person is', async ({ page }) => {
  await signIn(page, ['dpo'], POSTS.dpo);
  await page.route('**/edge/v1/erasure-requests', (route) => json(route, 200, queue));
  await page.goto('/compliance/erasure-queue');
  const table = page.getByTestId('queue-erasure');
  await expect(table).toContainText('00000000', { timeout: 15_000 });
  const html = await page.content();
  expect(html).not.toMatch(/nationalId|applicantId|fullName/i);
  await expect(page.getByText(/no DPO role/i)).toHaveCount(0);
});

test('declining needs written grounds, and the grounds travel with the decision', async ({ page }) => {
  await signIn(page, ['dpo'], POSTS.dpo);
  await page.route('**/edge/v1/erasure-requests', (route) => json(route, 200, queue));
  let body = '';
  await page.route('**/edge/v1/erasure-requests/decision', (route) => { body = route.request().postData() ?? ''; return json(route, 200, { requestId: ID1, decision: 'DECLINED' }); });
  await page.goto('/compliance/erasure-queue');
  await page.getByRole('button', { name: /^Decline: / }).first().click();
  await expect(page.getByRole('button', { name: 'Decline request' })).toBeDisabled();
  expect(body).toBe('');
  await page.getByLabel('Ground for declining').fill('An application is still active');
  await page.getByRole('button', { name: 'Decline request' }).click();
  await expect.poll(() => body).toContain('"decision":"DECLINE"');
  expect(body).toContain('"grounds":"An application is still active"');
  await expect(page.getByTestId('dpo-done')).toContainText('declined');
});

test('erasing states that it cannot be undone, and a retention refusal is shown in words', async ({ page }) => {
  await signIn(page, ['dpo'], POSTS.dpo);
  await page.route('**/edge/v1/erasure-requests', (route) => json(route, 200, queue));
  await page.route('**/edge/v1/erasure-requests/decision', (route) => json(route, 409, { error: 'REFUSED_ACTIVE_APPLICATION' }));
  await page.goto('/compliance/erasure-queue');
  await page.getByRole('button', { name: /^Erase: / }).first().click();
  await expect(page.getByTestId('confirm-action')).toContainText('cannot be undone');
  await page.getByTestId('confirm-action-confirm').click();
  await expect(page.getByTestId('dpo-error')).toContainText('An application is still active');
});

test('an officer without the DPO permission gets the forbidden state', async ({ page }) => {
  await signIn(page, ['reviewer'], POSTS.reviewer);
  await page.goto('/compliance/erasure-queue');
  await expect(page.getByTestId('state-forbidden')).toBeVisible({ timeout: 15_000 });
});
