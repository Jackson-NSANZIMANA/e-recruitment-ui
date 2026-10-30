import AxeBuilder from '@axe-core/playwright';
import { expect as baseExpect, test, type Page } from '@playwright/test';

// The first visit to a lazily compiled route in a dev server is slow; assertions wait for it.
const expect = baseExpect.configure({ timeout: 20_000 });
test.setTimeout(90_000);

/**
 * S12c screens over the real bundle with the edge intercepted: the NIDA identity block, the category
 * picker with per-qualification caps, and the citizen's document checklist with the clearance number
 * field and its states. Every screen is scanned with axe (serious and critical violations fail) and the
 * clearance copy is proven in en, rw and fr.
 * getMyIdentity, attachMyClearanceCertificate and the campaign eligibility summary come from the backend
 * (S12c, S12b). This mocked spec cannot prove the platform agrees; the contract drift gate and the live spec do.
 */
const APP = '33333333-3333-4333-8333-333333333333';
const CAMPAIGN = {
  publicCode: 'RDF-2026', campaignLabel: 'RDF 2026', agency: 'RDF', status: 'REGISTRATION_OPEN',
  registrationOpensAt: '2026-10-01T00:00:00.000Z', registrationClosesAt: '2099-11-30T00:00:00.000Z',
  examinationStartDate: '2099-12-10', examinationEndDate: '2099-12-20',
  targetCategories: ['RESERVE_FORCE_ALEVEL', 'RESERVE_FORCE_UNIVERSITY'], targetDistricts: ['GASABO'],
  allowsWalkIn: true, contactPhoneNumbers: null, contactWebsite: null,
};
const ELIGIBILITY = {
  RESERVE_FORCE_ALEVEL: { ageBands: [{ qualifications: ['A_LEVEL_A2'], minimumAge: 18, maximumAge: 25 }], educationAlternatives: [{ level: 'A_LEVEL_A2' }], minimumSciencePercent: null },
  RESERVE_FORCE_UNIVERSITY: { ageBands: [{ qualifications: ['BACHELOR_A0', 'A1_IPRC'], minimumAge: 18, maximumAge: 26 }, { qualifications: ['FIELD:MEDICINE', 'FIELD:LAW'], minimumAge: 18, maximumAge: 27 }], educationAlternatives: [{ level: 'A1_IPRC' }], minimumSciencePercent: null },
};
const IDENTITY = { fullName: 'TEST Person', sex: 'FEMALE', dateOfBirth: '2005-03-04', homeDistrict: 'GASABO', homeProvince: 'KIGALI_CITY', placeOfBirth: null, nationality: null };
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function base(page: Page, lang = 'en'): Promise<void> {
  await page.addInitScript((l) => window.localStorage.setItem('usrp_lang', l), lang);
  await page.route('**/edge/v1/session', (r) => r.fulfill(json({ kind: 'applicant', idleExpiresAt: '2099-01-01T00:00:00.000Z', absoluteExpiresAt: '2099-01-02T00:00:00.000Z' })));
}

async function noSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

const checklist = (clearance: unknown, extra: unknown[] = []) => ({
  agency: 'RDF', source: 'POLICY_VERSION', complete: false,
  items: [
    { documentType: 'NATIONAL_ID', satisfaction: 'API_VERIFIED', registry: 'NIDA' },
    ...extra,
    { documentType: 'NON_CONVICTION_CERTIFICATE', satisfaction: 'AWAITING_REGISTRY', registry: 'RIB', clearance },
  ],
});

async function openDocuments(page: Page, body: unknown): Promise<void> {
  await base(page);
  await page.route('**/edge/v1/me/applications/document-checklist*', (r) => r.fulfill(json(body)));
  await page.goto(`/applications/${APP}/documents`);
}

test('wizard: the category picker names the cap per qualification, in words', async ({ page }) => {
  await base(page);
  await page.route('**/edge/v1/campaigns', (r) => r.fulfill(json({ campaigns: [CAMPAIGN] })));
  await page.route('**/edge/v1/campaigns/detail*', (r) => r.fulfill(json({ campaign: { ...CAMPAIGN, eligibility: ELIGIBILITY } })));
  await page.goto('/apply');
  await page.getByRole('button', { name: /apply to this recruitment/i }).click({ timeout: 15_000 });
  const rules = page.getByTestId('category-rules');
  await expect(rules).toBeVisible();
  await expect(page.getByTestId('category-rules-RESERVE_FORCE_UNIVERSITY')).toContainText(/Bachelor degree \(A0\).*aged 26 or under/);
  await expect(page.getByTestId('category-rules-RESERVE_FORCE_UNIVERSITY')).toContainText(/Medicine, Law: aged 27 or under/);
  await noSeriousViolations(page);
});

test('wizard: the declaration step shows identity as recorded by NIDA, read-only, and asks for what NIDA lacks', async ({ page }) => {
  await base(page);
  await page.route('**/edge/v1/campaigns', (r) => r.fulfill(json({ campaigns: [CAMPAIGN] })));
  await page.route('**/edge/v1/campaigns/detail*', (r) => r.fulfill(json({ campaign: { ...CAMPAIGN, eligibility: ELIGIBILITY } })));
  await page.route('**/edge/v1/me/identity', (r) => r.fulfill(json(IDENTITY)));
  await page.goto('/apply');
  await page.getByRole('button', { name: /apply to this recruitment/i }).click({ timeout: 15_000 });
  await page.getByLabel(/recruitment category/i).click();
  await page.getByRole('option', { name: 'RDF reserve force — A-Level' }).click();
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByLabel(/nesa index number/i).fill('RW2026/1001');
  await page.getByRole('button', { name: /^next$/i }).click();
  const block = page.getByTestId('nida-identity');
  await expect(block).toContainText('TEST Person');
  await expect(block).toContainText(/Place of birth.*NIDA does not give us this/);
  await expect(page.getByText(/as recorded by NIDA/i)).toBeVisible();
  await expect(block.getByRole('textbox')).toHaveCount(0); // read-only: nothing to edit
  await noSeriousViolations(page);
});

