import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * D8 — the citizen's upload journey, in a real browser over the real bundle,
 * with the edge intercepted. It proves what the applicant sees for each answer
 * the D8 contract can return: a first upload, a replacement, an identical
 * retry, and both closed-review refusals.
 *
 * WHAT THIS FILE DOES NOT PROVE, AND WHAT IS STILL OWED. The edge responses
 * below are controlled, so this proves the UI renders the server's answer
 * truthfully — it does NOT prove the backend numbers revisions or that a
 * reviewed document is really refused. The backend-contract proof (upload →
 * revision 1 → replacement → revision 2 → refusal once reviewed, through the
 * real forensics → identity → edge chain at the approved SHA) still owes on
 * e-recruitment PR #61 being merged and the integration baseline being
 * approved. Until then this file is the browser half only, and must not be
 * reported as D8 completion.
 */
const APP = '33333333-3333-4333-8333-333333333333';
const CAMPAIGN = {
  publicCode: 'RDF-2026',
  campaignLabel: 'RDF 2026 general enlistment',
  agency: 'RDF',
  status: 'REGISTRATION_OPEN',
  registrationOpensAt: '2026-10-01T00:00:00.000Z',
  registrationClosesAt: '2099-11-30T00:00:00.000Z',
  examinationStartDate: '2099-12-10',
  examinationEndDate: '2099-12-20',
  targetCategories: ['GENERAL_ENLISTMENT'],
  targetDistricts: ['GASABO'],
  allowsWalkIn: true,
  contactPhoneNumbers: null,
  contactWebsite: null,
};
const FILED = { status: 'SUBMITTED', applicationId: APP, processingCode: 'RDF-10001', agency: 'RDF' };

const HUMAN_REVIEWED = 'This document has already been reviewed. To replace it, contact the recruitment office to re-open it.';
const CASE_ADVANCED = 'This application has moved past document review, so documents can no longer be replaced.';
const GENERIC = 'The document could not be uploaded. Check the file and try again.';

async function mockEdge(page: Page): Promise<void> {
  // Pin the language: these specs prove the flow, not the host machine's locale.
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kind: 'applicant', idleExpiresAt: '2099-01-01T00:00:00.000Z', absoluteExpiresAt: '2099-01-02T00:00:00.000Z' }),
    }),
  );
  await page.route('**/edge/v1/campaigns', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaigns: [CAMPAIGN] }) })
      : route.fulfill({ status: 405 }),
  );
  await page.route('**/edge/v1/me/applications', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FILED) })
      : route.fallback(),
  );
}

/** File the application so the documents panel mounts, as it does after a filing. */
async function fileApplication(page: Page): Promise<void> {
  await page.goto('/apply');
  await page.getByRole('button', { name: /apply to this recruitment/i }).click({ timeout: 15_000 });
  await page.getByLabel(/recruitment category/i).click();
  await page.getByText('RDF general enlistment', { exact: true }).click();
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByLabel(/nesa index number/i).fill('RW2026/1001');
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByRole('button', { name: /i agree/i }).click();
  await page.getByRole('button', { name: /submit application/i }).click();
  await expect(page.getByText(/submitted — application filed/i)).toBeVisible({ timeout: 15_000 });
}

/** Reply to the next N uploads with `replies`, in order; the last one repeats. */
function replyToUploads(replies: readonly { status: number; body: unknown }[], seen: number[]): (route: Route) => Promise<void> {
  return async (route: Route) => {
    const count = seen.push(1);
    const reply = replies[Math.min(count - 1, replies.length - 1)]!;
    await route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
  };
}

const UPLOADED = (revision: number): { status: number; body: unknown } => ({
  status: 201,
  body: { status: 'UPLOADED', documentId: 'doc-internal-0001', documentType: 'NATIONAL_ID', revision },
});

const REFUSED = (reason?: string): { status: number; body: unknown } => ({
  status: 409,
  body: reason === undefined ? { error: 'DOCUMENT_REVIEW_CLOSED' } : { error: 'DOCUMENT_REVIEW_CLOSED', reason },
});

