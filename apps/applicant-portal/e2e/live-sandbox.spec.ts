import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect as baseExpect, test, type Browser, type Page } from '@playwright/test';

/**
 * LIVE SANDBOX JOURNEYS (S12c) - no route mocks. Needs `pnpm sandbox:up` in the backend, its synthetic
 * personas exported (`pnpm rehearse --sandbox <scenario> --journey --export-personas`), and the three
 * apps served as sandbox builds on :4930 (this portal), :4931 and :4932. infrastructure/sandbox/live.sh
 * in the backend does all of that and runs this file.
 *
 *   A  RDF regular (the pilot persona): sign in by SMS -> SANDBOX banner -> category picker shows the
 *      printed age limits -> pre-filled identity block ("as recorded by NIDA", no NID) -> apply ->
 *      documents page: give the clearance number -> VERIFIED -> Exam Pass READY (marked as practice) ->
 *      admitted at the gate in the FIELD STATION -> the citizen sees ADMITTED.
 *   B  wrong certificate type: CORRECTION_NEEDED in words, number field offered again.
 *   C  a certificate that can carry a conviction: "an officer will look" (the officer console spec
 *      then shows the reason in words).
 *
 * Synthetic personas only; the owner's private persona is never driven from a browser.
 */
const ON = process.env['USRP_SANDBOX'] === '1';
const STATE = resolve(process.env['USRP_SANDBOX_STATE'] ?? '../../../s12c/.sandbox');
const FIELD_URL = process.env['USRP_FIELD_URL'] ?? 'http://localhost:4932';
const expect = baseExpect.configure({ timeout: 30_000 });

interface Persona { label: string; nationalId: string; dateOfBirth: string; phone: string; nesaIndexNumber: string | null; clearanceNumber?: string | null; category: string }
interface Manifest { campaignCode: string; gateOfficer: { loginHandle: string; password: string }; reader: { loginHandle: string; password: string }; personas: Persona[] }

test.describe.configure({ mode: 'serial' });
test.skip(!ON, 'live sandbox journeys: set USRP_SANDBOX=1 (infrastructure/sandbox/live.sh in the backend does the rest)');

function manifest(scenario: string): Manifest {
  const file = resolve(STATE, 'personas', `${scenario}.json`);
  if (!existsSync(file)) throw new Error(`no personas at ${file}: run pnpm rehearse --sandbox ${scenario} --journey --export-personas`);
  return JSON.parse(readFileSync(file, 'utf8')) as Manifest;
}
const persona = (m: Manifest, prefix: string): Persona => {
  const found = m.personas.find((p) => p.label.startsWith(`${prefix}/`));
  if (found === undefined) throw new Error(`persona ${prefix} not in the manifest`);
  return found;
};

async function codeFromInbox(phone: string, since: number): Promise<string> {
  const file = resolve(STATE, 'sms', 'inbox.jsonl');
  const masked = `***${phone.slice(-2)}`;
  let code: string | null = null;
  await expect.poll(() => {
    if (!existsSync(file)) return null;
    for (const line of readFileSync(file, 'utf8').trim().split('\n').reverse()) {
      const entry = JSON.parse(line) as { at: string; destinationMasked: string; body: string };
      if (Date.parse(entry.at) < since) break;
      const match = entry.destinationMasked === masked ? /\b(\d{6})\b/.exec(entry.body) : null;
      if (match?.[1] !== undefined) return (code = match[1]);
    }
    return null;
  }, { message: `an SMS code for ${masked} in the emulator inbox`, timeout: 60_000, intervals: [1_000] }).not.toBeNull();
  return code as unknown as string;
}

async function signIn(page: Page, p: Persona): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/login');
  await page.getByLabel(/national id number/i).fill(p.nationalId);
  await page.getByLabel(/date of birth/i).fill(p.dateOfBirth);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByLabel(/mobile phone number/i).fill(p.phone);
  const since = Date.now() - 1_000;
  await page.getByRole('button', { name: /send code/i }).click();
  await page.getByLabel(/one-time code/i).fill(await codeFromInbox(p.phone, since));
  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/** Apply through the wizard to the campaign card carrying `campaignLabelPart`; a same-day re-run continues. */
