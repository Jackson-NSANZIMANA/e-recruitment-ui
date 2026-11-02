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
 * reviewed document is really refused.
 *
 * That is not because the backend work is missing. e-recruitment PR #61 IS
 * merged, at `4683b5615daeecdf13b40bb4930c3aeec83196de`. What is still owed is
 * the CONNECTED run of this journey — upload → revision 1 → replacement →
 * revision 2 → refusal once reviewed, through the real
 * forensics → identity → edge chain at that SHA — which needs a running
 * Postgres, MinIO, Kafka and ClamAV stack that this environment does not have.
 *
 * Until that run exists, this file is the browser half only, and must not be
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
 * THE WIZARD WALK, AND THE EVIDENCE STANDARD IT IS HELD TO.
 *
 * The walk to the documents panel is setup, not the thing under test: nothing
 * in `DocumentsPanel` is exercised while it renders. It was also the only
 * flaky part of this file. CI run 41364349616 reported 11 flaky tests, 7 of
 * the 8 D8 specs among them, every one at the same wait — the declaration
 * step's "I agree" control. Raising that wait from 20 s to 45 s (commit
 * 1800cf9) did not fix it.
 *
 * ROOT CAUSE: NOT ESTABLISHED. The traces that would settle it could not be
 * retrieved — Playwright report artifacts and CI job logs both fail to
 * download from this environment. What IS established, by reading the product
 * source:
 *
 *   - `StepCampaign`'s "Apply to this recruitment" is a DIRECT onClick. It is
 *     not a form submit, so no validation can swallow it.
 *   - `StepCategory` and `StepEducation` ARE Atlaskit `Form`s, and both submit
 *     handlers return early on an absent or empty value
 *     (`if (category !== undefined) onNext(...)` and
 *     `if (value === undefined || value.length === 0) return;`). Either
 *     Atlaskit's own `isRequired` validation or that early return would stop
 *     the step advancing silently, rendering no error.
 *   - `StepDeclaration` renders its "I agree" control unconditionally, so once
 *     step 3 is reached the control is always present.
 *
 * That makes the early return a PLAUSIBLE mechanism, not a proven one, and
 * nothing below claims otherwise.
 *
 * WHAT THIS HARNESS DOES INSTEAD OF GUESSING. There are no retries in it, and
 * none in the Playwright config for the runs reported. Every interaction
 * happens once, after an explicit readiness gate (the source step is mounted;
 * a required field holds its value and does not report itself invalid), and
 * every transition is verified by asserting the next step arrived.
 *
 * That is what makes a green run EVIDENCE rather than an absence of red: with
 * no retry to absorb a failure, a passing test means every interaction
 * succeeded on its first attempt. A step that does not advance is a hard
 * failure carrying diagnostics naming the step, whether the source step was
 * still active, and the field's value and validity — so a swallowed submit can
 * be told apart from a product defect without re-running anything.
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
 * What the wizard looked like at the moment a step refused to advance.
 *
 * Deliberately reads state rather than guessing at it: `wizardStep` is the
 * stepper's own current-step label, and the field pair distinguishes "the
 * value never reached the form" from "the form has it but judged it invalid" —
 * the two candidate explanations for a silently swallowed submit.
 */
async function describeWizard(page: Page, field?: Locator): Promise<string> {
  const step = await page
    .locator('[aria-current="step"]')
    .first()
    .textContent()
    .catch(() => null);
  const value = field === undefined ? null : await field.inputValue().catch(() => null);
  const invalid = field === undefined ? null : await field.getAttribute('aria-invalid').catch(() => null);
  return [
    `wizardStep=${JSON.stringify(step?.trim() ?? null)}`,
    `fieldValue=${JSON.stringify(value)}`,
    `ariaInvalid=${JSON.stringify(invalid)}`,
  ].join(' ');
}

/**
 * Press a control ONCE and assert the next step arrived.
 *
 * For DIRECT `onClick` controls only — the campaign choice and "I agree",
 * neither of which goes through form validation. No retry: a second press of
 * either would be a different action (re-choosing a campaign, re-agreeing a
 * declaration), and both are cheap to assert, so the honest behaviour on a
 * missed transition is to fail with diagnostics rather than press again.
 */