/** Pick a file and press Upload: the only two citizen actions on the panel. */
async function upload(page: Page, name: string): Promise<void> {
  await page.setInputFiles('#document-file', { name, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 ${name}`) });
  await page.getByRole('button', { name: /upload document/i }).click();
}

test('a first upload names revision 1, a replacement moves it to revision 2', async ({ page }) => {
  await mockEdge(page);
  const seen: number[] = [];
  await page.route('**/edge/v1/me/applications/documents', replyToUploads([UPLOADED(1), UPLOADED(2)], seen));

  await fileApplication(page);
  await upload(page, 'national-id-v1.pdf');
  await expect(page.getByTestId('documents-received')).toContainText('National ID (revision 1)', { timeout: 15_000 });

  await upload(page, 'national-id-v2.pdf');
  await expect(page.getByTestId('documents-received')).toContainText('National ID (revision 2)', { timeout: 15_000 });
  await expect(page.getByTestId('documents-received')).not.toContainText('revision 1');
  expect(seen).toHaveLength(2);
});

test('an identical retry shows the same revision, not a new one', async ({ page }) => {
  await mockEdge(page);
  const seen: number[] = [];
  await page.route('**/edge/v1/me/applications/documents', replyToUploads([UPLOADED(1)], seen));

  await fileApplication(page);
  await upload(page, 'national-id.pdf');
  await expect(page.getByTestId('documents-received')).toContainText('National ID (revision 1)', { timeout: 15_000 });

  await upload(page, 'national-id.pdf');
  await expect(page.getByTestId('documents-received')).toContainText('National ID (revision 1)', { timeout: 15_000 });
  await expect(page.getByTestId('documents-received')).not.toContainText('revision 2');
  expect(seen).toHaveLength(2);
});

test('HUMAN_REVIEWED explains that the recruitment office must re-open it', async ({ page }) => {
  await mockEdge(page);
  await page.route('**/edge/v1/me/applications/documents', replyToUploads([REFUSED('HUMAN_REVIEWED')], []));

  await fileApplication(page);
  await upload(page, 'national-id.pdf');
  await expect(page.getByText(HUMAN_REVIEWED)).toBeVisible({ timeout: 15_000 });
});

test('CASE_ADVANCED explains that the application has moved on', async ({ page }) => {
  await mockEdge(page);
  await page.route('**/edge/v1/me/applications/documents', replyToUploads([REFUSED('CASE_ADVANCED')], []));

  await fileApplication(page);
  await upload(page, 'national-id.pdf');
  await expect(page.getByText(CASE_ADVANCED)).toBeVisible({ timeout: 15_000 });
});

test('an unknown or absent reason shows the generic safe error and no backend text', async ({ page }) => {
  await mockEdge(page);
  await page.route('**/edge/v1/me/applications/documents', replyToUploads([REFUSED('SOMETHING_NEW')], []));

  await fileApplication(page);
  await upload(page, 'national-id.pdf');

  await expect(page.getByText(GENERIC)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('SOMETHING_NEW')).toHaveCount(0);
  await expect(page.getByText('DOCUMENT_REVIEW_CLOSED')).toHaveCount(0);
  await expect(page.getByText('doc-internal-0001')).toHaveCount(0);
});

test('a closed review offers no way to re-open it from the citizen screen', async ({ page }) => {
  await mockEdge(page);
  await page.route('**/edge/v1/me/applications/documents', replyToUploads([REFUSED('HUMAN_REVIEWED')], []));

  await fileApplication(page);
  await upload(page, 'national-id.pdf');
  await expect(page.getByText(HUMAN_REVIEWED)).toBeVisible({ timeout: 15_000 });

  // The advice is text, not a control: the citizen cannot act on it here.
  await expect(page.getByRole('button', { name: /re-?open|unlock|replace/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /re-?open|unlock|replace/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /upload document/i })).toBeVisible();
});
