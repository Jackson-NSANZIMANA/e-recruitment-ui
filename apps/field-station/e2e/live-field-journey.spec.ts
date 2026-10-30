import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * LIVE FIELD JOURNEY (S08) - no route mocks. RDF, Nyagatare, online capture with
 * the paper fallback. Needs the G2G sandbox (`SANDBOX_DB=usrp_sandbox_s08 pnpm sandbox`),
 * `pnpm rehearse --sandbox rdf-2026`, the Field Station on :4932 and the officer
 * console on :4931 (both against the sandbox edge), and a passes file naming two
 * personas whose Exam Pass is READY and not yet admitted:
 *
 *   USRP_LIVE=1 USRP_LIVE_PASSES=/path/passes.json   { campaignCode, venueDistrict?, examDate,
 *       medicalHandle, passes: [{ id, applicationId, qr, nid }, ...] }
 *
 * Persona 1: setup -> enrol -> Gate (admit) -> Physical (signed, acknowledged)
 *            -> Medical (board FIT) -> the officer console shows the records.
 * Persona 2: Gate -> Physical with the network dropped mid-capture: the record
 *            stays NOT sent, with the paper prompt; sent again when back online.
 * The QR and the national ID are credentials of synthetic sandbox personas.
 */
const LIVE = process.env['USRP_LIVE'] === '1';
const FIELD = process.env['USRP_FIELD_URL'] ?? 'http://localhost:4932';
const CONSOLE = process.env['USRP_OFFICER_URL'] ?? 'http://localhost:4931';
const STAFF_PW = 'RehearsalStaff#2026';
const GATE = 'reh.rdf.gate.nyagatare';
const SUPERVISOR = 'reh.rdf.supervisor';
const REVIEWER = 'reh.rdf.reviewer';

interface Passes { campaignCode: string; district?: string; examDate: string; medicalHandle: string; passes: { id: string; applicationId: string; qr: string; nid: string }[] }
const passes: Passes | null = LIVE ? (JSON.parse(readFileSync(process.env['USRP_LIVE_PASSES'] ?? '', 'utf8')) as Passes) : null;

test.describe.configure({ mode: 'serial' });
test.skip(!LIVE, 'live journey: set USRP_LIVE=1 with the sandbox, the stations and a passes file');

async function csrfReady(page: Page): Promise<void> {
  await expect.poll(async () => (await page.context().cookies()).some((c) => /csrf/.test(c.name)), { timeout: 20_000 }).toBe(true);
}

