import { createHash } from 'node:crypto';
import { expect, test, type Page, type Route } from '@playwright/test';
import { POSTS, json, signIn } from './support';

// The Campaign Studio (S05, ADR-FE-015) against a small stateful fake of the
// control plane. The live spec (live-campaign-studio.spec.ts) drives the real one.

interface Fake {
  campaign: Record<string, unknown> & { sessions: Record<string, unknown>[]; policy: Record<string, unknown> | null };
  keys: Record<string, string[]>;
  bodies: Record<string, unknown[]>;
  /** Refusals queued per path: the next write to that path answers with this. */
  refuse: Record<string, { status: number; body: unknown }>;
}

const base = (status = 'DRAFT', over: Record<string, unknown> = {}): Fake['campaign'] => ({
  ...{
    publicCode: 'RDF-2026-A', campaignLabel: 'RDF 2026 general enlistment', status, targetCategories: ['GENERAL_ENLISTMENT'], targetDistricts: ['NYAGATARE', 'GASABO'],
    registrationOpensAt: '2026-11-01T06:00:00.000Z', registrationClosesAt: '2026-11-10T15:00:00.000Z', examinationStartDate: '2026-11-15', examinationEndDate: '2026-11-16',
    allowsWalkIn: true, targetIntakeCount: 400, publishedAt: null, createdAt: '2026-10-28T06:00:00.000Z',
    occupancy: { sessionCount: 0, capacityTotal: null, hasUnboundedSession: false, registeredTotal: 0 }, ...over,
  },
  contactPhoneNumbers: ['+250788000000'], contactWebsite: null, announcementReference: null, registrationClosedAt: null, cancelledAt: null,
  policy: null, coverage: null, sessions: [], history: [{ fromStatus: null, toStatus: 'DRAFT', reasonCode: null, occurredAt: '2026-10-28T06:00:00.000Z' }],
});

const session = (district: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  district, province: district === 'GASABO' ? 'KIGALI_CITY' : 'EASTERN_PROVINCE', venueName: `${district} venue`, examDate: '2026-11-15', reportingTimeHour: 7,
  capacityLimit: 300, capacityDecisionCode: null, registeredCount: 0, remaining: 300, isActive: true, ...over,
});

const canon = (v: unknown): string => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v !== null && typeof v === 'object'
  ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v));

