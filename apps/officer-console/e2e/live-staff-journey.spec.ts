import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * LIVE STAFF-AND-DECISION JOURNEY - no route mocks. Needs the real stack and the
 * backend branch with the four-eyes release (ADR-036 Addendum A):
 *
 *   rdf.admin creates an officer (sees "pending release", never the code)
 *   -> rdf.admin2 (a DIFFERENT administrator) releases the code once
 *   -> the officer activates and signs in
 *   -> rdf.admin assigns medical_officer (reason required; the open session ends)
 *   -> persona A (already admitted at the gate by the applicant-portal live spec)
 *      completes the physical test (dev stand-in for the tablet)
 *   -> the medical officer records the verdict
 *   -> rdf.director shortlists and accepts
 *   -> the citizen sees the outcome
 *   -> rdf.admin disables the officer and their open session ends.
 *
 * Opt-in: USRP_LIVE=1 with the backend (`pnpm dev` + `pnpm rehearse`, which seeds
 * rdf.admin2) running, the console on :3001 and the portal on :3000. Persona A
 * must be admitted (run apps/applicant-portal/e2e/live-rehearsal.spec.ts first).
 */
const LIVE = process.env['USRP_LIVE'] === '1';
const PORTAL = process.env['USRP_PORTAL_URL'] ?? 'http://localhost:3000';
const CONSOLE = process.env['USRP_OFFICER_URL'] ?? 'http://localhost:3001';
const BACKEND = resolve(process.env['USRP_BACKEND_DIR'] ?? '../../../e-recruitment');
const INBOX = resolve(process.env['USRP_DEV_SMS_INBOX'] ?? `${BACKEND}/.dev-sms/inbox.jsonl`);
const ADMIN_PW = 'RehearsalAdmin#2026';
const STAFF_PW = 'RehearsalStaff#2026';
const OFFICER_PW = 'DevOfficer#2026';
const A = { nid: '1200380123456789', dob: '2003-03-15', phone: '0788123456', masked: '***56' };
const HANDLE = `reh.rdf.med.${Date.now().toString(36)}`;
const NEW_PW = 'Live-Journey-Pw#2026';

test.describe.configure({ mode: 'serial' });
test.skip(!LIVE, 'live journey: set USRP_LIVE=1 with the backend (four-eyes branch) running and `pnpm rehearse` staged');

async function officerPage(browser: Browser, handle: string, password: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: CONSOLE });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/login');
  await page.locator('input[name="loginHandle"]').fill(handle);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  return page;
}

async function codeFromInbox(since: number): Promise<string> {
  let code: string | null = null;
  await expect.poll(() => {
    if (!existsSync(INBOX)) return null;
    for (const line of readFileSync(INBOX, 'utf8').trim().split('\n').reverse()) {
      const entry = JSON.parse(line) as { at: string; destinationMasked: string; body: string };
      if (Date.parse(entry.at) < since) break;
      const m = entry.destinationMasked === A.masked ? /\b(\d{6})\b/.exec(entry.body) : null;
      if (m?.[1] !== undefined) return (code = m[1]);
    }
    return null;
  }, { timeout: 20_000 }).not.toBeNull();
  return code as unknown as string;
}

async function citizenA(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: PORTAL });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/login');
  await page.getByLabel(/national id number/i).fill(A.nid);
  await page.getByLabel(/date of birth/i).fill(A.dob);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByLabel(/mobile phone number/i).fill(A.phone);
  const since = Date.now() - 1_000;
  await page.getByRole('button', { name: /send code/i }).click();
  await page.getByLabel(/one-time code/i).fill(await codeFromInbox(since));
  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  return page;
}

const state: { applicationId: string; officer?: Page; releasedCode?: string } = { applicationId: '' };

