import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * LIVE REHEARSAL JOURNEY — no route mocks. Drives the real stack end to end,
 * across both apps, on the campaigns staged by the backend's `pnpm rehearse`:
 *
 *   Persona A: sign in (code from the dev SMS inbox) → apply to the RDF
 *              rehearsal campaign → age, NESA and RIB gates → slot → Exam
 *              Pass READY (marked as a rehearsal) → admitted at the gate by an
 *              officer in the console → the citizen's pass shows ADMITTED.
 *   Persona B: same campaign at age 26 → refused at the age gate, no pass.
 *
 * Opt-in: USRP_LIVE=1 with `pnpm dev` + `pnpm rehearse` running in the backend
 * and both apps on :3000 / :3001. Re-runnable the same day: a persona who
 * already applied, or was already admitted, continues from that state.
 * Mocked specs prove the screen sends what WE think the contract is; this one
 * proves the platform agrees (it found W1-09 the day it was first run).
 */
const LIVE = process.env['USRP_LIVE'] === '1';
const OFFICER_URL = process.env['USRP_OFFICER_URL'] ?? 'http://localhost:3001';
const INBOX = resolve(process.env['USRP_DEV_SMS_INBOX'] ?? '../../../e-recruitment/.dev-sms/inbox.jsonl');
const PIPELINE_TIMEOUT_MS = 120_000;

const A = { nid: '1200380123456789', dob: '2003-03-15', phone: '0788123456', masked: '***56', nesa: 'RW2024/1001', venue: 'Rehearsal Venue — Gasabo' };
const B = { nid: '1199980345678901', dob: '1999-11-08', phone: '0722000021', masked: '***21', nesa: 'RW2024/1002' };

test.describe.configure({ mode: 'serial' });
test.skip(!LIVE, 'live rehearsal: set USRP_LIVE=1 with the backend running and `pnpm rehearse` staged');

/** The newest code sent to `masked` after `since`, read from the dev SMS inbox. */
async function codeFromInbox(masked: string, since: number): Promise<string> {
  let code: string | null = null;
  await expect
    .poll(() => {
      if (!existsSync(INBOX)) return null;
      const lines = readFileSync(INBOX, 'utf8').trim().split('\n').reverse();
      for (const line of lines) {
        const entry = JSON.parse(line) as { at: string; destinationMasked: string; body: string };
        if (Date.parse(entry.at) < since) break;
        const match = entry.destinationMasked === masked ? /\b(\d{6})\b/.exec(entry.body) : null;
        if (match?.[1] !== undefined) return (code = match[1]);
      }
      return null;
    }, { message: `a code for ${masked} in ${INBOX}`, timeout: 20_000 })
    .not.toBeNull();
  return code as unknown as string;
}

async function signInCitizen(page: Page, persona: { nid: string; dob: string; phone: string; masked: string }): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/login');
  await page.getByLabel(/national id number/i).fill(persona.nid);
  await page.getByLabel(/date of birth/i).fill(persona.dob);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByLabel(/mobile phone number/i).fill(persona.phone);
  const since = Date.now() - 1_000;
  await page.getByRole('button', { name: /send code/i }).click();
  await page.getByLabel(/one-time code/i).fill(await codeFromInbox(persona.masked, since));
  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/** Apply to the RDF rehearsal campaign; tolerate a same-day re-run (ALREADY_APPLIED). */
async function applyToRdfRehearsal(page: Page, nesa: string): Promise<void> {
  await page.goto('/apply');
  const card = page.locator('section, [role="region"], div').filter({ hasText: /\[REHEARSAL\] RDF/ }).filter({ has: page.getByRole('button', { name: /apply to this recruitment/i }) }).last();
  await expect(card.getByText(/rehearsal campaign: practice only/i)).toBeVisible({ timeout: 20_000 });
  await card.getByRole('button', { name: /apply to this recruitment/i }).click();
  await page.getByLabel(/recruitment category/i).click();
  await page.getByText('RDF general enlistment', { exact: true }).click();
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByLabel(/nesa index number/i).fill(nesa);
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByRole('button', { name: /i agree/i }).click();
  await page.getByRole('button', { name: /submit application/i }).click();
  await expect(page.getByText(/submitted — application filed|replayed — previous filing confirmed|already_applied — application already exists/i)).toBeVisible({ timeout: 30_000 });
}

