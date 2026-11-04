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

// Regression: in a sandbox build the SANDBOX and RESTRICTED bars share a fixed-height
// Banner. The marking used to claim 100% of that height, overflowed it, and the top
// nav covered its lower half (clipped text). Each bar must end where the next begins.
test('the handling marking is not covered by the top navigation', async ({ page }) => {
  await page.route('**/edge/v1/**', (route) => json(route, 200, { campaigns: [], applications: [], officers: [], devices: [], total: 0, nextCursor: null }));
  await signIn(page, ['agency_admin'], POSTS.admin);
  await page.goto('/dashboard');

  const marking = page.locator('[role="note"][aria-label]').last();
  await expect(marking).toBeVisible();
  const [m, nav] = await Promise.all([marking.boundingBox(), page.locator('header').first().boundingBox()]);
  expect(m).not.toBeNull();
  expect(nav).not.toBeNull();
  expect(m!.y + m!.height).toBeLessThanOrEqual(nav!.y);
  expect(m!.width).toBeGreaterThan(1300); // spans the page, not shrink-wrapped to its text
});

// Regression: RouterLink used to drop every prop but href/children, so the nav anchors lost the
// className that stretches them over their row. A neighbouring row's decorative overlay then
// intercepted the pointer and only the last item could be clicked. Also: nothing marked the
// current page as selected because AppShell never passed isSelected.
test('every nav item is clickable and the current page is marked selected', async ({ page }) => {
  await page.route('**/edge/v1/**', (route) => json(route, 200, { campaigns: [], applications: [], officers: [], devices: [], total: 0, nextCursor: null }));
  await signIn(page, ['agency_admin'], ['application.read', 'adjudication.read', 'campaign.read.admin', 'officer.read', 'erasure.queue.read']);
  await page.goto('/dashboard');

  const nav = page.locator('nav[data-layout-slot]');
  const items: readonly (readonly [string, string])[] = [
    ['/applications', 'a[href="/applications"]'],
    ['/adjudication', 'a[href="/adjudication"]'],
    ['/campaigns', 'a[href="/campaigns"]'],
    ['/compliance/erasure-queue', 'a[href="/compliance/erasure-queue"]'],
    ['/staff', 'a[href="/staff"]'],
    ['/dashboard', 'a[href="/dashboard"]'],
  ];
  for (const [path, selector] of items) {
    await nav.locator(selector).click({ timeout: 5000 });
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(nav.locator(selector)).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
  }
});
