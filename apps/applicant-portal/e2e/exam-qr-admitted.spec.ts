import { expect, test } from '@playwright/test';

/**
 * ADR-034: once the QR has been spent at the venue gate, the citizen's QR page
 * says where and when they were admitted and never renders the QR again.
 */
const APP = '22222222-2222-4222-8222-222222222222';

test('a spent QR is never shown again; the page says where the citizen was admitted', async ({ page }) => {
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kind: 'applicant', idleExpiresAt: '2099-01-01T00:00:00.000Z', absoluteExpiresAt: '2099-01-02T00:00:00.000Z' }),
    }),
  );
  await page.route('**/edge/v1/me/applications/exam-invitation**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        state: 'ADMITTED', agency: 'RDF', processingCode: 'RDF-90001', campaignLabel: 'RDF 2026',
        currentStatus: 'PHYSICAL_TEST_SCHEDULED',
        admission: { venueName: 'IPRC Kicukiro Stadium', admittedAt: '2026-12-01T06:01:00.000Z' },
      }),
    }),
  );

  await page.goto(`/applications/${APP}/exam-qr`);
  await expect(page.getByText(/you have been admitted|winjiye|vous avez été admis/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/IPRC Kicukiro Stadium/)).toBeVisible();
  // The QR is an svg role=img named after the application; it must be absent.
  await expect(page.getByRole('img', { name: /RDF-90001/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /download|kuramo|télécharger/i })).toHaveCount(0);
});
