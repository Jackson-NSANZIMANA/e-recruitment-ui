import { expect, test } from '@playwright/test';
import { ID1, ID2, ID3, POSTS, json, signIn } from './support';

const amber = (id: string, code: string, status: string, score: number | null) => ({ applicationId: id, processingCode: code, status, documentType: 'NATIONAL_ID', forensicsScore: score, forensicsFlags: null, queuedAt: '2026-10-18T08:00:00.000Z', agency: 'RDF' });
const search = (rows: { id: string; code: string; status: string }[]) => ({ agency: 'RDF', applications: rows.map((r) => ({ applicationId: r.id, processingCode: r.code, category: 'Infantry Recruit', status: r.status, submittedAt: '2026-10-19T08:00:00.000Z' })), total: rows.length, nextCursor: null });

test('amber queue: the forensic signal is words ("not analysed" when null), the hold is cleared through a confirmation', async ({ page }) => {
  await signIn(page, ['adjudicator'], POSTS.adjudicator);
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, [amber(ID1, 'RDF-1', 'DOCUMENT_REVIEW_AMBER', null), amber(ID2, 'RDF-2', 'DOCUMENT_REVIEW_AMBER', 0.5), amber(ID3, 'RDF-3', 'ADJUDICATION_REVIEW', null)]));
  let body = '';
  await page.route('**/edge/v1/applications/adjudicate', (route) => { body = route.request().postData() ?? ''; return json(route, 200, { status: 'APPLIED', fromStatus: 'DOCUMENT_REVIEW_AMBER', toStatus: 'DOCUMENT_REVIEW_GREEN' }); });
  await page.goto('/adjudication/amber-queue');
  const table = page.getByTestId('queue-amber');
  await expect(table).toContainText('RDF-1', { timeout: 15_000 });
  await expect(table.getByTestId('forensics-unscored')).toHaveText('Not analysed');
  await expect(table.getByTestId('forensics-signal')).toContainText('Weaker signal');
  await expect(table).not.toContainText('RDF-3');
  await table.getByRole('button', { name: 'Clear hold: RDF-1' }).click();
  await expect(page.getByTestId('confirm-action')).toContainText('autonomous processing lane');
  await page.getByTestId('confirm-action-confirm').click();
  await expect.poll(() => body).toContain('"decision":"CLEAR"');
  await page.getByRole('tab', { name: 'Holds' }).click();
  await expect(page.getByTestId('queue-holds')).toContainText('RDF-3');
});

/**
 * D10. The queue read also serves LIVE rows held on a registry review
 * (criminal clearance UNDER_REVIEW, NESA review). Before this test existed the
 * console DROPPED them — the dashboard counted them and the queue showed fewer
 * rows than the count, with nothing explaining the difference — and when one did
 * reach a table it was offered Clear and Reject, which the adjudicate
 * transaction answers NOT_APPLICABLE to. Now: listed, explained in words, and
 * Open is the only action.
 */
test('D10: a registry hold is listed with its reason in words and offers no decision', async ({ page }) => {
  await signIn(page, ['adjudicator'], POSTS.adjudicator);
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, [
    amber(ID1, 'RDF-1', 'DOCUMENT_REVIEW_AMBER', 0.5),
    { applicationId: ID2, processingCode: 'RNP-2', status: 'CRIMINAL_CLEARANCE', documentType: null, forensicsScore: null, forensicsFlags: null, queuedAt: '2026-10-18T09:00:00.000Z', reasons: ['CRIMINAL_RECORD_REVIEW'], agency: 'RDF' },
    { applicationId: ID3, processingCode: 'RCS-3', status: 'ACADEMIC_VETTING', documentType: null, forensicsScore: null, forensicsFlags: null, queuedAt: '2026-10-18T10:00:00.000Z', reasons: ['NESA_LEVEL_UNKNOWN', 'SOMETHING_NEW'], agency: 'RDF' },
  ]));
  await page.goto('/adjudication');
  await page.getByRole('tab', { name: 'Holds' }).click();
  const table = page.getByTestId('queue-holds');
  // Listed at all — the regression that hid these rows.
  await expect(table).toContainText('RNP-2', { timeout: 15_000 });
  await expect(table).toContainText('RCS-3');
  // The reason, in words; and a code this build cannot name is still shown.
  await expect(table).toContainText('Criminal record needs a human reading');
  await expect(table).toContainText('Unrecognised reason (SOMETHING_NEW)');
  // Told why there is no button, rather than being given one that must fail.
  await expect(page.getByTestId('registry-hint')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Clear hold: RNP-2$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Reject: RNP-2$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Open: RNP-2$/ })).toBeVisible();
});

