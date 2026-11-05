import { expect, test } from '@playwright/test';
import { ID1, ID2, ID3, POSTS, json, officerRow, signIn } from './support';
import { analyticsReads } from './analytics-fixture';

// The dashboard's charts, against real-shaped reads: the queue's arrival trend with a hover
// tooltip, the capacity bars (a nearly-full campaign is flagged in words and in the share),
// and the pipeline bars (each stage's count is printed, never left to be read off a length).

const ADMIN = [...POSTS.admin, 'field.device.manage'];
test.use({ viewport: { width: 1440, height: 1600 } });

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();
const campaign = (o: Record<string, unknown>): Record<string, unknown> => ({
  publicCode: 'RDF-2026-REG', campaignLabel: 'RDF 2026 regular personnel', status: 'REGISTRATION_OPEN',
  targetCategories: ['GENERAL_ENLISTMENT'], targetDistricts: ['NYAGATARE'],
  registrationOpensAt: '2026-10-20T06:00:00.000Z', registrationClosesAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
  examinationStartDate: '2026-12-01', examinationEndDate: '2026-12-02', allowsWalkIn: true, targetIntakeCount: 400,
  publishedAt: '2026-10-20T06:00:00.000Z', createdAt: '2026-10-19T06:00:00.000Z',
  occupancy: { sessionCount: 2, capacityTotal: 300, hasUnboundedSession: false, registeredTotal: 120 }, ...o,
});

test('the queue trend shows each day, a hover tooltip with the exact count, and the capacity bars flag a full campaign', async ({ page }) => {
  await signIn(page, ['agency_admin'], ADMIN);
  await page.route('**/edge/v1/campaigns/admin**', (route) => json(route, 200, {
    agency: 'RDF', total: 2, nextCursor: null,
    campaigns: [
      campaign({}),
      campaign({ publicCode: 'RDF-2026-RES', campaignLabel: 'RDF 2026 Reserve Force', occupancy: { sessionCount: 1, capacityTotal: 100, hasUnboundedSession: false, registeredTotal: 95 } }),
    ],
  }));
  await page.route('**/edge/v1/applications/search**', (route) => json(route, 200, { agency: 'RDF', applications: [], total: 10, nextCursor: null }));
  // Three waiting items: two arrived yesterday, one today.
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, [
    { applicationId: ID1, queuedAt: daysAgo(1) }, { applicationId: ID2, queuedAt: daysAgo(1) }, { applicationId: ID3, queuedAt: new Date().toISOString() },
  ]));
  await page.route('**/edge/v1/officers', (route) => json(route, 200, { officers: [officerRow({ officerId: ID1, loginHandle: 'rdf.admin', posts: ['agency_admin'] })] }));
  await page.route('**/edge/v1/field-sync/devices', (route) => json(route, 200, { devices: [] }));
  await page.goto('/dashboard');

  const trend = page.getByTestId('arrivals-chart');
  await expect(trend).toBeVisible();
  // The chart's own data table carries every day for assistive technology: seven rows, the counts 2 and 1 among them.
  const rows = trend.locator('tbody tr');
  await expect(rows).toHaveCount(7);
  await expect(rows.nth(5).locator('td')).toHaveText('2');
  await expect(rows.nth(6).locator('td')).toHaveText('1');
  await expect(page.getByText(/nothing has arrived/i)).toHaveCount(0);

  // Hover the yesterday point: the tooltip names the exact reading.
  const group = trend.getByRole('group');
  const box = await group.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.77, box!.y + 90);
  await expect(trend.getByRole('status')).toContainText('2');
  await expect(trend.getByRole('status')).toContainText(/arrivals/i);
  // ...and the keyboard reaches the same readings.
  await group.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(trend.getByRole('status')).toBeVisible();

  // Capacity: each bar prints "registered of capacity" and its share; the nearly-full one reads 95%.
  await expect(page.getByTestId('capacity-RDF-2026-REG')).toContainText('120 of 300');
  await expect(page.getByTestId('capacity-RDF-2026-REG')).toContainText('40%');
  await expect(page.getByTestId('capacity-RDF-2026-RES')).toContainText('95 of 100');
  await expect(page.getByTestId('capacity-RDF-2026-RES')).toContainText('95%');
});

test('an empty queue says so in words instead of drawing a quiet-looking chart', async ({ page }) => {
  await signIn(page, ['agency_admin'], ADMIN);
  await page.route('**/edge/v1/campaigns/admin**', (route) => json(route, 200, { agency: 'RDF', total: 0, nextCursor: null, campaigns: [] }));
  await page.route('**/edge/v1/applications/search**', (route) => json(route, 200, { agency: 'RDF', applications: [], total: 0, nextCursor: null }));
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, []));
  await page.route('**/edge/v1/officers', (route) => json(route, 200, { officers: [] }));
  await page.route('**/edge/v1/field-sync/devices', (route) => json(route, 200, { devices: [] }));
  await page.goto('/dashboard');
  await expect(page.getByTestId('arrivals-chart')).toContainText('Nothing has arrived in the last 7 days.');
  await expect(page.getByTestId('dashboard-capacity')).toContainText('No open campaign has a capacity limit.');
  // Zero stages still print their zeros: the chart keeps its shape.
  await expect(page.getByTestId('stage-vetting-total')).toHaveText('0');
});