async function signIn(browser: Browser, base: string, handle: string, landing: RegExp): Promise<Page> {
  const context = await browser.newContext({ baseURL: base, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/login');
  await csrfReady(page);
  await page.locator('input[name="loginHandle"]').fill(handle);
  await page.locator('input[name="password"]').fill(STAFF_PW);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(landing, { timeout: 20_000 });
  return page;
}

async function confirmVenueDay(page: Page): Promise<void> {
  await page.getByLabel('Campaign code').fill(passes!.campaignCode);
  await page.getByLabel('District').fill(passes!.district ?? 'NYAGATARE');
  await page.getByLabel('Exam date').fill(passes!.examDate);
  await page.getByTestId('setup-confirm-venue').click();
  await expect(page.getByTestId('setup-venue-confirmed')).toBeVisible({ timeout: 20_000 });
}

async function admitAtGate(page: Page, p: Passes['passes'][number]): Promise<void> {
  await page.goto('/gate');
  const qr = page.getByLabel(/exam qr code/i);
  await qr.fill(p.qr);
  await qr.press('Enter');
  await page.getByLabel(/national id number/i).fill(p.nid);
  await page.getByTestId('gate-admit').click();
  // A re-run of the same day finds the pass already spent: that refusal is the single-use gate (ADR-034).
  await expect(page.getByTestId('gate-outcome')).toContainText(process.env['USRP_LIVE_RERUN'] === '1' ? /admitted|already/i : /admitted/i, { timeout: 20_000 });
}

async function scanAndMeasure(page: Page, p: Passes['passes'][number]): Promise<void> {
  await page.goto('/physical');
  const field = page.locator('input[type="password"]').first();
  await field.fill(p.qr);
  await field.press('Enter');
  await expect(page.getByTestId('physical-scanner-captured')).toBeVisible();
  await page.getByLabel('Height (cm)').fill('178');
  await page.getByLabel('Weight (kg)').fill('72');
  await page.getByLabel('Chest (cm)').fill('96');
  await page.getByLabel('3 km run (seconds)').fill('780');
}

let gateTablet: Page | null = null;
const gate = (): Page => { if (gateTablet === null) throw new Error('the setup test must run first'); return gateTablet; };

test('setup: the tablet is ready, enrolled with its own key, and the venue day is confirmed', async ({ browser }) => {
  gateTablet = await signIn(browser, FIELD, GATE, /\/stations/);
  await gate().goto('/setup');
  await expect(gate().getByTestId('check-ed25519')).toContainText('OK', { timeout: 20_000 });
  await gate().getByTestId('setup-enrol').click();
  await expect(gate().getByTestId('setup-enrolled')).toBeVisible({ timeout: 20_000 });
  await confirmVenueDay(gate());
  await expect(gate().getByTestId('setup-ready')).toBeVisible({ timeout: 20_000 });
});

test('persona 1: gate admits, the physical test is signed and acknowledged by the server', async () => {
  const p = passes!.passes[0]!;
  await admitAtGate(gate(), p);
  await scanAndMeasure(gate(), p);
  await gate().getByTestId('physical-save').click();
  // A re-run of the same day sends the identical signed payload again: the server answers DUPLICATE, never a second row.
  await expect(gate().getByTestId('physical-outcome')).toContainText(process.env['USRP_LIVE_RERUN'] === '1' ? /server has it|server already had it/i : /server has it/i, { timeout: 30_000 });
  await expect(gate().getByTestId(/fate-(ACKNOWLEDGED|DUPLICATE)/).first()).toBeVisible();
});

test('persona 2: a network drop mid-capture leaves the record NOT sent, with the paper prompt', async () => {
  const p = passes!.passes[1]!;
  await admitAtGate(gate(), p);
  await scanAndMeasure(gate(), p);
  await gate().context().setOffline(true);
  await gate().getByTestId('physical-save').click();
  await expect(gate().getByTestId('physical-paper-prompt')).toBeVisible({ timeout: 20_000 });
  await expect(gate().getByTestId('physical-outcome')).toContainText(/not sent/i);
  await expect(gate().getByTestId('fate-WAITING').first()).toBeVisible();
  await gate().context().setOffline(false);
  await gate().getByTestId('physical-send-again').click();
  await expect(gate().getByTestId('physical-outcome')).toContainText(process.env['USRP_LIVE_RERUN'] === '1' ? /server has it|server already had it/i : /server has it/i, { timeout: 30_000 });
});

test('the medical board records the verdict for persona 1', async ({ browser }) => {
  const medical = await signIn(browser, FIELD, passes!.medicalHandle, /\/stations/);
  await medical.goto('/medical');
  const field = medical.locator('input[type="password"]').first();
  await field.fill(passes!.passes[0]!.qr);
  await field.press('Enter');
  await medical.getByTestId('medical-choice-FIT').click();
  await medical.getByTestId('medical-record').click();
  await expect(medical.getByTestId('medical-outcome')).toContainText(/fit recorded/i, { timeout: 30_000 });
  await medical.context().close();
});

test('the supervisor station shows the venue counts, this fleet and an empty conflict list', async ({ browser }) => {
  const sup = await signIn(browser, FIELD, SUPERVISOR, /\/stations/);
  await sup.goto('/setup');
  await confirmVenueDay(sup);
  await sup.goto('/supervisor');
  await expect(sup.getByTestId('supervisor-counts')).toContainText(/admitted 2/i, { timeout: 20_000 });
  await expect(sup.getByTestId('supervisor-counts')).toContainText(/physical 2/i);
  await expect(sup.getByTestId('supervisor-fleet')).toContainText(/Active/);
  await sup.context().close();
});

test('the officer console shows the physical test and the medical verdict on the application', async ({ browser }) => {
  const reviewer = await signIn(browser, CONSOLE, REVIEWER, /\/dashboard|\/applications|\/$/);
  await reviewer.goto(`/applications/${passes!.passes[0]!.applicationId}`);
  await reviewer.getByRole('tab', { name: 'Status timeline' }).click();
  await expect(reviewer.getByText('Physical-test score captured')).toBeVisible({ timeout: 30_000 });
  await expect(reviewer.getByText('Medical review: FIT')).toBeVisible();
  await reviewer.getByRole('tab', { name: 'Field records' }).click();
  await expect(reviewer.getByText(/20\d\d/).first()).toBeVisible();
  await reviewer.screenshot({ path: process.env['USRP_LIVE_SHOT'] ?? 'live-console.png' });
  await reviewer.context().close();
  await gateTablet?.context().close();
});