async function fakeControlPlane(page: Page, fake: Fake, list: Record<string, unknown>[] = []): Promise<void> {
  const write = async (route: Route, name: string, apply: (body: Record<string, unknown>) => { status: number; body: unknown }): Promise<void> => {
    const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    (fake.keys[name] ??= []).push(route.request().headers()['idempotency-key'] ?? '');
    (fake.bodies[name] ??= []).push(body);
    const refusal = fake.refuse[name];
    if (refusal !== undefined) { delete fake.refuse[name]; return json(route, refusal.status, refusal.body); }
    const r = apply(body);
    return json(route, r.status, r.body);
  };
  const setStatus = (s: string, extra: Record<string, unknown> = {}): void => { fake.campaign = { ...fake.campaign, status: s, ...extra }; };
  await page.route('**/edge/v1/campaigns/admin**', (route) => json(route, 200, { agency: 'RDF', total: list.length, nextCursor: null, campaigns: list }));
  await page.route('**/edge/v1/campaigns/admin/detail**', (route) => json(route, 200, { agency: 'RDF', campaign: fake.campaign }));
  await page.route('**/edge/v1/campaigns', (route) => (route.request().method() !== 'POST' ? route.fallback() : write(route, 'create', (b) => {
    fake.campaign = base('DRAFT', { publicCode: b['publicCode'], campaignLabel: b['campaignLabel'], targetCategories: b['targetCategories'], targetDistricts: b['targetDistricts'] });
    return { status: 201, body: { status: 'DRAFT_CREATED', publicCode: b['publicCode'], campaignStatus: 'DRAFT' } };
  })));
  await page.route('**/edge/v1/campaigns/policy', (route) => write(route, 'policy', (b) => {
    const doc = { legalBasisCode: b['legalBasisCode'], legalBasisReference: b['legalBasisReference'], policyDocument: b['policyDocument'] };
    const hash = createHash('sha256').update(canon(doc)).digest('hex');
    fake.campaign.policy = { versionNumber: ((fake.campaign.policy?.['versionNumber'] as number | undefined) ?? 0) + 1, policyHash: hash, hashVersion: 1, legalBasisCode: b['legalBasisCode'], createdAt: '2026-10-28T07:00:00.000Z' };
    return { status: 201, body: { status: 'POLICY_VERSION_CREATED', publicCode: b['publicCode'], policyVersion: fake.campaign.policy['versionNumber'], policyHash: hash } };
  }));
  await page.route('**/edge/v1/campaigns/session', (route) => write(route, 'session', (b) => {
    const row = session(b['district'] as string, { venueName: b['venueName'], examDate: b['examDate'], reportingTimeHour: b['reportingTimeHour'], capacityLimit: b['capacityLimit'], capacityDecisionCode: b['capacityDecisionCode'] ?? null });
    fake.campaign.sessions = [...fake.campaign.sessions.filter((s) => s['district'] !== b['district']), row];
    fake.campaign.coverage = { version: fake.campaign.sessions.length, hash: 'c'.repeat(64) };
    return { status: 200, body: { status: 'SESSION_CONFIGURED', publicCode: b['publicCode'], district: b['district'], coverageVersion: fake.campaign.sessions.length, coverageHash: 'c'.repeat(64) } };
  }));
  await page.route('**/edge/v1/campaigns/publish', (route) => write(route, 'publish', (b) => {
    setStatus('REGISTRATION_OPEN', { publishedAt: '2026-10-28T08:00:00.000Z' });
    return { status: 200, body: { status: 'CAMPAIGN_PUBLISHED', publicCode: b['publicCode'], campaignStatus: 'REGISTRATION_OPEN', policyVersion: 1, coverageVersion: 2, coverageHash: 'c'.repeat(64) } };
  }));
  const life = (path: string, name: string, to: string): Promise<void> => page.route(`**/edge/v1/campaigns/${path}`, (route) => write(route, name, (b) => {
    setStatus(to);
    return { status: 200, body: { status: to, publicCode: b['publicCode'], campaignStatus: to } };
  }));
  await life('registration-close', 'close', 'REGISTRATION_CLOSED');
  await life('complete', 'complete', 'COMPLETED');
  await life('cancel', 'cancel', 'CANCELLED');
}

const newFake = (c = base()): Fake => ({ campaign: c, keys: {}, bodies: {}, refuse: {} });
const summaryRow = (code: string, status: string): Record<string, unknown> => ({ ...base(status), publicCode: code, campaignLabel: `Campaign ${code}` });

async function confirmWithCode(page: Page, code: string): Promise<void> {
  await page.getByTestId('confirm-code').fill(code);
  await page.getByTestId('confirm-action-confirm').click();
}