async function apply(page: Page, p: Persona, campaignLabelPart: RegExp, categoryLabel: string): Promise<void> {
  await page.goto('/apply');
  const card = page.locator('section, [role="region"], div').filter({ hasText: campaignLabelPart }).filter({ has: page.getByRole('button', { name: /apply to this recruitment/i }) }).last();
  await card.getByRole('button', { name: /apply to this recruitment/i }).click();
  await page.getByLabel(/recruitment category/i).click();
  await page.getByRole('option', { name: categoryLabel }).click();
  await page.getByRole('button', { name: /^next$/i }).click();
  if (p.nesaIndexNumber !== null) await page.getByLabel(/nesa index number/i).fill(p.nesaIndexNumber);
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByRole('button', { name: /i agree/i }).click();
  await page.getByRole('button', { name: /submit application/i }).click();
  await expect(page.getByText(/submitted — application filed|replayed — previous filing confirmed|already_applied — application already exists/i)).toBeVisible();
}

async function myApplicationId(page: Page, agency: string): Promise<string> {
  const response = await page.request.get('/edge/v1/me/applications');
  expect(response.status()).toBe(200);
  const rows = (await response.json()) as { applicationId: string | null; agency: string; submittedAt: string | null }[];
  const mine = rows.filter((r) => r.agency === agency && r.applicationId !== null).sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  expect(mine.length).toBeGreaterThan(0);
  return mine[0]!.applicationId!;
}

test('A: RDF regular - banner, picker, NIDA pre-fill, apply, clearance number, pass, gate in the field station', async ({ page, browser }) => {
  const m = manifest('rdf-2026');
  const p = persona(m, 'R1');
  await signIn(page, p);
  await expect(page.getByTestId('sandbox-banner')).toBeVisible();

  await page.goto('/apply');
  const card = page.locator('section, [role="region"], div').filter({ hasText: /\[REHEARSAL\] RDF RDF26/ }).filter({ has: page.getByRole('button', { name: /apply to this recruitment/i }) }).last();
  await card.getByRole('button', { name: /apply to this recruitment/i }).click();
  // The category picker states the printed limits per qualification, from the published policy v2.
  await expect(page.getByTestId('category-rules-RESERVE_FORCE_UNIVERSITY')).toContainText(/aged 26 or under/i);
  await expect(page.getByTestId('category-rules-RESERVE_FORCE_SPECIALIST')).toContainText(/aged 27 or under/i);
  await page.getByLabel(/recruitment category/i).click();
  await page.getByRole('option', { name: 'RDF general enlistment' }).click();
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByLabel(/nesa index number/i).fill(p.nesaIndexNumber ?? '');
  await page.getByRole('button', { name: /^next$/i }).click();
  // The pre-fill: identity as NIDA recorded it, read-only, never the National ID.
  const block = page.getByTestId('nida-identity');
  await expect(block).toBeVisible();
  await expect(page.getByText(/as recorded by NIDA/i)).toBeVisible();
  await expect(block).not.toContainText(p.nationalId);
  await expect(block.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: /i agree/i }).click();
  await page.getByRole('button', { name: /submit application/i }).click();
  await expect(page.getByText(/submitted — application filed|replayed — previous filing confirmed|already_applied — application already exists/i)).toBeVisible();

  const applicationId = await myApplicationId(page, 'RDF');
  await page.goto(`/applications/${applicationId}/documents`);
  await expect(page.getByTestId('citizen-documents')).toBeVisible();
  // First run: the number is wanted. A same-day re-run finds the state it left.
  const field = page.getByLabel(/application number of your criminal-record certificate/i);
  if (await field.count() > 0 && p.clearanceNumber) {
    await field.fill(p.clearanceNumber);
    await page.getByRole('button', { name: /send the number/i }).click();
  }
  await expect(page.getByTestId('clearance-state')).toContainText(/certificate is verified/i, { timeout: 120_000 });

  // The pipeline is asynchronous: age, NESA, clearance, then the slot and the Exam Pass.
  let view: { state: string; invitation?: { qrPayload: string; venueName: string } } | null = null;
  await expect.poll(async () => {
    const r = await page.request.get(`/edge/v1/me/applications/exam-invitation?applicationId=${applicationId}`);
    view = (await r.json()) as NonNullable<typeof view>;
    return view.state;
  }, { message: 'the Exam Pass becomes READY (or was already used)', timeout: 150_000, intervals: [2_000] }).toMatch(/^(READY|ADMITTED)$/);

  if (view!.state === 'READY') {
    await page.goto(`/applications/${applicationId}/exam-qr`);
    await expect(page.getByText(/SANDBOX|REHEARSAL: NOT VALID FOR RECRUITMENT/i).first()).toBeVisible();
    const officer = await fieldStation(browser, m.gateOfficer);
    await officer.getByTestId('station-gate').getByRole('link', { name: /open station/i }).click();
    await expect(officer).toHaveURL(/\/gate$/);
    await expect(officer.getByTestId('sandbox-banner')).toBeVisible();
    const venue = officer.getByLabel(/this gate's venue/i);
    await venue.fill(view!.invitation!.venueName);
    await venue.press('Enter');
    const qr = officer.getByLabel(/exam qr code/i);
    await qr.fill(view!.invitation!.qrPayload);
    await qr.press('Enter');
    await officer.getByLabel(/national id number/i).fill(p.nationalId);
    await officer.getByTestId('gate-admit').click();
    await expect(officer.getByTestId('gate-outcome')).toContainText(/admitted/i, { timeout: 30_000 });
    await officer.context().close();
  }
  await page.goto(`/applications/${applicationId}/exam-qr`);
  await expect(page.getByText(/you have been admitted/i)).toBeVisible();
});