async function pressOnce(
  page: Page,
  step: string,
  trigger: Locator,
  landing: Locator,
  landingName: string,
): Promise<void> {
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();
  try {
    await expect(landing).toBeVisible({ timeout: 15_000 });
  } catch (err) {
    const stillOnSource = await trigger.isVisible().catch(() => false);
    const reachedTarget = await landing.isVisible().catch(() => false);
    throw new Error(
      `D8 walk: "${step}" did not advance. Expected ${landingName}. ` +
        `triggerStillVisible=${stillOnSource} targetVisible=${reachedTarget} ` +
        `${await describeWizard(page)} :: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Submit one of the wizard's Atlaskit `Form` steps ONCE, after a readiness
 * gate, and assert the next step arrived.
 *
 * READINESS, because that is the thing worth fixing rather than papering over.
 * The step is submitted only once its own control is mounted and, where the
 * step has a required field, that field holds the typed value and does not
 * report itself invalid. The field is blurred first so Atlaskit commits and
 * validates it — a DOM value that the form has not registered is precisely the
 * state in which this step's submit handler returns early and does nothing.
 *
 * NO RETRY, and that is the point. These are validated submits, so a silent
 * non-advance is exactly the failure being investigated; pressing again would
 * hide it behind a green tick. Failing carries the diagnostics instead.
 */
async function submitFormStep(
  page: Page,
  options: {
    readonly step: string;
    /** A control only the step being submitted renders. */
    readonly source: Locator;
    /** A control only the FOLLOWING step renders. */
    readonly landing: Locator;
    readonly landingName: string;
    /** The required field, when the step has one. */
    readonly field?: Locator;
  },
): Promise<void> {
  await expect(options.source).toBeVisible({ timeout: 15_000 });
  if (options.field !== undefined) {
    await options.field.blur();
    await expect(options.field).not.toHaveAttribute('aria-invalid', 'true', { timeout: 10_000 });
  }

  const next = page.getByRole('button', { name: /^next$/i });
  await expect(next).toBeVisible({ timeout: 15_000 });
  await next.click();

  try {
    await expect(options.landing).toBeVisible({ timeout: 15_000 });
  } catch (err) {
    // Read before concluding anything: whether the source step is still on
    // screen is the difference between "the submit was swallowed" and "it
    // advanced somewhere unexpected".
    const stillOnSource = await options.source.isVisible().catch(() => false);
    const reachedTarget = await options.landing.isVisible().catch(() => false);
    throw new Error(
      `D8 walk: "${options.step}" did not advance. Expected ${options.landingName}. ` +
        `stillOnSource=${stillOnSource} targetVisible=${reachedTarget} ` +
        `${await describeWizard(page, options.field)} :: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** File the application so the documents panel mounts, as it does after a filing. */
async function fileApplication(page: Page): Promise<void> {
  await page.goto('/apply');

  // Campaign → category. A direct onClick, pressed once.
  await pressOnce(
    page,
    'campaign',
    page.getByRole('button', { name: /apply to this recruitment/i }),
    page.getByLabel(/recruitment category/i),
    'the recruitment category select',
  );

  // Category → education. The option is chosen, then the select is left to
  // commit it before the step is submitted.
  const category = page.getByLabel(/recruitment category/i);
  await category.click();
  await page.getByText('RDF general enlistment', { exact: true }).click();
  // `.first()`, because for a moment the chosen label is legitimately rendered
  // twice — as the menu option being dismissed and as the control's new value.
  // The point is that a value is showing, not that exactly one thing shows it.
  await expect(page.getByText('RDF general enlistment', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await submitFormStep(page, {
    step: 'category',
    source: category,
    landing: page.getByLabel(/nesa index number/i),
    landingName: 'the NESA index number field',
    field: category,
  });

  // Education → declaration. The value is asserted to have landed before the
  // step is submitted; the readiness gate then blurs and checks validity.
  const nesa = page.getByLabel(/nesa index number/i);
  await nesa.fill('RW2026/1001');
  await expect(nesa).toHaveValue('RW2026/1001');
  await submitFormStep(page, {
    step: 'education',
    source: nesa,
    landing: page.getByRole('button', { name: /i agree/i }),
    landingName: 'the declaration step\'s "I agree" button',
    field: nesa,
  });

  // Declaration → review. A direct onClick, pressed once.
  await pressOnce(
    page,
    'declaration',
    page.getByRole('button', { name: /i agree/i }),
    page.getByRole('button', { name: /submit application/i }),
    'the "Submit application" button',
  );

  // The filing itself: a side effect, so it is pressed once and never repeated.
  await page.getByRole('button', { name: /submit application/i }).click();
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
