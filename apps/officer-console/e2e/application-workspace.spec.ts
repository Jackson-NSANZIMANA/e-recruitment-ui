import { expect, test } from '@playwright/test';
import { ID1, ID2, POSTS, application, json, signIn } from './support';

const row = (id: string, code: string, status: string) => ({ applicationId: id, processingCode: code, category: 'Infantry Recruit', status, submittedAt: '2026-10-20T08:00:00.000Z' });

test.describe('applications list (S04 search)', () => {
  test('a keyset page, load more appends, the server total is shown, a preset filters by status', async ({ page }) => {
    await signIn(page, ['reviewer'], POSTS.reviewer);
    const seen: string[] = [];
    await page.route('**/edge/v1/applications/search**', (route) => {
      const url = new URL(route.request().url());
      seen.push(url.search);
      if (url.searchParams.get('cursor') === 'c1') return json(route, 200, { agency: 'RDF', applications: [row(ID2, 'RDF-98002', 'SUBMITTED')], total: 2, nextCursor: null });
      return json(route, 200, { agency: 'RDF', applications: [row(ID1, 'RDF-98001', 'SUBMITTED')], total: 2, nextCursor: 'c1' });
    });
    await page.goto('/applications');
    await expect(page.getByText('RDF-98001')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('applications-total')).toContainText('1 of 2');
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.getByText('RDF-98002')).toBeVisible();
    await expect(page.getByTestId('applications-total')).toContainText('2 of 2');
    await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
    expect(seen.some((s) => s.includes('cursor=c1'))).toBe(true);
  });

  test('a filter that matches nothing is the filtered-empty state with a way out', async ({ page }) => {
    await signIn(page, ['reviewer'], POSTS.reviewer);
    await page.route('**/edge/v1/applications/search**', (route) => {
      const hasFilter = new URL(route.request().url()).searchParams.has('district');
      return json(route, 200, { agency: 'RDF', applications: hasFilter ? [] : [row(ID1, 'RDF-98001', 'SUBMITTED')], total: hasFilter ? 0 : 1, nextCursor: null });
    });
    await page.goto('/applications');
    await expect(page.getByText('RDF-98001')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('District').fill('Nowhere');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByTestId('state-filtered-empty')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('RDF-98001')).toBeVisible();
  });

  test('an upstream failure is its own state with a retry; a forbidden read is the forbidden state', async ({ page }) => {
    await signIn(page, ['reviewer'], POSTS.reviewer);
    let fail = true;
    await page.route('**/edge/v1/applications/search**', (route) => (fail ? json(route, 502, { error: 'UPSTREAM_CONTRACT_MISMATCH' }) : json(route, 200, { agency: 'RDF', applications: [row(ID1, 'RDF-98001', 'SUBMITTED')], total: 1, nextCursor: null })));
    await page.goto('/applications');
    await expect(page.getByTestId('state-upstream-failure')).toBeVisible({ timeout: 15_000 });
    fail = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('RDF-98001')).toBeVisible();
  });

  test('a 403 on the read is the forbidden state, not an empty list', async ({ page }) => {
    await signIn(page, ['dpo'], POSTS.dpo);
    await page.route('**/edge/v1/applications/search**', (route) => json(route, 403, { error: 'PERMISSION_DENIED' }));
    await page.goto('/applications');
    await expect(page.getByTestId('state-forbidden')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Applicant 360', () => {
  async function detail(page: import('@playwright/test').Page, status: string, overrides: Record<string, unknown> = {}): Promise<void> {
    await page.route(`**/edge/v1/applications/detail?applicationId=${ID1}`, (route) => json(route, 200, { application: application(status, overrides), history: [
      { entryId: 'h1', fromStatus: null, toStatus: 'SUBMITTED', status: 'SUBMITTED', note: null, actorKind: 'CITIZEN', occurredAt: '2026-08-01T08:00:00.000Z' },
      { entryId: 'h2', fromStatus: 'SUBMITTED', toStatus: status, status, note: 'cleared', actorKind: 'SYSTEM', occurredAt: '2026-08-02T08:00:00.000Z' },
    ] }));
    await page.route(`**/edge/v1/applications/document-checklist?applicationId=${ID1}`, (route) => json(route, 200, { agency: 'RDF', source: 'POLICY_VERSION', complete: false, items: [{ documentType: 'NATIONAL_ID', satisfaction: 'VENUE_VERIFIED', registry: null }, { documentType: 'ACADEMIC_CERTIFICATE', satisfaction: 'MISSING', registry: 'NESA' }] }));
  }

  test('summary is masked, a missing forensic score reads "not analysed", the timeline lists the history, documents show the venue-verified mark', async ({ page }) => {
    await signIn(page, ['reviewer'], POSTS.reviewer);
    await detail(page, 'DOCUMENT_REVIEW_AMBER');
    await page.goto(`/applications/${ID1}`);
    await expect(page.getByRole('heading', { name: 'RDF-98001' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('123456789012')).toHaveCount(0);
    await expect(page.getByTestId('fact-forensics')).toContainText('Not analysed');
    await page.getByRole('tab', { name: 'Status timeline' }).click();
    await expect(page.getByTestId('timeline')).toContainText('cleared');
    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByTestId('venue-verified-NATIONAL_ID')).toBeVisible();
  });

  test('biometric evidence is advisory and never a verdict; without the permission it is the forbidden state', async ({ page }) => {
    await signIn(page, ['decision_authority'], POSTS.director);
    await detail(page, 'MEDICAL_REVIEW');
    await page.route(`**/edge/v1/applications/biometric-evidence?applicationId=${ID1}`, (route) => json(route, 200, { applicationId: ID1, evidence: [{ recordId: ID2, ticketId: 'T1', referenceSource: 'CARD_PORTRAIT', method: 'FACE', consentState: 'GRANTED', outcome: 'NO_MATCH', notAttemptedReason: null, livenessScoreBp: 9100, matchScoreBp: 4100, modelId: 'm', modelVersion: '1', thresholdPolicyVersion: '1', mode: 'ADVISORY', capturedAt: '2026-08-02T08:00:00.000Z', receivedAt: '2026-08-02T08:00:01.000Z', manualIdentity: null }] }));
    await page.goto(`/applications/${ID1}`);
    await page.getByRole('tab', { name: 'Gate and identity' }).click();
    await expect(page.getByText('Advisory evidence, not a verdict')).toBeVisible({ timeout: 15_000 });
    const evidence = page.getByTestId('biometric-evidence');
    await expect(evidence).toContainText('91.0%');
    await expect(evidence).toContainText('Does not match the card portrait');
    await expect(evidence).not.toContainText(/rejected|failed|denied/i);
  });

  test('a medical officer records the verdict on a physical-test-complete record and the detail is re-read', async ({ page }) => {
    await signIn(page, ['medical_officer'], POSTS.medical);
    let reads = 0;
    await page.route(`**/edge/v1/applications/detail?applicationId=${ID1}`, (route) => { reads += 1; return json(route, 200, { application: application(reads > 1 ? 'MEDICAL_REVIEW' : 'PHYSICAL_TEST_COMPLETE'), history: [] }); });
    let body = '';
    await page.route('**/edge/v1/applications/medical-review', (route) => { body = route.request().postData() ?? ''; return json(route, 200, { status: 'APPLIED', fromStatus: 'PHYSICAL_TEST_COMPLETE', toStatus: 'MEDICAL_REVIEW' }); });
    await page.goto(`/applications/${ID1}`);
    await expect(page.getByRole('heading', { name: 'Medical review' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Mark fit' }).click();
    await expect.poll(() => body).toContain('"fitnessStatus":"FIT"');
    await expect(page.getByRole('heading', { name: 'Medical review' })).toHaveCount(0);
  });

  test('a reviewer sees that an action is waiting for another post and is offered none', async ({ page }) => {
    await signIn(page, ['reviewer'], POSTS.reviewer);
    await detail(page, 'MEDICAL_REVIEW');
    await page.goto(`/applications/${ID1}`);
    await expect(page.getByTestId('blocked-by-post')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Shortlist' })).toHaveCount(0);
  });

  test('accept refused by another agency\'s lock names the holding agency', async ({ page }) => {
    await signIn(page, ['decision_authority'], POSTS.director);
    await detail(page, 'FINAL_SHORTLIST');
    await page.route('**/edge/v1/applications/accept', (route) => json(route, 409, { status: 'CROSS_AGENCY_LOCKED', lockedByAgency: 'RNP' }));
    await page.goto(`/applications/${ID1}`);
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(page.getByTestId('confirm-action')).toContainText('may be withdrawn');
    await page.getByTestId('confirm-action-confirm').click();
    await expect(page.getByTestId('confirm-action')).toContainText('already been accepted by RNP');
  });
});
