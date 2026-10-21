import { expect, test } from '@playwright/test';

/**
 * ADR-FE-009, development half. This app's E2E runs on the DEV server
 * (playwright.config.ts: `pnpm dev`), where routes below SCREEN-BUILT stay
 * reachable behind a visible "not built" banner (owner decision, S02). The
 * production half — such routes are not mounted at all — is proven against
 * the officer console and Field Station production bundles, and by the pure
 * tests in packages/ui/test/readiness.test.ts.
 */
test('a placeholder route is reachable in development only behind the not-built banner', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kind: 'applicant', idleExpiresAt: '2099-01-01T00:00:00.000Z', absoluteExpiresAt: '2099-01-02T00:00:00.000Z' }),
    }),
  );
  await page.goto('/my/withdraw');
  const banner = page.getByTestId('readiness-not-built');
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText(/not built/i);
  await expect(banner).toContainText('CLIENT-WIRED');

  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'USRP', level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('readiness-not-built')).toHaveCount(0);
});