test('a reviewer sees the queue read-only: no decision buttons', async ({ page }) => {
  await signIn(page, ['reviewer'], POSTS.reviewer);
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, [amber(ID1, 'RDF-1', 'DOCUMENT_REVIEW_AMBER', 0.95)]));
  await page.goto('/adjudication');
  await expect(page.getByTestId('queue-amber')).toContainText('Cleaner signal', { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Clear hold/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Open: RDF-1$/ })).toBeVisible();
});

test('medical queue sends the officer to the record to give the verdict', async ({ page }) => {
  await signIn(page, ['medical_officer'], POSTS.medical);
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, []));
  await page.route('**/edge/v1/applications/search**', (route) => json(route, 200, search([{ id: ID1, code: 'RDF-1', status: 'PHYSICAL_TEST_COMPLETE' }])));
  await page.goto('/adjudication');
  await page.getByRole('tab', { name: 'Medical' }).click();
  await page.getByRole('button', { name: 'Record verdict: RDF-1' }).click();
  await expect(page).toHaveURL(new RegExp(`/applications/${ID1}$`));
});

test('final queue: bulk shortlist runs one record at a time and reports each record, including a refusal', async ({ page }) => {
  await signIn(page, ['decision_authority'], POSTS.director);
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, []));
  await page.route('**/edge/v1/applications/search**', (route) => json(route, 200, search([{ id: ID1, code: 'RDF-1', status: 'MEDICAL_REVIEW' }, { id: ID2, code: 'RDF-2', status: 'MEDICAL_REVIEW' }, { id: ID3, code: 'RDF-3', status: 'FINAL_SHORTLIST' }])));
  const decided: string[] = [];
  let inFlight = 0;
  let overlapped = false;
  await page.route('**/edge/v1/applications/final-decision', async (route) => {
    inFlight += 1;
    if (inFlight > 1) overlapped = true;
    const id = (JSON.parse(route.request().postData() ?? '{}') as { applicationId: string }).applicationId;
    decided.push(id);
    await new Promise((r) => setTimeout(r, 50));
    inFlight -= 1;
    return id === ID2 ? json(route, 409, { status: 'ILLEGAL_TRANSITION' }) : json(route, 200, { status: 'APPLIED', fromStatus: 'MEDICAL_REVIEW', toStatus: 'FINAL_SHORTLIST' });
  });
  await page.goto('/adjudication');
  await page.getByRole('tab', { name: 'Final decision' }).click();
  await page.getByRole('button', { name: 'Shortlist everyone awaiting a decision' }).click();
  await expect(page.getByTestId('confirm-action')).toContainText('2 records');
  await page.getByTestId('confirm-action-confirm').click();
  const results = page.getByTestId('bulk-results');
  await expect(results).toContainText('RDF-1: Applied', { timeout: 15_000 });
  await expect(results).toContainText('RDF-2: Refused (ILLEGAL_TRANSITION)');
  expect(decided).toEqual([ID1, ID2]);
  expect(overlapped).toBe(false);
});

test('a data protection officer has no queues: the forbidden state', async ({ page }) => {
  await signIn(page, ['dpo'], POSTS.dpo);
  await page.goto('/adjudication');
  await expect(page.getByTestId('state-forbidden')).toBeVisible({ timeout: 15_000 });
});