test('wizard: a failed identity read never blocks the application', async ({ page }) => {
  await base(page);
  await page.route('**/edge/v1/campaigns', (r) => r.fulfill(json({ campaigns: [CAMPAIGN] })));
  await page.route('**/edge/v1/campaigns/detail*', (r) => r.fulfill(json({ campaign: CAMPAIGN })));
  await page.route('**/edge/v1/me/identity', (r) => r.fulfill(json({ error: 'UPSTREAM_CONTRACT_MISMATCH' }, 502)));
  await page.goto('/apply');
  await page.getByRole('button', { name: /apply to this recruitment/i }).click({ timeout: 15_000 });
  await page.getByLabel(/recruitment category/i).click();
  await page.getByRole('option', { name: 'RDF reserve force — A-Level' }).click();
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByLabel(/nesa index number/i).fill('RW2026/1001');
  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.getByText(/could not show your NIDA details/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /i agree/i })).toBeVisible();
});

test('documents: the number is checked for shape before it is sent, then sent once, normalised', async ({ page }) => {
  const posts: unknown[] = [];
  await openDocuments(page, checklist({ state: 'NUMBER_REQUIRED', code: null }));
  await page.route('**/edge/v1/me/applications/clearance-certificate', (r) => { posts.push(r.request().postDataJSON()); return r.fulfill(json({ status: 'ACCEPTED', agency: 'RDF' }, 202)); });
  await expect(page.getByTestId('clearance-state')).toContainText(/still need the number/i);
  await page.getByLabel(/application number of your criminal-record certificate/i).fill('not a number');
  await page.getByRole('button', { name: /send the number/i }).click();
  await expect(page.getByRole('alert')).toContainText(/not in the right shape/i);
  expect(posts).toHaveLength(0);
  await noSeriousViolations(page);
  await page.getByLabel(/application number of your criminal-record certificate/i).fill(' a 000000000000-abcd ');
  await page.getByRole('button', { name: /send the number/i }).click();
  await expect(page.getByRole('status')).toContainText(/number received/i);
  expect(posts).toEqual([{ applicationId: APP, clearanceCertificateNumber: 'A000000000000ABCD' }]);
});

const STATES: readonly [string, unknown, RegExp, boolean][] = [
  ['VERIFYING', { state: 'VERIFYING', code: null }, /checking your certificate/i, false],
  ['UNDER_OFFICER_REVIEW', { state: 'UNDER_OFFICER_REVIEW', code: null }, /officer will look at your certificate/i, false],
  ['VERIFIED', { state: 'VERIFIED', code: null }, /certificate is verified/i, false],
  ['NOT_BOUND', { state: 'CORRECTION_NEEDED', code: 'CERTIFICATE_NOT_BOUND' }, /does not match your identity/i, true],
  ['WRONG_TYPE', { state: 'CORRECTION_NEEDED', code: 'CERTIFICATE_WRONG_TYPE' }, /not a criminal-record certificate/i, true],
  ['EXPIRED', { state: 'CORRECTION_NEEDED', code: 'CERTIFICATE_EXPIRED' }, /too old or not yet valid/i, true],
  ['NOT_FOUND', { state: 'CORRECTION_NEEDED', code: 'CERTIFICATE_NOT_FOUND' }, /could not find a certificate/i, true],
];
for (const [name, clearance, copy, field] of STATES) {
  test(`documents: ${name} says what to do, and the number field is ${field ? 'offered' : 'hidden'}`, async ({ page }) => {
    await openDocuments(page, checklist(clearance));
    await expect(page.getByTestId('clearance-state')).toContainText(copy);
    await expect(page.getByLabel(/application number of your criminal-record certificate/i)).toHaveCount(field ? 1 : 0);
    if (name === 'NOT_BOUND') await expect(page.locator('body')).not.toContainText(/another person|someone else/i);
    await noSeriousViolations(page);
  });
}

test('documents: NESA results not yet published are explained, never a refusal', async ({ page }) => {
  await openDocuments(page, checklist({ state: 'NUMBER_REQUIRED', code: null }, [{ documentType: 'ALEVEL_CERTIFICATE', satisfaction: 'AWAITING_REGISTRY', registry: 'NESA' }]));
  await expect(page.getByTestId('doc-state-ALEVEL_CERTIFICATE')).toContainText(/NESA has not published these results yet/i);
  await expect(page.locator('body')).not.toContainText(/reject|ineligible/i);
});

for (const [lang, copy] of [['rw', /ntahuye n’ayawe/i], ['fr', /ne correspond pas à votre identité/i]] as const) {
  test(`documents: the correction copy is translated (${lang})`, async ({ page }) => {
    await base(page, lang);
    await page.route('**/edge/v1/me/applications/document-checklist*', (r) => r.fulfill(json(checklist({ state: 'CORRECTION_NEEDED', code: 'CERTIFICATE_NOT_BOUND' }))));
    await page.goto(`/applications/${APP}/documents`);
    await expect(page.getByTestId('clearance-state')).toContainText(copy);
    await noSeriousViolations(page);
  });
}