test.describe('list', () => {
  test('an empty agency sees the empty state and the new-campaign action', async ({ page }) => {
    await signIn(page, ['agency_admin'], POSTS.admin);
    await fakeControlPlane(page, newFake(), []);
    await page.goto('/campaigns');
    await expect(page.getByTestId('state-empty')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'New campaign' })).toBeVisible();
  });

  test('every state is listed; filtering to nothing is the filtered-empty state', async ({ page }) => {
    await signIn(page, ['agency_admin'], POSTS.admin);
    await fakeControlPlane(page, newFake(), [summaryRow('A-ONE', 'DRAFT'), summaryRow('B-TWO', 'REGISTRATION_OPEN'), summaryRow('C-THR', 'CANCELLED')]);
    await page.goto('/campaigns');
    const table = page.getByTestId('campaign-table');
    await expect(table).toContainText('A-ONE', { timeout: 15_000 });
    await expect(table).toContainText('Draft');
    await expect(table).toContainText('Registration open');
    await expect(table).toContainText('Cancelled');
    await expect(table).toContainText('(Kigali, UTC+2)');
    await page.route('**/edge/v1/campaigns/admin**', (route) => json(route, 200, { agency: 'RDF', total: 0, nextCursor: null, campaigns: [] }));
    await page.getByLabel('Search by name or code').fill('zzz');
    await expect(page.getByTestId('state-filtered-empty')).toBeVisible({ timeout: 15_000 });
  });

  test('a reviewer can read the list but is offered no way to create; the new screen is forbidden', async ({ page }) => {
    await signIn(page, ['reviewer'], POSTS.reviewer);
    await fakeControlPlane(page, newFake(), [summaryRow('A-ONE', 'DRAFT')]);
    await page.goto('/campaigns');
    await expect(page.getByTestId('campaign-table')).toContainText('A-ONE', { timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'New campaign' })).toHaveCount(0);
    await page.goto('/campaigns/new');
    await expect(page.getByTestId('state-forbidden')).toBeVisible({ timeout: 15_000 });
  });

  test('an officer without the campaign permission sees no menu item and a forbidden screen', async ({ page }) => {
    await signIn(page, ['medical_officer'], POSTS.medical);
    await page.goto('/dashboard');
    await expect(page.locator('a[href="/applications"]')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('a[href="/campaigns"]')).toHaveCount(0);
    await page.goto('/campaigns');
    await expect(page.getByTestId('state-forbidden')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('draft', () => {
  const fill = async (page: Page): Promise<void> => {
    await page.getByLabel('Public code', { exact: true }).fill('rdf-2026-a');
    await page.getByLabel('Campaign name').fill('RDF 2026 general enlistment');
    await page.getByLabel('Categories', { exact: true }).click();
    await page.getByText('RDF general enlistment', { exact: true }).click();
    await page.getByLabel('Districts', { exact: true }).click();
    await page.getByText('Nyagatare', { exact: true }).click();
    await page.getByLabel('Registration opens (Kigali time)').fill('2026-11-01T08:00');
    await page.getByLabel('Registration closes (Kigali time)').fill('2026-11-10T17:00');
    await page.getByLabel('Examination starts').fill('2026-11-15');
    await page.getByLabel('Examination ends').fill('2026-11-16');
    await page.getByLabel('Reporting hour (0–23)').fill('7');
  };

  test('validation names each field, states the Kigali zone, and sends nothing', async ({ page }) => {
    await signIn(page, ['agency_admin'], POSTS.admin);
    const fake = newFake();
    await fakeControlPlane(page, fake);
    await page.goto('/campaigns/new');
    await expect(page.getByTestId('kigali-notice')).toContainText('Kigali time (UTC+2)', { timeout: 15_000 });
    await page.getByTestId('create-draft').click();
    await expect(page.getByTestId('field-publicCode-error')).toBeVisible();
    await expect(page.getByTestId('field-campaignLabel-error')).toBeVisible();
    await expect(page.getByTestId('field-targetCategories-error')).toBeVisible();
    await expect(page.getByTestId('field-registrationOpensAt-error')).toBeVisible();
    expect(fake.keys['create']).toBeUndefined();
    await page.getByLabel('Campaign name').fill('x'.repeat(51));
    await expect(page.getByTestId('field-campaignLabel-error')).toContainText('longer than 50');
  });

  test('creating the draft sends Kigali instants with an offset, one key, and opens the Studio', async ({ page }) => {
    await signIn(page, ['agency_admin'], POSTS.admin);
    const fake = newFake();
    await fakeControlPlane(page, fake);
    await page.goto('/campaigns/new');
    await fill(page);
    await page.getByTestId('create-draft').click();
    await expect(page).toHaveURL(/\/campaigns\/RDF-2026-A$/, { timeout: 15_000 });
    expect(fake.bodies['create']?.[0]).toMatchObject({ publicCode: 'RDF-2026-A', registrationOpensAt: '2026-11-01T08:00:00+02:00', registrationClosesAt: '2026-11-10T17:00:00+02:00', targetDistricts: ['NYAGATARE'] });
    expect(fake.keys['create']?.[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('a duplicate code is a 409 shown on the code field and the next attempt is a new intent with a new key', async ({ page }) => {
    await signIn(page, ['agency_admin'], POSTS.admin);
    const fake = newFake();
    fake.refuse['create'] = { status: 409, body: { status: 'PUBLIC_CODE_ALREADY_EXISTS' } };
    await fakeControlPlane(page, fake);
    await page.goto('/campaigns/new');
    await fill(page);
    await page.getByTestId('create-draft').click();
    await expect(page.getByTestId('field-publicCode-error')).toContainText('already used', { timeout: 15_000 });
    await page.getByTestId('create-draft').click();
    await expect(page).toHaveURL(/\/campaigns\/RDF-2026-A$/, { timeout: 15_000 });
    expect(fake.keys['create']).toHaveLength(2);
    expect(fake.keys['create']?.[1]).not.toBe(fake.keys['create']?.[0]);
  });

  test('a response lost on the wire is retried under the SAME key, so the edge replays instead of duplicating', async ({ page }) => {
    await signIn(page, ['agency_admin'], POSTS.admin);
    const fake = newFake();
    await fakeControlPlane(page, fake);
    let first = true;
    await page.route('**/edge/v1/campaigns', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      if (first) { first = false; fake.keys['create'] = [route.request().headers()['idempotency-key'] ?? '']; return route.abort('connectionreset'); }
      return route.fallback();
    });
    await page.goto('/campaigns/new');
    await fill(page);
    await page.getByTestId('create-draft').click();
    await expect(page.getByTestId('campaign-refusal')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('create-draft').click();
    await expect(page).toHaveURL(/\/campaigns\/RDF-2026-A$/, { timeout: 15_000 });
    expect(fake.keys['create']).toHaveLength(2);
    expect(fake.keys['create']?.[1]).toBe(fake.keys['create']?.[0]);
  });
});

test.describe('policy, sessions, publish', () => {
  const studio = async (page: Page, fake: Fake, list: Record<string, unknown>[] = []): Promise<void> => {
    await signIn(page, ['agency_admin'], POSTS.admin);
    await fakeControlPlane(page, fake, list);
    await page.goto('/campaigns/RDF-2026-A');
    await expect(page.getByTestId('basics')).toContainText('RDF-2026-A', { timeout: 15_000 });
  };
  const toTab = (page: Page, name: string) => page.getByRole('tab', { name }).click();

  test('the policy is a labelled suggestion that must be confirmed; the returned hash is verified on the device and no value is silently defaulted', async ({ page }) => {
    const fake = newFake();
    await studio(page, fake);
    await toTab(page, 'Policy');
    await expect(page.getByTestId('policy-none')).toBeVisible();
    await expect(page.getByTestId('policy-suggestion-notice')).toContainText('not the official policy');
    await expect(page.getByTestId('create-policy')).toBeDisabled();
    await page.getByLabel('Legal basis code').fill('MINADEF-2026');
    await page.getByLabel('Legal basis reference').fill('RDF announcement, May 2026');
    await expect(page.getByTestId('create-policy')).toBeDisabled();
    await page.getByTestId('GENERAL_ENLISTMENT-confirm').click();
    await expect(page.getByTestId('create-policy')).toBeEnabled();
    await expect(page.getByTestId('policy-diff')).toContainText('age.maximumAge');
    await page.getByTestId('create-policy').click();
    const created = page.getByTestId('policy-created');
    await expect(created).toContainText('Policy version 1 saved', { timeout: 15_000 });
    await expect(page.getByTestId('policy-local-check')).toContainText('Verified on this device');
    const body = fake.bodies['policy']?.[0] as { policyDocument: Record<string, { education: unknown; legalBasis: unknown }>; legalBasisCode: string };
    expect(body.legalBasisCode).toBe('MINADEF-2026');
    expect(body.policyDocument['GENERAL_ENLISTMENT']?.education).toEqual({ mode: 'NESA_RESULTS', threshold: 'O_LEVEL_S3' });
    await expect(page.getByTestId('policy-hash')).toHaveText(await page.getByTestId('policy-created-hash').innerText());
  });

  test('editing a value after confirming un-confirms the category', async ({ page }) => {
    await studio(page, newFake());
    await toTab(page, 'Policy');
    await page.getByLabel('Legal basis code').fill('X-1');
    await page.getByLabel('Legal basis reference').fill('ref');
    await page.getByTestId('GENERAL_ENLISTMENT-confirm').click();
    await expect(page.getByTestId('create-policy')).toBeEnabled();
    await page.getByLabel('Maximum age (RDF general enlistment)').fill('26');
    await expect(page.getByTestId('create-policy')).toBeDisabled();
  });

  test('sessions: the coverage meter counts districts, validates the window, and an unlimited capacity is an explicit decision', async ({ page }) => {
    const fake = newFake();
    await studio(page, fake);
    await toTab(page, 'Sessions');
    await expect(page.getByTestId('coverage-text')).toContainText('0 of 2');
    await expect(page.getByTestId('coverage-missing')).toContainText('Nyagatare, Gasabo');
    const row = page.getByTestId('session-NYAGATARE');
    await row.getByRole('button', { name: 'Save session: Nyagatare' }).click();
    await expect(row.getByText('Enter the venue name')).toBeVisible();
    await row.getByLabel('Venue (Nyagatare)').fill('Nyagatare Stadium');
    await row.getByLabel('Examination day (Nyagatare)').click();
    await page.getByRole('option', { name: '2026-11-15' }).click();
    await row.getByLabel('Reporting hour (Nyagatare)').fill('7');
    await row.getByLabel('Seats (Nyagatare)').fill('0');
    await row.getByRole('button', { name: 'Save session: Nyagatare' }).click();
    await expect(row.getByText('Enter a capacity of at least 1.')).toBeVisible();
    await row.getByLabel('Capacity (Nyagatare)').click();
    await page.getByText('Unlimited (recorded decision)').click();
    await row.getByRole('button', { name: 'Save session: Nyagatare' }).click();
    await expect(page.getByTestId('session-saved-NYAGATARE')).toBeVisible({ timeout: 15_000 });
    expect(fake.bodies['session']?.[0]).toMatchObject({ district: 'NYAGATARE', province: 'EASTERN_PROVINCE', capacityLimit: null, capacityDecisionCode: 'UNBOUNDED_CAPACITY' });
    await expect(page.getByTestId('coverage-text')).toContainText('1 of 2');
  });

  test('preflight blocks publishing until complete; a server 409 keeps the draft and points to the failing step', async ({ page }) => {
    const c = base();
    c.policy = { versionNumber: 1, policyHash: 'a'.repeat(64), hashVersion: 1, legalBasisCode: 'X', createdAt: '2026-10-28T07:00:00.000Z' };
    c.sessions = [session('NYAGATARE'), session('GASABO')];
    const fake = newFake(c);
    fake.refuse['publish'] = { status: 409, body: { status: 'INCOMPLETE_COVERAGE' } };
    await studio(page, fake);
    await toTab(page, 'Publish');
    for (const id of ['draft', 'policy', 'coverage', 'capacity', 'windows']) await expect(page.getByTestId(`preflight-${id}`)).toContainText('Ready');
    await expect(page.getByTestId('citizen-preview')).toContainText('RDF 2026 general enlistment');
    await expect(page.getByTestId('citizen-preview')).toContainText('(Kigali, UTC+2)');
    await page.getByTestId('publish-open').click();
    await expect(page.getByTestId('confirm-action-confirm')).toBeDisabled();
    await page.getByTestId('confirm-code').fill('WRONG');
    await expect(page.getByTestId('confirm-action-confirm')).toBeDisabled();
    await confirmWithCode(page, 'rdf-2026-a');
    await expect(page.getByTestId('campaign-refusal')).toContainText('Every target district needs an active session', { timeout: 15_000 });
    await page.getByRole('button', { name: /Go to: Sessions/ }).click();
    await expect(page.getByTestId('coverage-meter')).toBeVisible();
    await toTab(page, 'Publish');
    await page.getByTestId('publish-open').click();
    await confirmWithCode(page, 'RDF-2026-A');
    await expect(page.getByTestId('published-notice')).toContainText('RDF-2026-A is published', { timeout: 15_000 });
    expect(fake.bodies['publish']).toEqual([{ publicCode: 'RDF-2026-A' }, { publicCode: 'RDF-2026-A' }]);
  });

  test('an incomplete draft cannot be published from the screen', async ({ page }) => {
    const fake = newFake();
    await studio(page, fake);
    await toTab(page, 'Publish');
    await expect(page.getByTestId('preflight-policy')).toContainText('To do');
    await expect(page.getByTestId('preflight-coverage')).toContainText('2 missing');
    await expect(page.getByTestId('publish-open')).toBeDisabled();
  });

  test('a replayed intent shows the original result', async ({ page }) => {
    const c = base();
    c.policy = { versionNumber: 1, policyHash: 'a'.repeat(64), hashVersion: 1, legalBasisCode: 'X', createdAt: '2026-10-28T07:00:00.000Z' };
    c.sessions = [session('NYAGATARE'), session('GASABO')];
    await signIn(page, ['agency_admin'], POSTS.admin);
    await fakeControlPlane(page, newFake(c));
    await page.route('**/edge/v1/campaigns/session', (route) => route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'Idempotency-Replayed': 'true', 'Access-Control-Expose-Headers': 'Idempotency-Replayed' },
      body: JSON.stringify({ status: 'SESSION_CONFIGURED', publicCode: 'RDF-2026-A', district: 'GASABO', coverageVersion: 2, coverageHash: 'c'.repeat(64) }),
    }));
    await page.goto('/campaigns/RDF-2026-A');
    await toTab(page, 'Sessions');
    await page.getByRole('button', { name: 'Save session: Gasabo' }).click();
    await expect(page.getByTestId('session-saved-GASABO')).toContainText('already done', { timeout: 15_000 });
  });
});

test.describe('lifecycle', () => {
  const open = async (page: Page, fake: Fake, perms = POSTS.admin): Promise<void> => {
    await signIn(page, ['agency_admin'], perms);
    await fakeControlPlane(page, fake);
    await page.goto('/campaigns/RDF-2026-A');
    await page.getByRole('tab', { name: 'Lifecycle' }).click();
  };

  test('closing registration states the registered count and needs the code typed', async ({ page }) => {
    const fake = newFake(base('REGISTRATION_OPEN', { occupancy: { sessionCount: 2, capacityTotal: 600, hasUnboundedSession: false, registeredTotal: 137 } }));
    await open(page, fake);
    await page.getByTestId('lifecycle-close').click();
    await expect(page.getByTestId('confirm-action')).toContainText('Applicants registered so far: 137');
    await expect(page.getByTestId('confirm-action-confirm')).toBeDisabled();
    await confirmWithCode(page, 'RDF-2026-A');
    await expect(page.getByTestId('lifecycle-done')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Registration closed').first()).toBeVisible();
    await expect(page.getByTestId('lifecycle-complete')).toBeVisible();
    expect(fake.bodies['close']).toEqual([{ publicCode: 'RDF-2026-A' }]);
  });

  test('a missing count is "unavailable", never zero', async ({ page }) => {
    const fake = newFake(base('REGISTRATION_OPEN', { occupancy: undefined }));
    await open(page, fake);
    await page.getByTestId('lifecycle-cancel').click();
    await expect(page.getByTestId('confirm-action')).toContainText('Applicants registered so far: unavailable');
    await expect(page.getByTestId('confirm-action')).not.toContainText('registered so far: 0');
  });

  test('cancelling an open campaign that has applications is refused by the server and reported', async ({ page }) => {
    const fake = newFake(base('REGISTRATION_OPEN'));
    fake.refuse['cancel'] = { status: 409, body: { status: 'INVALID_STATE' } };
    await open(page, fake);
    await page.getByTestId('lifecycle-cancel').click();
    await confirmWithCode(page, 'RDF-2026-A');
    await expect(page.getByTestId('campaign-refusal')).toContainText('current state does not allow', { timeout: 15_000 });
  });

  test('a completed campaign offers nothing further', async ({ page }) => {
    await open(page, newFake(base('COMPLETED')));
    await expect(page.getByTestId('lifecycle-terminal')).toBeVisible();
  });

  test('a published campaign is frozen: no policy or session editing is offered', async ({ page }) => {
    const fake = newFake(base('REGISTRATION_OPEN'));
    await open(page, fake);
    await page.getByRole('tab', { name: 'Policy' }).click();
    await expect(page.getByText('its structure is frozen')).toBeVisible();
    await expect(page.getByTestId('create-policy')).toHaveCount(0);
  });

  test('without the lifecycle permissions the actions are disabled and say why', async ({ page }) => {
    const fake = newFake(base('REGISTRATION_OPEN'));
    await open(page, fake, POSTS.reviewer);
    await expect(page.getByTestId('lifecycle-close')).toBeDisabled();
    await expect(page.getByText('Your post does not allow this action.').first()).toBeVisible();
  });
});

test('an unknown campaign is a not-found state', async ({ page }) => {
  await signIn(page, ['agency_admin'], POSTS.admin);
  await page.route('**/edge/v1/campaigns/admin/detail**', (route) => json(route, 404, { error: 'CAMPAIGN_NOT_FOUND' }));
  await page.goto('/campaigns/NOPE-1');
  await expect(page.getByTestId('state-empty')).toContainText('Campaign not found', { timeout: 15_000 });
});

test('the Studio speaks Kinyarwanda and French', async ({ page }) => {
  await signIn(page, ['agency_admin'], POSTS.admin);
  await fakeControlPlane(page, newFake(), []);
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'rw'));
  await page.goto('/campaigns');
  await expect(page.getByRole('heading', { name: 'Ubukangurambaga bwo gushaka abakozi' })).toBeVisible({ timeout: 15_000 });
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'fr'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Campagnes de recrutement' })).toBeVisible({ timeout: 15_000 });
});