// Layout contracts the screenshots cannot hold: KPI tiles are one height, the all-clear notice is
// compact, and an empty campaigns panel is a blank state whose button only a creator sees.
async function emptyReads(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/edge/v1/campaigns/admin**', (route) => json(route, 200, { agency: 'RDF', total: 0, nextCursor: null, campaigns: [] }));
  await page.route('**/edge/v1/applications/search**', (route) => json(route, 200, { agency: 'RDF', applications: [], total: 0, nextCursor: null }));
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, []));
  await page.route('**/edge/v1/officers', (route) => json(route, 200, { officers: [] }));
  await page.route('**/edge/v1/field-sync/devices', (route) => json(route, 200, { devices: [] }));
}

test('the hero KPI cards are one height and the all-clear notice does not span the page', async ({ page }) => {
  await signIn(page, ['agency_admin'], ADMIN);
  await emptyReads(page);
  await page.goto('/dashboard');
  const ids = ['metric-open-campaigns', 'metric-applications-total', 'metric-requires-action'];
  const heights: number[] = [];
  for (const id of ids) {
    await expect(page.getByTestId(id)).toBeVisible();
    heights.push(Math.round((await page.getByTestId(id).boundingBox())!.height));
  }
  expect(new Set(heights).size).toBe(1);
  const notice = await page.getByTestId('dashboard-attention').boundingBox();
  const page_ = await page.getByTestId('dashboard-metrics').boundingBox();
  expect(notice!.width).toBeLessThan(page_!.width / 2);
});

test('an empty campaigns panel is a blank state with a create button for a creator', async ({ page }) => {
  await signIn(page, ['agency_admin'], [...ADMIN, 'campaign.create']);
  await emptyReads(page);
  await page.goto('/dashboard');
  const blank = page.getByTestId('campaigns-blank');
  await expect(blank.getByRole('heading', { name: 'No campaigns yet' })).toBeVisible();
  await expect(blank.getByRole('link', { name: 'Create campaign' })).toHaveAttribute('href', '/campaigns/new');
});

test('a post that cannot create campaigns sees the blank state without the button', async ({ page }) => {
  await signIn(page, ['agency_admin'], ['campaign.read.admin', 'officer.read', 'application.read', 'adjudication.read']);
  await emptyReads(page);
  await page.goto('/dashboard');
  await expect(page.getByTestId('campaigns-blank').getByRole('heading', { name: 'No campaigns yet' })).toBeVisible();
  await expect(page.getByTestId('campaigns-blank-create')).toHaveCount(0);
});

// The home dashboard's filters and hero cards, against the deterministic fake of the edge's search.
test('the campaign filter narrows the pipeline and the period filter changes the trend window', async ({ page }) => {
  await signIn(page, ['agency_admin'], ADMIN);
  await analyticsReads(page);
  await page.goto('/dashboard');
  await expect(page.getByTestId('stage-vetting-total')).toHaveText('64'); // 42 + 20 + 2, all campaigns
  await page.getByTestId('filter-campaign').getByRole('combobox').selectOption('RDF-2026-RES');
  await expect(page.getByTestId('stage-vetting-total')).toHaveText('20'); // that campaign alone
  await expect(page.getByTestId('stage-exam-total')).toHaveText('10');

  const chart = page.getByTestId('received-chart');
  await expect(chart.locator('tbody tr')).toHaveCount(7);
  await page.getByTestId('filter-period').getByRole('combobox').selectOption('14');
  await expect(chart.locator('tbody tr')).toHaveCount(14);
});

test('the hero cards show a change badge, and the queue lists the longest-waiting items first', async ({ page }) => {
  await signIn(page, ['agency_admin'], ADMIN);
  await analyticsReads(page);
  await page.goto('/dashboard');
  // Applications received: a figure and a change against the previous period.
  await expect(page.getByTestId('metric-applications-total')).toBeVisible();
  await expect(page.getByTestId('metric-applications-total-delta')).toContainText('%');
  // Longest waiting: oldest first (6 days, then 2 days, then today).
  await expect(page.getByTestId('queue-item-0')).toContainText('RDF-0001');
  await expect(page.getByTestId('queue-item-0')).toContainText('6 days');
  await expect(page.getByTestId('queue-item-2')).toContainText('Today');
});
