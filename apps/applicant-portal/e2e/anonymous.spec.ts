import { expect, test } from '@playwright/test';

/**
 * An anonymous visitor is a normal state, not an error (found by S03 on main):
 * the edge answers 401 to GET /edge/v1/session and the guarded routes must
 * redirect to sign-in. The crash was RouteGuard's <Navigate> resolving to a
 * second react-router copy pulled in by @usrp/auth; the Vite configs dedupe it.
 */
for (const path of ['/', '/apply', '/status', '/home']) {
  test(`an anonymous visit to ${path} lands on sign-in`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
    await page.route('**/edge/v1/session**', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"UNAUTHENTICATED"}' }),
    );
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(page.getByLabel(/national id number/i)).toBeVisible();
    await expect(page.getByText(/unexpected application error/i)).toHaveCount(0);
  });
}
