import { expect, test } from '@playwright/test';

/**
 * The apply draft survives going offline and holds business choices only:
 * the chosen public campaign code, the category and the registry number.
 * Never a session token, never an identity field, never a phone number.
 * The edge is intercepted; the bundle under test is the real one.
 */
const CAMPAIGN = {
  publicCode: 'RDF-2026-INTAKE',
  campaignLabel: 'RDF 2026 General Enlistment',
  agency: 'RDF',
  status: 'REGISTRATION_OPEN',
  registrationOpensAt: '2026-01-01T00:00:00.000Z',
  registrationClosesAt: '2099-01-01T00:00:00.000Z',
  examinationStartDate: '2099-02-01',
  examinationEndDate: '2099-02-05',
  targetCategories: ['GENERAL_ENLISTMENT'],
  targetDistricts: ['GASABO'],
  allowsWalkIn: false,
  contactPhoneNumbers: null,
  contactWebsite: null,
};

const NEXT = /^(next|komeza|suivant)$/i;

test('draft persists offline without credentials', async ({ page, context }) => {
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'applicant',
        idleExpiresAt: '2099-01-01T00:00:00.000Z',
        absoluteExpiresAt: '2099-01-02T00:00:00.000Z',
      }),
    }),
  );
  await page.route('**/edge/v1/campaigns', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaigns: [CAMPAIGN] }) }),
  );

  await page.goto('/apply');

  // Step 1: choose the open campaign (lazy-loaded route).
  const choose = page.getByRole('button', { name: /apply to this recruitment|saba iri tangazo|postuler à ce recrutement/i });
  await expect(choose).toBeVisible({ timeout: 15_000 });
  await choose.click();

  // Step 2: the category picker offers only this campaign's categories.
  const category = page.getByRole('combobox');
  await expect(category).toBeVisible({ timeout: 10_000 });
  await category.click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: NEXT }).click();

  // Step 3: the academic registry number for a NESA-path category.
  const nesa = page.locator('input[name="nesaIndexNumber"]');
  await expect(nesa).toBeVisible({ timeout: 10_000 });
  await nesa.fill('0123456789AB');
  await page.getByRole('button', { name: NEXT }).click();

  await context.setOffline(true);
  const stored = await page.evaluate(() => sessionStorage.getItem('usrp_apply_draft'));

  expect(stored).not.toBeNull();
  const draft = JSON.parse(stored ?? '{}') as Record<string, unknown>;
  expect(draft['campaignCode']).toBe('RDF-2026-INTAKE');
  expect(draft['category']).toBe('GENERAL_ENLISTMENT');
  expect(draft['nesaIndexNumber']).toBe('0123456789AB');
  for (const forbidden of ['nationalId', 'dateOfBirth', 'phone', 'sessionToken', 'otp']) {
    expect(stored).not.toContain(forbidden);
  }
});