test('rdf.admin creates an officer and is told the release waits for a second administrator', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await officerPage(browser, 'rdf.admin', ADMIN_PW);
  await admin.goto('/staff');
  await admin.getByLabel('Login handle').fill(HANDLE);
  await admin.getByLabel('Posts').click();
  await admin.getByText('Reviewer', { exact: true }).click();
  await admin.getByRole('button', { name: 'Create officer' }).click();
  await expect(admin.getByTestId('created-pending-release')).toContainText('Pending release by a second administrator', { timeout: 20_000 });
  await expect(admin.getByTestId('staff-table')).toContainText(HANDLE);
  await expect(admin.getByRole('button', { name: new RegExp(`Release code: ${HANDLE}`) })).toHaveCount(0);
  expect(await admin.content()).not.toMatch(/[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}/);
  await admin.context().close();
});

test('rdf.admin2 releases the code once; the officer activates and signs in', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin2 = await officerPage(browser, 'rdf.admin2', ADMIN_PW);
  await admin2.goto('/staff');
  await expect(admin2.getByTestId(`activation-RELEASE_AVAILABLE`).first()).toBeVisible({ timeout: 20_000 });
  await admin2.getByRole('button', { name: `Release code: ${HANDLE}` }).click();
  const code = (await admin2.getByTestId('activation-code').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
  state.releasedCode = code;
  await admin2.getByRole('button', { name: 'I have handed it over' }).click();
  await expect(admin2.getByTestId('staff-table')).toContainText('Code released');
  await admin2.context().close();

  // The officer, anonymous, redeems it.
  const context = await browser.newContext({ baseURL: CONSOLE });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/activate');
  await page.getByLabel('Login handle').fill(HANDLE);
  await page.getByLabel('Activation code').fill(code);
  await page.getByLabel('New password').fill(NEW_PW);
  await page.getByLabel('Repeat the password').fill(NEW_PW);
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByTestId('activate-done')).toBeVisible({ timeout: 20_000 });
  // The code works once: a replay is the same single refusal.
  await page.reload();
  await page.getByLabel('Login handle').fill(HANDLE);
  await page.getByLabel('Activation code').fill(code);
  await page.getByLabel('New password').fill(`${NEW_PW}-again`);
  await page.getByLabel('Repeat the password').fill(`${NEW_PW}-again`);
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByTestId('activate-rejected')).toBeVisible({ timeout: 20_000 });
  await context.close();

  state.officer = await officerPage(browser, HANDLE, NEW_PW);
  await expect(state.officer.locator('a[href="/staff"]')).toHaveCount(0);
  await expect(state.officer.locator('a[href="/applications"]')).toHaveCount(1);
});

test('rdf.admin assigns medical_officer with a reason; the officer\'s open session ends', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await officerPage(browser, 'rdf.admin', ADMIN_PW);
  await admin.goto('/staff');
  await admin.getByRole('button', { name: `Assign posts: ${HANDLE}` }).click();
  const dialog = admin.getByTestId('confirm-action');
  await dialog.getByLabel('Posts').click();
  await admin.getByText('Medical officer', { exact: true }).click();
  // reviewer is replaced by medical_officer: remove it.
  await dialog.getByLabel('Remove Reviewer').click();
  await dialog.getByLabel('Reason').click();
  await admin.getByText('Posting change', { exact: true }).click();
  await admin.getByTestId('confirm-action-confirm').click();
  await expect(admin.getByTestId('staff-notice')).toContainText('Posts changed', { timeout: 20_000 });
  await admin.context().close();

  // PROOF: the officer's ALREADY-OPEN session is refused on the next request.
  const officer = state.officer!;
  const status = await officer.request.get('/edge/v1/session');
  expect(status.status()).toBe(401);
  await officer.context().close();
  state.officer = await officerPage(browser, HANDLE, NEW_PW);
});

