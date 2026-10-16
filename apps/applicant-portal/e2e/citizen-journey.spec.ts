import { expect, test, type Page, type Request } from '@playwright/test';

/**
 * Citizen onboarding (ADR-029) over the real bundle, with the edge intercepted:
 * National ID + date of birth → phone → one-time code. Proves the screen sends
 * exactly the contract's bodies, never an Authorization header, and that every
 * refusal is the single non-enumerating sentence the copy module defines.
 */
const NID = '1200380123456789';
const DOB = '2004-03-15';
const PHONE = '0788123456';
const TOKEN = 'onb_7f3a';
const APPLICANT_SESSION = { kind: 'applicant', idleExpiresAt: '2099-01-01T00:00:00.000Z', absoluteExpiresAt: '2099-01-02T00:00:00.000Z' };

interface Edge {
  readonly requests: Request[];
  signedIn: boolean;
}

async function mockEdge(page: Page): Promise<Edge> {
  // Pin the language: these specs prove the flow, not the host machine's locale.
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  const edge: Edge = { requests: [], signedIn: false };
  await page.route('**/edge/v1/**', async (route) => {
    edge.requests.push(route.request());
    await route.fallback();
  });
  await page.route('**/edge/v1/session', (route) =>
    edge.signedIn
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(APPLICANT_SESSION) })
      : route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'UNAUTHENTICATED' }) }),
  );
  await page.route('**/edge/v1/session/refresh', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'UNAUTHENTICATED' }) }),
  );
  return edge;
}

async function confirmIdentity(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/national id number/i).fill(NID);
  await page.getByLabel(/date of birth/i).fill(DOB);
  await page.getByRole('button', { name: /continue/i }).click();
}

test('ID + date of birth → phone → code opens a session, with contract-exact bodies', async ({ page }) => {
  const edge = await mockEdge(page);
  const bodies: Record<string, unknown> = {};
  await page.route('**/edge/v1/auth/applicant/identity', async (route) => {
    bodies['identity'] = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ onboardingToken: TOKEN }) });
  });
  await page.route('**/edge/v1/auth/applicant/otp/request', async (route) => {
    bodies['request'] = route.request().postDataJSON();
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'ACCEPTED' }) });
  });
  await page.route('**/edge/v1/auth/applicant/otp/verify', async (route) => {
    bodies['verify'] = route.request().postDataJSON();
    edge.signedIn = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'VERIFIED' }) });
  });

  await confirmIdentity(page);
  // The phone is asked for only after the identity step succeeds.
  const phone = page.getByLabel(/mobile phone number/i);
  await expect(phone).toBeVisible({ timeout: 15_000 });
  await phone.fill(PHONE);
  await page.getByRole('button', { name: /send code/i }).click();

  // 202 means accepted, not "SMS sent" — the copy must not claim delivery.
  await expect(page.getByText(/if the number you entered can receive sms/i)).toBeVisible();
  await page.getByLabel(/one-time code/i).fill('123456');
  await page.getByRole('button', { name: /confirm/i }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  expect(bodies['identity']).toEqual({ nationalId: NID, dateOfBirth: DOB });
  expect(bodies['request']).toEqual({ onboardingToken: TOKEN, phoneNumber: PHONE, channel: 'WEB' });
  expect(bodies['verify']).toEqual({ onboardingToken: TOKEN, phoneNumber: PHONE, otp: '123456', channel: 'WEB' });
  for (const request of edge.requests) {
    expect(request.headers()['authorization']).toBeUndefined();
    // The raw National ID travels only in the identity step's body.
    if (!request.url().endsWith('/auth/applicant/identity')) {
      expect(request.url()).not.toContain(NID);
      expect(request.postData() ?? '').not.toContain(NID);
    }
  }
});

test('an unconfirmed identity gets the single non-enumerating answer and no phone step', async ({ page }) => {
  await mockEdge(page);
  await page.route('**/edge/v1/auth/applicant/identity', (route) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'IDENTITY_NOT_CONFIRMED' }) }),
  );

  await confirmIdentity(page);
  await expect(page.getByText(/we could not confirm those details/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel(/mobile phone number/i)).toHaveCount(0);
});

test('a refused code gets the single code-invalid answer and the citizen stays signed out', async ({ page }) => {
  const edge = await mockEdge(page);
  await page.route('**/edge/v1/auth/applicant/identity', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ onboardingToken: TOKEN }) }),
  );
  await page.route('**/edge/v1/auth/applicant/otp/request', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'ACCEPTED' }) }),
  );
  await page.route('**/edge/v1/auth/applicant/otp/verify', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'OTP_INVALID' }) }),
  );

  await confirmIdentity(page);
  await page.getByLabel(/mobile phone number/i).fill(PHONE);
  await page.getByRole('button', { name: /send code/i }).click();
  await page.getByLabel(/one-time code/i).fill('000000');
  await page.getByRole('button', { name: /confirm/i }).click();

  await expect(page.getByText(/that code is not valid/i)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/login/);
  expect(edge.signedIn).toBe(false);
});
