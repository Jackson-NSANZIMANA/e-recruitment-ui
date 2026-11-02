import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

/**
 * D8 — the citizen's upload journey, in a real browser over the real bundle,
 * with the edge intercepted. It proves what the applicant sees for each answer
 * the D8 contract can return: a first upload, a replacement, an identical
 * retry, both closed-review refusals, an unknown reason, an absent reason, and
 * a 2xx the client cannot trust.
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
/** A synthetic identity, so the wizard's read-only NIDA block never calls the edge. */
const IDENTITY = {
  fullName: 'UMUTONI Alice',
  sex: 'FEMALE',
  dateOfBirth: '2002-05-14',
  homeDistrict: 'GASABO',
  homeProvince: 'KIGALI',
  placeOfBirth: null,
  nationality: null,
};

/**
 * THE WIZARD WALK, AND WHY IT NO LONGER RELIES ON A LONG WAIT.
 *
 * The walk to the documents panel is setup, not the thing under test: nothing
 * in `DocumentsPanel` is exercised while it renders. It was also the only
 * flaky part of this file. Raising its wait from 20 s to 45 s (commit
 * 1800cf9) did not fix it — CI run 41364349616 still flaked 7 of these 8
 * specs, all of them at the same place, and passed only on Playwright's
 * retries.
 *
 * The cause is not slowness. Atlaskit's `Form` validates asynchronously, and
 * `StepEducation`'s submit handler RETURNS EARLY on an empty value with no
 * error and no movement. A `next` click that lands while validation is still
 * in flight is therefore discarded: the step never changes, and no wait,
 * however long, will produce the next step. A fresh attempt works because
 * validation has settled by then — which is exactly the signature of a
 * swallowed click, and exactly why the old harness greened on retry.
 *
 * So the walk below does two things instead of waiting longer. It waits for
 * each step to ACTUALLY ARRIVE, and it re-clicks a `next` whose landing step
 * did not appear (see `advance`). A swallowed click now heals in seconds
 * rather than burning 45 s and then being retried by the runner.
 *
 * 90 s stays as the whole-test ceiling: the walk is bounded well below it, and
 * every D8 assertion below keeps its own much shorter expectation, so a real
 * product failure still fails fast.
 */
test.setTimeout(90_000);

/**
 * Motion is switched off in `mockEdge`, below: Atlaskit animates step
 * transitions and select menus, and on a loaded runner those animations are
 * what make a click land on an element that is still moving. Nothing asserted
 * in this file is about motion.
 */

const HUMAN_REVIEWED = 'This document has already been reviewed. To replace it, contact the recruitment office to re-open it.';
const CASE_ADVANCED = 'This application has moved past document review, so documents can no longer be replaced.';
const GENERIC = 'The document could not be uploaded. Check the file and try again.';
const UNCONFIRMED_TITLE = 'We could not confirm this upload';
const UNCONFIRMED_BODY = 'We could not confirm whether this document was received.';

async function mockEdge(page: Page): Promise<void> {
  // Pin the language: these specs prove the flow, not the host machine's locale.
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  /**
   * Motion off, applied as CSS rather than through a Playwright context option
   * (which this runner's version does not expose as a `use` fixture). Atlaskit
   * animates wizard step transitions and select menus; a click that lands on a
   * still-moving element is a click that may be dropped. `!important` on the
   * durations — not on `display` — so nothing is hidden, only made instant.
   */
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent =
      '*,*::before,*::after{animation-duration:1ms !important;animation-delay:0ms !important;' +
      'transition-duration:1ms !important;transition-delay:0ms !important;}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  });
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
  // Every other spec in this app leaves the NIDA read unmocked, so it goes to the
  // dev server's /edge proxy and resolves whenever that fails. Mocking it removes
  // a per-test network race from the wizard walk.
  await page.route('**/edge/v1/me/identity', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(IDENTITY) }),
  );
  // The advisory checklist the panel reads to RECONCILE an upload it cannot
  // confirm. It carries no revision, so it can only ever say "on file". A test
  // that needs a different answer re-routes it after calling this.
  await page.route('**/edge/v1/me/applications/document-checklist*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agency: 'RDF', source: 'POLICY_VERSION', complete: false, items: [] }),
    }),
  );
}

/**
 * Press a `next` that submits an Atlaskit `Form`, and wait for `landing` — a
 * control ONLY the following step renders — to appear. When the click is
 * swallowed, press again.
 *
 * `landing` is what makes this safe as well as useful: the retry fires solely
 * while the walk is still on the step it started from, so it can never submit
 * twice or skip a step. After the last attempt the original error propagates,
 * so a step that genuinely refuses to advance still fails the test.
 *
 * This is deliberately NOT used for "I agree" or "submit application". Those
 * are direct `onClick`s, not validated form submits, and the second has a side
 * effect — a duplicate filing is not a thing to retry into.
 */
async function advance(page: Page, name: RegExp, landing: Locator, attempts = 3): Promise<void> {
  const trigger = page.getByRole('button', { name });
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await trigger.click({ timeout: 15_000 });
    try {
      await expect(landing).toBeVisible({ timeout: 7_000 });
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
    }
  }
}

