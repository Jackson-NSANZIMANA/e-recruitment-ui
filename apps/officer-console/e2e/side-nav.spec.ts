import { expect, test } from '@playwright/test';
import { POSTS, json, signIn } from './support';

// Regression: the Atlaskit side nav is "expanded" by default and is un-hidden on
// desktop by `@media (min-width:64rem){display:initial}`. When the build shipped
// Compiled's CSS as several sheets, a later plain `display:none` beat that rule
// and the nav never showed at desktop width (toggle said "Collapse navigation"
// while no nav was visible). This runs against the production bundle.

test.use({ viewport: { width: 1440, height: 900 } });

test('desktop: the side nav is visible by default and the toggle really collapses and expands it', async ({ page }) => {
  // Registered first: Playwright matches the most recently added route first, so signIn's stubs win.
  await page.route('**/edge/v1/**', (route) => json(route, 200, { campaigns: [], applications: [], officers: [], devices: [], total: 0, nextCursor: null }));
  await signIn(page, ['agency_admin'], POSTS.admin);
  await page.goto('/dashboard');

  const nav = page.locator('nav[data-layout-slot]');
  await expect(nav).toBeVisible();
  const toggle = page.getByRole('button', { name: /collapse navigation|réduire la navigation|funga urutonde/i });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(nav).toBeHidden();
  await page.getByRole('button', { name: /expand navigation|développer la navigation|fungura urutonde/i }).click();
  await expect(nav).toBeVisible();
});