async function fieldStation(browser: Browser, staff: { loginHandle: string; password: string }): Promise<Page> {
  const context = await browser.newContext({ baseURL: FIELD_URL });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/login');
  await page.getByLabel(/login handle|username|handle/i).fill(staff.loginHandle);
  await page.getByLabel(/password/i).fill(staff.password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await expect(page).toHaveURL(/stations/, { timeout: 30_000 });
  return page;
}

test('B: a certificate of the wrong type is a correction, in words, and the number can be given again', async ({ page }) => {
  const m = manifest('clearance-matrix');
  const p = persona(m, 'C3');
  await signIn(page, p);
  await apply(page, p, /\[REHEARSAL\] RDF CLRM/, 'RDF general enlistment');
  const applicationId = await myApplicationId(page, 'RDF');
  await page.goto(`/applications/${applicationId}/documents`);
  const field = page.getByLabel(/application number of your criminal-record certificate/i);
  if (await field.count() > 0 && p.clearanceNumber) {
    await field.fill(p.clearanceNumber);
    await page.getByRole('button', { name: /send the number/i }).click();
  }
  await expect(page.getByTestId('clearance-state')).toContainText(/not a criminal-record certificate/i, { timeout: 120_000 });
  await expect(page.getByLabel(/application number of your criminal-record certificate/i)).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/another person|someone else/i);
});

test('C: a certificate that can carry a conviction waits for an officer, and the citizen is told only that', async ({ page }) => {
  const m = manifest('clearance-matrix');
  const p = persona(m, 'C2');
  await signIn(page, p);
  await apply(page, p, /\[REHEARSAL\] RDF CLRM/, 'RDF general enlistment');
  const applicationId = await myApplicationId(page, 'RDF');
  await page.goto(`/applications/${applicationId}/documents`);
  const field = page.getByLabel(/application number of your criminal-record certificate/i);
  if (await field.count() > 0 && p.clearanceNumber) {
    await field.fill(p.clearanceNumber);
    await page.getByRole('button', { name: /send the number/i }).click();
  }
  await expect(page.getByTestId('clearance-state')).toContainText(/officer will look at your certificate/i, { timeout: 120_000 });
  await expect(page.locator('body')).not.toContainText(/CLEARANCE_CONTENT_REVIEW|conviction|criminal record needs/i);
});