/** File the application so the documents panel mounts, as it does after a filing. */
async function fileApplication(page: Page): Promise<void> {
  await page.goto('/apply');

  // Campaign → category.
  await advance(page, /apply to this recruitment/i, page.getByLabel(/recruitment category/i));

  // Category → education. The select is opened and its option chosen before
  // `next` is pressed, because a `next` carrying no category is rejected.
  await page.getByLabel(/recruitment category/i).click();
  await page.getByText('RDF general enlistment', { exact: true }).click();
  await advance(page, /^next$/i, page.getByLabel(/nesa index number/i));

  // Education → declaration. The fill is asserted to have landed: the step's
  // submit handler returns early on an empty value, so a `next` pressed
  // against a field the form has not registered yet is silently discarded.
  const nesa = page.getByLabel(/nesa index number/i);
  await nesa.fill('RW2026/1001');
  await expect(nesa).toHaveValue('RW2026/1001');
  await advance(page, /^next$/i, page.getByRole('button', { name: /i agree/i }));

  // Declaration → review, then the filing itself.
  await page.getByRole('button', { name: /i agree/i }).click();
  const submit = page.getByRole('button', { name: /submit application/i });
  await expect(submit).toBeVisible({ timeout: 15_000 });
  await submit.click();
  await expect(page.getByText(/submitted — application filed/i)).toBeVisible({ timeout: 15_000 });

  // The panel only mounts inside the filed confirmation.
  await expect(page.getByText(/upload your documents/i)).toBeVisible({ timeout: 15_000 });
}

/** Reply to the next N uploads with `replies`, in order; the last one repeats. */
function replyToUploads(replies: readonly { status: number; body: unknown }[], seen: number[]): (route: Route) => Promise<void> {
  return async (route: Route) => {
    const count = seen.push(1);
    const reply = replies[Math.min(count - 1, replies.length - 1)]!;
    await route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
  };
}

// A real UUID: the edge's projection re-checks `documentId` against its UUID
// pattern and the api-client decoder does the same, so a synthetic id would be
// refused as drift and the success-path assertions would prove nothing.
const DOCUMENT_ID = '11111111-1111-4111-8111-111111111111';

const UPLOADED = (revision: number): { status: number; body: unknown } => ({
  status: 201,
  body: { status: 'UPLOADED', documentId: DOCUMENT_ID, documentType: 'NATIONAL_ID', revision },
});

/** A 2xx the client CANNOT trust: the contract's `revision` is missing. */
const UNCONFIRMED = { status: 201, body: { status: 'UPLOADED', documentId: DOCUMENT_ID, documentType: 'NATIONAL_ID' } };

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

test('an unknown reason shows the generic safe error and no backend text', async ({ page }) => {
  await mockEdge(page);
  await page.route('**/edge/v1/me/applications/documents', replyToUploads([REFUSED('SOMETHING_NEW')], []));

  await fileApplication(page);
  await upload(page, 'national-id.pdf');

  await expect(page.getByText(GENERIC)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('SOMETHING_NEW')).toHaveCount(0);
  await expect(page.getByText('DOCUMENT_REVIEW_CLOSED')).toHaveCount(0);
  await expect(page.getByText(DOCUMENT_ID)).toHaveCount(0);
});

// Distinct from the case above: a reason the server did not send at all is not
// the same defect as a reason the server sent and this build does not know.
test('an absent reason shows the generic safe error and no backend text', async ({ page }) => {
  await mockEdge(page);
  await page.route('**/edge/v1/me/applications/documents', replyToUploads([REFUSED()], []));

  await fileApplication(page);
  await upload(page, 'national-id.pdf');

  await expect(page.getByText(GENERIC)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('DOCUMENT_REVIEW_CLOSED')).toHaveCount(0);
  await expect(page.getByText(DOCUMENT_ID)).toHaveCount(0);
  await expect(page.getByText('undefined')).toHaveCount(0);
});

/**
 * A 2xx the client cannot trust. It is NOT a failed upload — the bytes may be
 * stored — so the screen must say the outcome is unconfirmed rather than either
 * "received" or "could not be uploaded", and must never re-send the file:
 * upstream an identical re-upload is a retry, so a recovery upload cannot
 * repair a lost answer.
 */
test('a 201 with no revision is reported as unconfirmed, and the file is not re-sent', async ({ page }) => {
  await mockEdge(page);
  const seen: number[] = [];
  await page.route('**/edge/v1/me/applications/documents', replyToUploads([UNCONFIRMED], seen));

  await fileApplication(page);
  await upload(page, 'national-id.pdf');

  await expect(page.getByText(UNCONFIRMED_TITLE)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(UNCONFIRMED_BODY)).toBeVisible({ timeout: 15_000 });
  // Neither story is told.
  await expect(page.getByTestId('documents-received')).toHaveCount(0);
  await expect(page.getByText(GENERIC)).toHaveCount(0);
  // No revision is invented, and nothing internal crosses.
  await expect(page.getByText(/revision/i)).toHaveCount(0);
  await expect(page.getByText(DOCUMENT_ID)).toHaveCount(0);
  // One upload, and one reconciliation read — never a second upload.
  expect(seen).toHaveLength(1);
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
