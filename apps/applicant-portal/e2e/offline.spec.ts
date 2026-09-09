import { expect, test } from '@playwright/test';

test('draft persists offline without credentials', async ({ page, context }) => {
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'applicant',
        idleExpiresAt: '2099-01-01T00:00:00.000Z',
        absoluteExpiresAt: '2099-01-02T00:00:00.000Z',
      }),
    }),
  );

  await page.goto('/apply');

  // Wait for the lazy-loaded wizard form to render.
  const agencyInput = page.locator('input[name="agency"]');
  await expect(agencyInput).toBeVisible({ timeout: 15_000 });
  await agencyInput.fill('RDF');

  const categoryInput = page.locator('input[name="category"]');
  await categoryInput.fill('Infantry');

  await page.getByRole("button", { name: /komeza|next/i }).click();

  // Step 2: contact
  const phoneInput = page.locator('input[name="phone"]');
  await expect(phoneInput).toBeVisible({ timeout: 10_000 });
  await phoneInput.fill('+250 700 000 000');

  await context.setOffline(true);
  const stored = await page.evaluate(() => sessionStorage.getItem('usrp_apply_draft'));

  expect(stored).toContain('Infantry');
  expect(stored).not.toContain('nationalId');
  expect(stored).not.toContain('sessionToken');
});
