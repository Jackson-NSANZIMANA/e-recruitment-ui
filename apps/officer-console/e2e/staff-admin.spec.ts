import { expect, test, type Page } from '@playwright/test';
import { ID1, ID2, ID3, POSTS, json, officerRow, signIn } from './support';
// releaseOfficerActivation (ADR-036 Addendum A, backend #45) is intercepted here;
// the live staff journey exercises the real operation.
// These specs intercept it; the live rehearsal journey exercises the real operation.

const CODE = 'BQMX3-BPRPQ-THZGX-A2R59';
const adminRow = officerRow({ officerId: ID1, loginHandle: 'rdf.admin', posts: ['agency_admin'] });

async function officers(page: Page, rows: Record<string, unknown>[]): Promise<void> {
  await page.route('**/edge/v1/officers', (route) => (route.request().method() === 'GET' ? json(route, 200, { officers: rows }) : route.fallback()));
}

test('the staff menu item and screen exist only for an agency administrator; elsewhere it is the forbidden state', async ({ page }) => {
  await signIn(page, ['medical_officer'], POSTS.medical);
  await page.goto('/dashboard');
  await expect(page.locator('a[href="/applications"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('a[href="/staff"]')).toHaveCount(0);
  await page.goto('/staff');
  await expect(page.getByTestId('state-forbidden')).toBeVisible({ timeout: 15_000 });
});

test('an administrator sees the menu, the list, and their own and administrator rows read-only', async ({ page }) => {
  await signIn(page, ['agency_admin'], POSTS.admin);
  await officers(page, [adminRow, officerRow({ officerId: ID2 })]);
  await page.goto('/staff');
  await expect(page.locator('a[href="/staff"]')).toHaveCount(1, { timeout: 15_000 });
  const table = page.getByTestId('staff-table');
  await expect(table).toContainText('rdf.med.one');
  await expect(table).toContainText('Administrator account');
  await expect(page.getByRole('button', { name: /: rdf.admin$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Assign posts: rdf.med.one' })).toBeVisible();
});

test('creating an officer: the creator is told the release waits for a second administrator and never sees a code', async ({ page }) => {
  await signIn(page, ['agency_admin'], POSTS.admin);
  let rows: Record<string, unknown>[] = [adminRow];
  await page.route('**/edge/v1/officers', async (route) => {
    if (route.request().method() === 'GET') return json(route, 200, { officers: rows });
    const body = JSON.parse(route.request().postData() ?? '{}') as { loginHandle: string };
    const officer = officerRow({ officerId: ID3, loginHandle: body.loginHandle, status: 'pending', activatedAt: null, activationState: 'PENDING_RELEASE', activationExpiresAt: '2026-10-23T08:00:00.000Z', releasableByYou: false });
    rows = [...rows, officer];
    return json(route, 201, { outcome: 'CREATED', officer });
  });
  await page.goto('/staff');
  await page.getByLabel('Login handle').fill('rdf.med.two');
  await page.getByLabel('Posts').click();
  await page.getByText('Medical officer', { exact: true }).click();
  await expect(page.getByTestId('permission-preview')).toContainText('record medical verdicts');
  await page.getByRole('button', { name: 'Create officer' }).click();
  await expect(page.getByTestId('created-pending-release')).toContainText('Pending release by a second administrator');
  await expect(page.getByTestId('activation-PENDING_SECOND_ADMIN')).toBeVisible();
  await expect(page.getByRole('button', { name: /Release code/ })).toHaveCount(0);
  expect(await page.content()).not.toMatch(/[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}/);
});

test('a second administrator releases the code: shown once with copy and print, gone when closed', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, ['agency_admin'], POSTS.admin);
  const pending = officerRow({ officerId: ID3, loginHandle: 'rdf.med.two', status: 'pending', activatedAt: null, activationState: 'PENDING_RELEASE', activationExpiresAt: '2026-10-23T08:00:00.000Z', releasableByYou: true });
  await officers(page, [adminRow, pending]);
  let releaseBody = '';
  await page.route('**/edge/v1/officers/activation/release', (route) => { releaseBody = route.request().postData() ?? ''; return json(route, 200, { outcome: 'RELEASED', officer: { ...pending, activationState: 'RELEASED', releasableByYou: false }, activation: { code: CODE, expiresAt: '2026-10-23T08:00:00.000Z' } }); });
  await page.goto('/staff');
  await expect(page.getByTestId('activation-RELEASE_AVAILABLE')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Release code: rdf.med.two' }).click();
  const dialog = page.getByTestId('release-dialog');
  await expect(dialog.getByTestId('activation-code')).toHaveText(CODE);
  expect(releaseBody).toBe(JSON.stringify({ targetOfficerId: ID3 }));
  await expect(dialog).toContainText('Shown only once');
  await dialog.getByRole('button', { name: 'Copy' }).click();
  await expect(dialog).toContainText('Copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE);
  await expect(dialog.getByRole('button', { name: 'Print' })).toBeVisible();
  await dialog.getByRole('button', { name: 'I have handed it over' }).click();
  await expect(page.getByTestId('release-dialog')).toHaveCount(0);
  expect(await page.content()).not.toContain(CODE);
});

test('the refusals are explained: the creator (SAME_ADMIN) and a second release (ALREADY_RELEASED)', async ({ page }) => {
  await signIn(page, ['agency_admin'], POSTS.admin);
  const pending = officerRow({ officerId: ID3, loginHandle: 'rdf.med.two', status: 'pending', activatedAt: null, activationState: 'PENDING_RELEASE', releasableByYou: true });
  await officers(page, [adminRow, pending]);
  let answer: { status: number; body: unknown } = { status: 403, body: { error: 'SAME_ADMIN' } };
  await page.route('**/edge/v1/officers/activation/release', (route) => json(route, answer.status, answer.body));
  await page.goto('/staff');
  await page.getByRole('button', { name: 'Release code: rdf.med.two' }).click();
  await expect(page.getByTestId('staff-refusal')).toContainText('different administrator must release');
  answer = { status: 409, body: { error: 'ALREADY_RELEASED' } };
  await page.getByRole('button', { name: 'Release code: rdf.med.two' }).click();
  await expect(page.getByTestId('staff-refusal')).toContainText('already been released');
  await expect(page.getByTestId('release-dialog')).toHaveCount(0);
});

test('assigning posts needs a reason, previews what is newly granted, and says the officer is signed out now', async ({ page }) => {
  await signIn(page, ['agency_admin'], POSTS.admin);
  await officers(page, [adminRow, officerRow({ officerId: ID2 })]);
  let body = '';
  await page.route('**/edge/v1/officers/posts', (route) => { body = route.request().postData() ?? ''; return json(route, 200, { outcome: 'ASSIGNED', officer: officerRow({ officerId: ID2, posts: ['decision_authority', 'medical_officer'] }), sessionsRevoked: 1 }); });
  await page.goto('/staff');
  await page.getByRole('button', { name: 'Assign posts: rdf.med.one' }).click();
  const dialog = page.getByTestId('confirm-action');
  await expect(dialog).toContainText('will be signed out now');
  await dialog.getByLabel('Posts').click();
  await page.getByText('Decision authority', { exact: true }).click();
  await expect(dialog.getByTestId('permission-preview')).toContainText('decide finals');
  await expect(dialog.getByTestId('decision-authority-warning')).toBeVisible();
  await expect(page.getByTestId('confirm-action-confirm')).toBeDisabled();
  await dialog.getByLabel('Reason').click();
  await page.getByText('Posting change', { exact: true }).click();
  await page.getByTestId('confirm-action-confirm').click();
  await expect.poll(() => body).toContain('"reasonCode":"POSTING_CHANGE"');
  expect(body).toContain(`"targetOfficerId":"${ID2}"`);
  await expect(page.getByTestId('staff-notice')).toContainText('Posts changed');
});

test('disabling states its consequence and refusals show the rule, not a stack trace', async ({ page }) => {
  await signIn(page, ['agency_admin'], POSTS.admin);
  await officers(page, [adminRow, officerRow({ officerId: ID2 })]);
  await page.route('**/edge/v1/officers/disable', (route) => json(route, 409, { error: 'LAST_ACTIVE_ADMIN' }));
  await page.goto('/staff');
  await page.getByRole('button', { name: 'Disable: rdf.med.one' }).click();
  const dialog = page.getByTestId('confirm-action');
  await expect(dialog).toContainText('will be signed out now');
  await dialog.getByLabel('Reason').click();
  await page.getByText('Suspended', { exact: true }).click();
  await page.getByTestId('confirm-action-confirm').click();
  await expect(page.getByTestId('staff-refusal')).toContainText('last active administrator');
});

test('an officer activates with the released code and the wrong code is one indistinguishable answer', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) => json(route, 401, { error: 'INVALID_SESSION' }));
  let attempts = 0;
  await page.route('**/edge/v1/auth/officer/activate', (route) => {
    attempts += 1;
    const body = JSON.parse(route.request().postData() ?? '{}') as { activationCode: string; password: string };
    return body.activationCode === CODE ? route.fulfill({ status: 204 }) : json(route, 401, { error: 'ACTIVATION_REJECTED' });
  });
  await page.goto('/activate');
  await page.getByLabel('Login handle').fill('rdf.med.two');
  await page.getByLabel('New password').fill('a-long-enough-password');
  await page.getByLabel('Repeat the password').fill('a-long-enough-password');
  await page.getByLabel('Activation code').fill('AAAAA-AAAAA-AAAAA-AAAAA');
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByTestId('activate-rejected')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Activation code').fill(CODE);
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByTestId('activate-done')).toBeVisible();
  expect(attempts).toBe(2);
  await expect(page.getByLabel('New password')).toHaveCount(0);
});

test('a short or mismatched password is stopped before any request', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) => json(route, 401, { error: 'INVALID_SESSION' }));
  let called = false;
  await page.route('**/edge/v1/auth/officer/activate', (route) => { called = true; return route.fulfill({ status: 204 }); });
  await page.goto('/activate');
  await page.getByLabel('Login handle').fill('rdf.med.two');
  await page.getByLabel('Activation code').fill(CODE);
  await page.getByLabel('New password').fill('short');
  await page.getByLabel('Repeat the password').fill('short');
  await expect(page.getByRole('button', { name: 'Activate' })).toBeDisabled();
  await expect(page.getByText('at least 12 characters')).toBeVisible();
  expect(called).toBe(false);
});
