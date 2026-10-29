import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect as baseExpect, test } from '@playwright/test';

/**
 * LIVE SANDBOX, OFFICER CONSOLE (S12c) - no route mocks. After the portal's live sandbox spec has left a
 * criminal-record certificate that can carry a conviction (persona C2) waiting for an officer, the
 * reviewer sees it in the console: the SANDBOX banner, the record in "waiting for a reading" with the
 * closed reason in WORDS, and the clearance state with its reasons in the application's documents tab.
 * Needs infrastructure/sandbox/live.sh (backend), which serves this console as a sandbox build on :4931.
 */
const ON = process.env['USRP_SANDBOX'] === '1';
const STATE = resolve(process.env['USRP_SANDBOX_STATE'] ?? '../../../s12c/.sandbox');
const expect = baseExpect.configure({ timeout: 30_000 });
test.skip(!ON, 'live sandbox journeys: set USRP_SANDBOX=1');

test('the reviewer sees the amber reasons in words, and the clearance state in the workspace', async ({ page }) => {
  const file = resolve(STATE, 'personas', 'rdf-2026.json');
  if (!existsSync(file)) throw new Error(`no personas at ${file}`);
  const m = JSON.parse(readFileSync(file, 'utf8')) as { reader: { loginHandle: string; password: string } };
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/login');
  await expect.poll(async () => (await page.context().cookies()).some((c) => /csrf/i.test(c.name)), { timeout: 30_000 }).toBe(true);
  await page.locator('input[name="loginHandle"]').fill(m.reader.loginHandle);
  await page.locator('input[name="password"]').fill(m.reader.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId('sandbox-banner')).toBeVisible();

  await page.goto('/adjudication');
  const records = page.getByTestId('queue-records');
  await expect(records).toBeVisible({ timeout: 90_000 });
  await expect(records).toContainText(/Read the criminal-record certificate against the agency.s rule/);
  await expect(records.getByRole('button', { name: /clear|reject/i })).toHaveCount(0);

  await records.getByRole('row').nth(1).click();
  await expect(page).toHaveURL(/\/applications\//);
  await page.getByRole('tab', { name: /documents/i }).click();
  const view = page.getByTestId('clearance-officer-view');
  await expect(view).toContainText(/Waiting for an officer to read it/);
  await expect(page.getByTestId('clearance-reasons')).toContainText(/Read the certificate against the agency.s rule/);
});