test('persona A completes the physical test; the medical officer records the verdict; rdf.director decides and accepts; the citizen sees the outcome', async ({ browser }) => {
  test.setTimeout(240_000);
  const citizen = await citizenA(browser);
  const rows = (await (await citizen.request.get('/edge/v1/me/applications')).json()) as { applicationId: string | null; agency: string; status: string | null; submittedAt: string | null }[];
  const rdf = rows.filter((r) => r.agency === 'RDF' && r.applicationId !== null).sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))[0];
  expect(rdf, 'persona A has an RDF application (run the applicant-portal live spec first)').toBeDefined();
  state.applicationId = rdf!.applicationId!;
  if (rdf!.status === 'PHYSICAL_TEST_SCHEDULED') {
    execFileSync('pnpm', ['rehearse', '--complete-physical', state.applicationId], { cwd: BACKEND, stdio: 'inherit', timeout: 60_000 });
  } else {
    expect(['PHYSICAL_TEST_COMPLETE', 'MEDICAL_REVIEW', 'FINAL_SHORTLIST', 'ACCEPTED'], `unexpected starting status ${String(rdf!.status)}`).toContain(rdf!.status);
  }

  const medical = state.officer!;
  if (rdf!.status === 'PHYSICAL_TEST_SCHEDULED' || rdf!.status === 'PHYSICAL_TEST_COMPLETE') {
    await medical.goto(`/applications/${state.applicationId}`);
    await expect(medical.getByRole('heading', { name: 'Medical review' })).toBeVisible({ timeout: 30_000 });
    await medical.getByRole('button', { name: 'Mark fit' }).click();
    await expect(medical.getByRole('heading', { name: 'Medical review' })).toHaveCount(0, { timeout: 20_000 });
    await medical.context().close();
  }

  const director = await officerPage(browser, 'rdf.director', OFFICER_PW);
  await director.goto(`/applications/${state.applicationId}`);
  const heading = director.getByRole('heading', { name: 'Final decision' });
  if (await heading.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await director.getByRole('button', { name: 'Shortlist', exact: true }).click();
    await director.getByTestId('confirm-action-confirm').click();
  }
  await expect(director.getByRole('heading', { name: 'Accept candidate' })).toBeVisible({ timeout: 30_000 });
  await director.getByRole('button', { name: 'Accept', exact: true }).click();
  await director.getByTestId('confirm-action-confirm').click();
  await expect(director.getByRole('heading', { name: 'Accept candidate' })).toHaveCount(0, { timeout: 20_000 });
  await director.context().close();

  await expect.poll(async () => {
    const r = (await (await citizen.request.get('/edge/v1/me/applications')).json()) as { applicationId: string | null; status: string | null }[];
    return r.find((x) => x.applicationId === state.applicationId)?.status ?? null;
  }, { timeout: 30_000 }).toBe('ACCEPTED');
  await citizen.goto('/applications');
  await expect(citizen.getByText(/accepted/i).first()).toBeVisible({ timeout: 20_000 });
  await citizen.context().close();
});

test('rdf.admin disables the officer and their open session ends', async ({ browser }) => {
  test.setTimeout(120_000);
  const officer = state.officer ?? (await officerPage(browser, HANDLE, NEW_PW));
  expect((await officer.request.get("/edge/v1/session")).status()).toBe(200);
  const admin = await officerPage(browser, 'rdf.admin', ADMIN_PW);
  await admin.goto('/staff');
  await admin.getByRole('button', { name: `Disable: ${HANDLE}` }).click();
  const dialog = admin.getByTestId('confirm-action');
  await expect(dialog).toContainText('will be signed out now');
  await dialog.getByLabel('Reason').click();
  await admin.getByText('Left the service', { exact: true }).click();
  await admin.getByTestId('confirm-action-confirm').click();
  await expect(admin.getByTestId('staff-notice')).toContainText('was disabled', { timeout: 20_000 });
  await admin.context().close();
  expect((await officer.request.get('/edge/v1/session')).status()).toBe(401);
  await officer.reload();
  await expect(officer).toHaveURL(/\/login/, { timeout: 20_000 });
  await officer.context().close();
});
