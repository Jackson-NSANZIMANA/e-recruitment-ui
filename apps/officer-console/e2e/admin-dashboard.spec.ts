import { expect, test, type Page } from '@playwright/test';
import { ID1, ID2, ID3, POSTS, json, officerRow, signIn } from './support';

// The administration dashboard (agency_admin): exceptions first, then campaigns
// with occupancy, applications by stage, staff and the tablet fleet. Every read
// is the edge's own read model; these specs intercept them.

const ADMIN = [...POSTS.admin, 'field.device.manage'];
const hoursFromNow = (h: number): string => new Date(Date.now() + h * 3_600_000).toISOString();
const today = (): string => new Date().toISOString().slice(0, 10);

function campaign(o: Record<string, unknown>): Record<string, unknown> {
  return {
    publicCode: 'RDF-2026-REG', campaignLabel: 'RDF 2026 regular personnel', status: 'REGISTRATION_OPEN',
    targetCategories: ['GENERAL_ENLISTMENT'], targetDistricts: ['NYAGATARE'],
    registrationOpensAt: '2026-10-20T06:00:00.000Z', registrationClosesAt: hoursFromNow(24 * 20),
    examinationStartDate: '2026-12-01', examinationEndDate: '2026-12-02', allowsWalkIn: true, targetIntakeCount: 400,
    publishedAt: '2026-10-20T06:00:00.000Z', createdAt: '2026-10-19T06:00:00.000Z',
    occupancy: { sessionCount: 2, capacityTotal: 300, hasUnboundedSession: false, registeredTotal: 120 },
    ...o,
  };
}

const STAGE_TOTALS: Record<string, number> = {
  'SUBMITTED,ACADEMIC_VETTING,CRIMINAL_CLEARANCE': 42,
  'DOCUMENT_REVIEW_GREEN,DOCUMENT_REVIEW_AMBER,ADJUDICATION_REVIEW': 9,
  'SLOT_ASSIGNED,PHYSICAL_TEST_SCHEDULED,PHYSICAL_TEST_COMPLETE': 31,
  'MEDICAL_REVIEW,FINAL_SHORTLIST': 5,
  ACCEPTED: 3,
  'REJECTED,WITHDRAWN': 11,
};

async function adminReads(page: Page, opts: { fleetFails?: boolean } = {}): Promise<void> {
  await page.route('**/edge/v1/campaigns/admin**', (route) => json(route, 200, {
    agency: 'RDF', total: 3, nextCursor: null,
    campaigns: [
      campaign({ publicCode: 'RDF-2025-DONE', campaignLabel: 'RDF 2025', status: 'COMPLETED', createdAt: '2025-05-01T06:00:00.000Z' }),
      campaign({}),
      campaign({ publicCode: 'RDF-2026-RES', campaignLabel: 'RDF 2026 Reserve Force', registrationClosesAt: hoursFromNow(30), occupancy: { sessionCount: 1, capacityTotal: 100, hasUnboundedSession: false, registeredTotal: 95 } }),
    ],
  }));
  await page.route('**/edge/v1/applications/search**', (route) => {
    const status = new URL(route.request().url()).searchParams.get('status');
    const total = status === null ? 101 : (STAGE_TOTALS[status] ?? 0);
    return json(route, 200, { agency: 'RDF', applications: [], total, nextCursor: null });
  });
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, [{ applicationId: ID1 }, { applicationId: ID2 }]));
  await page.route('**/edge/v1/officers', (route) => json(route, 200, {
    officers: [
      officerRow({ officerId: ID1, loginHandle: 'rdf.admin', posts: ['agency_admin'] }),
      officerRow({ officerId: ID2, loginHandle: 'rdf.med.one', posts: ['medical_officer'] }),
      officerRow({ officerId: ID3, loginHandle: 'rdf.med.two', posts: ['medical_officer'], status: 'pending', activatedAt: null, activationState: 'PENDING_RELEASE', releasableByYou: true }),
    ],
  }));
  await page.route('**/edge/v1/field-sync/devices', (route) => (opts.fleetFails === true
    ? json(route, 503, { error: 'UPSTREAM_UNAVAILABLE' })
    : json(route, 200, {
      devices: [
        { deviceId: 'tab-01', enrolledBy: 'rdf.supervisor', enrolledAt: '2026-10-01T06:00:00.000Z', lastSeenAt: hoursFromNow(-1), lastSeenSource: 'FIELD_SYNC', lastSyncAt: null, revokedAt: null, revokeReason: null, assignment: { campaignPublicCode: 'RDF-2026-REG', district: 'NYAGATARE', examDate: today() } },
        { deviceId: 'tab-02', enrolledBy: 'rdf.supervisor', enrolledAt: '2026-10-01T06:00:00.000Z', lastSeenAt: null, lastSeenSource: null, lastSyncAt: null, revokedAt: null, revokeReason: null, assignment: { campaignPublicCode: 'RDF-2026-REG', district: 'NYAGATARE', examDate: today() } },
        { deviceId: 'tab-03', enrolledBy: 'rdf.supervisor', enrolledAt: '2026-10-01T06:00:00.000Z', lastSeenAt: null, lastSeenSource: null, lastSyncAt: null, revokedAt: '2026-10-10T06:00:00.000Z', revokeReason: 'LOST', assignment: null },
      ],
    })));
}

