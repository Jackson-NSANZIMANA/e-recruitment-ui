import { expect, test, type Page } from '@playwright/test';

/**
 * LIVE CAMPAIGN STUDIO - no route mocks (S05, ADR-FE-015). The rehearsal
 * administrator authors, publishes and closes a campaign through the Studio
 * against the real stack, and the policy hash the control plane returns is
 * compared with the one `pnpm rehearse --sandbox rdf-2026` stored for the same
 * inputs: the proof that the UI drives the same control plane.
 *
 * Opt-in: USRP_LIVE=1. Needs `pnpm sandbox` (edge :4921), `pnpm rehearse
 * --sandbox rdf-2026` run on the same Kigali day, and the console served with
 * VITE_EDGE_URL=http://localhost:4921 (USRP_OFFICER_URL, default :4931).
 */
const LIVE = process.env['USRP_LIVE'] === '1';
const CONSOLE = process.env['USRP_OFFICER_URL'] ?? 'http://localhost:4931';
const ADMIN_PW = process.env['REHEARSAL_RDF_ADMIN_PASSWORD'] ?? 'RehearsalAdmin#2026';
const kigaliDay = (offset: number): string => new Date(Date.now() + 2 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
const STAMP = Date.now().toString(36).toUpperCase();
const CODE = `STUDIO-RDF-${STAMP}`;
// The rehearsal's own reference text for rdf-2026 v1 (tools/rehearsal/src/policy.ts).
const REFERENCE = 'USRP rehearsal scenario rdf-2026 v1: synthetic values copied from the eligibility engine; not a Government of Rwanda policy.';
const CATEGORIES = ['GENERAL_ENLISTMENT', 'RESERVE_FORCE_ALEVEL', 'RESERVE_FORCE_UNIVERSITY', 'RESERVE_FORCE_SPECIALIST'];

test.describe.configure({ mode: 'serial' });
test.skip(!LIVE, 'live Studio journey: set USRP_LIVE=1 with the sandbox running and `pnpm rehearse --sandbox rdf-2026` staged today');

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.goto('/login');
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === 'usrp_csrf_dev' || c.name === '__Host-usrp_csrf'), { timeout: 20_000 }).toBe(true);
  await page.locator('input[name="loginHandle"]').fill('rdf.admin');
  await page.locator('input[name="password"]').fill(ADMIN_PW);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

test('rdf.admin drafts, sets the policy and the session, publishes, and closes a campaign through the Studio', async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ baseURL: CONSOLE });
  const page = await context.newPage();
  await signIn(page);

  // 1. The draft.
  await page.goto('/campaigns/new');
  await page.getByLabel('Public code', { exact: true }).fill(CODE);
  await page.getByLabel('Campaign name').fill(`[STUDIO] RDF ${STAMP}`);
  await page.getByLabel('Categories', { exact: true }).click();
  for (const label of ['RDF general enlistment', 'RDF reserve force — A-Level', 'RDF reserve force — university', 'RDF reserve force — specialist']) {
    await page.getByRole('option', { name: label }).click();
    await page.getByLabel('Categories', { exact: true }).click();
  }
  await page.keyboard.press('Escape');
  await page.getByLabel('Districts', { exact: true }).click();
  await page.getByRole('option', { name: 'Nyagatare' }).click();
  await page.keyboard.press('Escape');
  await page.getByLabel('Registration opens (Kigali time)').fill(`${kigaliDay(-1)}T00:00`);
  await page.getByLabel('Registration closes (Kigali time)').fill(`${kigaliDay(2)}T23:59`);
  await page.getByLabel('Examination starts').fill(kigaliDay(0));
  await page.getByLabel('Examination ends').fill(kigaliDay(1));
  await page.getByLabel('Reporting hour (0–23)').fill('8');
  await page.getByLabel('Target intake').fill('300');
  await page.getByTestId('create-draft').click();
  await expect(page).toHaveURL(new RegExp(`/campaigns/${CODE}$`), { timeout: 30_000 });

  // 2. The policy: the engine's suggestions, confirmed category by category.
  await page.getByRole('tab', { name: 'Policy' }).click();
  await page.getByLabel('Legal basis code').fill('SYNTHETIC-REHEARSAL');
  await page.getByLabel('Legal basis reference').fill(REFERENCE);
  for (const c of CATEGORIES) await page.getByTestId(`${c}-confirm`).click();
  await page.getByTestId('create-policy').click();
  await expect(page.getByTestId('policy-created')).toContainText('Policy version 1 saved', { timeout: 30_000 });
  await expect(page.getByTestId('policy-local-check')).toContainText('Verified on this device');
  const studioHash = (await page.getByTestId('policy-created-hash').innerText()).trim();
  expect(studioHash).toMatch(/^[0-9a-f]{64}$/);

  // 3. The session.
  await page.getByRole('tab', { name: 'Sessions' }).click();
  const row = page.getByTestId('session-NYAGATARE');
  await row.getByLabel('Venue (Nyagatare)').fill('Studio Venue - Nyagatare stadium');
  await row.getByLabel('Examination day (Nyagatare)').click();
  await page.getByRole('option', { name: kigaliDay(0) }).click();
  await row.getByLabel('Reporting hour (Nyagatare)').fill('8');
  await row.getByLabel('Seats (Nyagatare)').fill('400');
  await row.getByRole('button', { name: 'Save session: Nyagatare' }).click();
  await expect(page.getByTestId('session-saved-NYAGATARE')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('coverage-text')).toContainText('1 of 1');

  // 4. Preflight and publish with the code typed.
  await page.getByRole('tab', { name: 'Publish' }).click();
  for (const id of ['draft', 'policy', 'coverage', 'capacity', 'windows']) await expect(page.getByTestId(`preflight-${id}`)).toContainText('Ready');
  await page.getByTestId('publish-open').click();
  await page.getByTestId('confirm-code').fill(CODE);
  await page.getByTestId('confirm-action-confirm').click();
  await expect(page.getByTestId('published-notice')).toBeVisible({ timeout: 30_000 });

  // 5. Citizens see it (the public projection, no session needed).
  const pub = await page.request.get(`${new URL(CONSOLE).protocol}//localhost:4921/edge/v1/campaigns/detail?publicCode=${CODE}`);
  expect(pub.status()).toBe(200);

  // 6. Hash parity with the rehearsal's campaign for the same inputs.
  const rehearsalCode = `REH-RDF-RDF26-${kigaliDay(0).replaceAll('-', '')}`;
  const theirs = await page.request.get(`http://localhost:4921/edge/v1/campaigns/admin/detail?publicCode=${rehearsalCode}`);
  expect(theirs.status(), `the rehearsal campaign ${rehearsalCode} must exist: run pnpm rehearse --sandbox rdf-2026 today`).toBe(200);
  const rehearsalHash = ((await theirs.json()) as { campaign: { policy: { policyHash: string } } }).campaign.policy.policyHash;
  console.log(`POLICY-HASH studio=${studioHash} rehearsal=${rehearsalHash}`);
  expect(studioHash).toBe(rehearsalHash);

  // 7. Close registration, typed.
  await page.getByRole('tab', { name: 'Lifecycle' }).click();
  await page.getByTestId('lifecycle-close').click();
  await expect(page.getByTestId('confirm-action')).toContainText('Applicants registered so far: 0');
  await page.getByTestId('confirm-code').fill(CODE);
  await page.getByTestId('confirm-action-confirm').click();
  await expect(page.getByTestId('lifecycle-done')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('lifecycle-complete')).toBeVisible();
  await context.close();
});
