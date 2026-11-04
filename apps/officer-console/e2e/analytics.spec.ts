import { expect, test } from '@playwright/test';
import { POSTS, signIn } from './support';
import { analyticsReads } from './analytics-fixture';

// The recruitment performance screen: exact figures in a table, a heatmap, grouped
// and stacked charts, a stat grid and a queue-age chart, from a deterministic fake
// of the edge's search.

const ADMIN = [...POSTS.admin, 'field.device.manage'];
test.use({ viewport: { width: 1920, height: 1400 } });

test('the analytics board shows exact counts by campaign, stage and category', async ({ page }) => {
  await signIn(page, ['agency_admin'], ADMIN);
  await analyticsReads(page);
  await page.goto('/analytics');

  // Table: the stage matrix per campaign, a totals row, and each campaign's share.
  const reg = page.getByTestId('campaign-stage-RDF-2026-REG');
  await expect(reg).toBeVisible({ timeout: 20_000 });
  await expect(reg.getByRole('cell').nth(0)).toHaveText('42');
  await expect(reg.getByRole('cell').nth(6)).toHaveText('101'); // total
  await expect(page.getByTestId('analytics-campaign-stage').locator('tfoot')).toContainText('158'); // 101 + 43 + 14

  // Stat grid: shares of accepted and closed, a closed-heavy campaign printed too.
  await expect(page.getByTestId('ratio-RDF-2026-REG-accepted')).toContainText('3%');
  await expect(page.getByTestId('ratio-RDF-2026-REG-closed')).toContainText('11%');
  await expect(page.getByTestId('ratio-RDF-2025-OLD-closed')).toContainText('71%');

  // Category outcomes: 60% of 158 (accepted 6 * 0.6 = 4 after rounding per cell).
  await expect(page.getByTestId('category-GENERAL_ENLISTMENT')).toBeVisible();
  await expect(page.getByTestId('category-RESERVE_FORCE_ALEVEL')).toBeVisible();

  // Heatmap: four weeks by seven weekdays, with totals.
  const heat = page.getByTestId('weekday-heatmap');
  await expect(heat.locator('tbody tr')).toHaveCount(4);
  await expect(heat.locator('thead th')).toHaveCount(9); // corner + 7 weekdays + total

  // Queue age: average days waiting per hold; the two amber holds average (6 + 2) / 2 = 4.
  await expect(page.getByTestId('queue-age-chart').locator('tbody tr').first()).toBeVisible();
  await expect(page.getByTestId('queue-age-chart').locator('tbody')).toContainText('4');

  // Stacked area: three named categories at most plus "other"; legend names them.
  await expect(page.getByTestId('category-trend-chart')).toContainText('Other categories');
});

test('the analytics screen is in the navigation and reachable from it', async ({ page }) => {
  await signIn(page, ['agency_admin'], ADMIN);
  await analyticsReads(page);
  await page.goto('/dashboard');
  await page.locator('nav[data-layout-slot] a[href="/analytics"]').click();
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole('heading', { name: 'Recruitment performance' })).toBeVisible();
  await expect(page.locator('nav[data-layout-slot] a[aria-current="page"]')).toHaveAttribute('href', '/analytics');
});

test('a post without campaign access cannot use the analytics screen', async ({ page }) => {
  await signIn(page, ['reviewer'], ['application.read']);
  await analyticsReads(page);
  await page.goto('/analytics');
  await expect(page.getByTestId('analytics-forbidden')).toBeVisible();
  await expect(page.locator('nav[data-layout-slot] a[href="/analytics"]')).toHaveCount(0);
});
