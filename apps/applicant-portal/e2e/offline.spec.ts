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
  await page.getByLabel('Which agency are you applying to?').fill('RDF');
  await page.getByLabel('Recruitment category').fill('Infantry');
  await page.getByRole('button', { name: /next/i }).click();
  await page.getByLabel('Your phone number').fill('+250 700 000 000');

  await context.setOffline(true);
  const stored = await page.evaluate(() => sessionStorage.getItem('usrp_apply_draft'));

  expect(stored).toContain('Infantry');
  expect(stored).not.toContain('nationalId');
  expect(stored).not.toContain('sessionToken');
});