test('an administrator sees what needs attention first, then campaigns, stages, staff and tablets', async ({ page }) => {
  await signIn(page, ['agency_admin'], ADMIN);
  await adminReads(page);
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Administration', level: 1 })).toBeVisible({ timeout: 15_000 });

  const attention = page.getByTestId('attention-list');
  await expect(attention).toBeVisible();
  await expect(page.getByTestId('attention-amber')).toContainText('Applications awaiting adjudication: 2');
  await expect(page.getByTestId('attention-pending_release')).toContainText('Activation codes waiting for your release: 1');
  await expect(page.getByTestId('attention-closing')).toContainText('RDF 2026 Reserve Force');
  await expect(page.getByTestId('attention-near_capacity')).toContainText('RDF 2026 Reserve Force');
  await expect(page.getByTestId('attention-stale_devices')).toContainText('Assigned tablets not seen in 24 hours: 1');
  await page.getByTestId('attention-amber').getByRole('link', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/adjudication$/);
  await page.goBack();

  await expect(page.getByTestId('metric-open-campaigns')).toContainText('2');
  await expect(page.getByTestId('metric-applications-total')).toContainText('101');
  await expect(page.getByTestId('metric-requires-action')).toContainText('2');
  await expect(page.getByTestId('metric-active-officers')).toContainText('2');
  await expect(page.getByTestId('metric-active-devices')).toContainText('2');

  const rows = page.getByTestId('dashboard-campaigns').locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('Registration open');
  await expect(rows.last()).toContainText('RDF 2025');
  await expect(rows.last()).toContainText('Completed');
  await expect(page.getByTestId('campaign-row-RDF-2026-RES')).toContainText('95 of 100');
  await expect(page.getByRole('meter', { name: '95 of 100' })).toHaveAttribute('aria-valuenow', '95');

  await expect(page.getByTestId('stage-vetting-total')).toHaveText('42');
  await expect(page.getByTestId('stage-exam-total')).toHaveText('31');
  await expect(page.getByTestId('stage-closed-total')).toHaveText('11');

  await expect(page.getByTestId('staff-active')).toContainText('2');
  await expect(page.getByTestId('staff-pending')).toContainText('1');
  await expect(page.getByTestId('post-medical_officer')).toContainText('Medical officer');

  await expect(page.getByTestId('fleet-active')).toContainText('2');
  await expect(page.getByTestId('fleet-seen-today')).toContainText('1');
  await expect(page.getByTestId('fleet-revoked')).toContainText('1');
});

test('one failing read shows its own retry; the rest of the dashboard stays', async ({ page }) => {
  await signIn(page, ['agency_admin'], ADMIN);
  await adminReads(page, { fleetFails: true });
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-fleet').getByTestId('panel-error')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('dashboard-fleet').getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByTestId('dashboard-partial')).toBeVisible();
  await expect(page.getByTestId('campaign-row-RDF-2026-REG')).toBeVisible();
  await expect(page.getByTestId('staff-active')).toContainText('2');
});

test('nothing to act on reads as all clear, never as a blank page', async ({ page }) => {
  await signIn(page, ['agency_admin'], POSTS.admin);
  await page.route('**/edge/v1/campaigns/admin**', (route) => json(route, 200, { agency: 'RDF', total: 1, nextCursor: null, campaigns: [campaign({})] }));
  await page.route('**/edge/v1/applications/search**', (route) => json(route, 200, { agency: 'RDF', applications: [], total: 0, nextCursor: null }));
  await page.route('**/edge/v1/officers', (route) => json(route, 200, { officers: [officerRow({ officerId: ID1, loginHandle: 'rdf.admin', posts: ['agency_admin'] })] }));
  await page.goto('/dashboard');
  await expect(page.getByTestId('attention-none')).toContainText('Nothing requires attention.', { timeout: 15_000 });
  await expect(page.getByTestId('dashboard-fleet')).toHaveCount(0);
});

test('a case-working post keeps the exception counts it acts on', async ({ page }) => {
  await signIn(page, ['medical_officer'], POSTS.medical);
  await page.goto('/dashboard');
  await expect(page.getByTestId('metric-total-applications')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('dashboard-attention')).toHaveCount(0);
});