async function myRdfApplication(page: Page): Promise<{ applicationId: string; status: string | null }> {
  const response = await page.request.get('/edge/v1/me/applications');
  expect(response.status()).toBe(200);
  const rows = (await response.json()) as { applicationId: string | null; agency: string; status: string | null; submittedAt: string | null }[];
  const rdf = rows.filter((row) => row.agency === 'RDF' && row.applicationId !== null).sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  expect(rdf.length, 'an RDF application exists').toBeGreaterThan(0);
  return { applicationId: rdf[0]!.applicationId!, status: rdf[0]!.status };
}

async function officerConsole(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: OFFICER_URL });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/login');
  await page.getByLabel(/login handle|username|handle/i).fill('rdf.officer');
  await page.getByLabel(/password/i).fill('DevOfficer#2026');
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 });
  return page;
}

test('Persona A: online application → gates → rehearsal Exam Pass → admitted once at the gate', async ({ page, browser }) => {
  test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
  await signInCitizen(page, A);
  await applyToRdfRehearsal(page, A.nesa);
  const { applicationId } = await myRdfApplication(page);

  // The pipeline is asynchronous: age, NESA and RIB gates, then the slot.
  const states: string[] = [];
  let view: { state: string; currentStatus: string; invitation?: { qrPayload: string; venueName: string; examDate: string } } | null = null;
  await expect
    .poll(async () => {
      const response = await page.request.get(`/edge/v1/me/applications/exam-invitation?applicationId=${applicationId}`);
      view = (await response.json()) as NonNullable<typeof view>;
      if (states.at(-1) !== `${view.state}/${view.currentStatus}`) states.push(`${view.state}/${view.currentStatus}`);
      return view.state;
    }, { message: 'the Exam Pass becomes READY (or was already used)', timeout: PIPELINE_TIMEOUT_MS, intervals: [2_000] })
    .toMatch(/^(READY|ADMITTED)$/);
  test.info().annotations.push({ type: 'pipeline', description: states.join(' → ') });

  if (view!.state === 'READY') {
    expect(view!.invitation?.venueName).toBe(A.venue);
    await page.goto(`/applications/${applicationId}/exam-qr`);
    await expect(page.getByText('Rehearsal Exam Pass')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/REHEARSAL: NOT VALID FOR RECRUITMENT/)).toBeVisible();

    const officer = await officerConsole(browser);
    await officer.goto('/gate');
    const venue = officer.getByLabel(/this gate's venue/i);
    await venue.fill(A.venue);
    await venue.press('Enter');
    const qr = officer.getByLabel(/exam qr code/i);
    await qr.fill(view!.invitation!.qrPayload);
    await qr.press('Enter');
    await officer.getByLabel(/national id number/i).fill(A.nid);
    await officer.getByTestId('gate-admit').click();
    await expect(officer.getByTestId('gate-outcome')).toContainText(/admitted/i, { timeout: 20_000 });
    await officer.context().close();
  }

  // The citizen's side of the same truth: a spent QR is never shown again.
  await page.goto(`/applications/${applicationId}/exam-qr`);
  await expect(page.getByText(/you have been admitted/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(new RegExp(A.venue))).toBeVisible();
});

test('Persona B: over-age application is refused at the age gate and never gets a pass', async ({ page }) => {
  test.setTimeout(PIPELINE_TIMEOUT_MS + 60_000);
  await signInCitizen(page, B);
  await applyToRdfRehearsal(page, B.nesa);
  const { applicationId } = await myRdfApplication(page);
  await expect
    .poll(async () => (await myRdfApplication(page)).status, { message: 'the age gate decides', timeout: PIPELINE_TIMEOUT_MS, intervals: [2_000] })
    .toBe('REJECTED');
  const response = await page.request.get(`/edge/v1/me/applications/exam-invitation?applicationId=${applicationId}`);
  const view = (await response.json()) as { state: string; invitation?: unknown };
  expect(view.state).not.toBe('READY');
  expect(view.invitation).toBeUndefined();
});
