import { expect, test } from '@playwright/test';

const OFFICER_SESSION = {
  kind: 'officer',
  agency: 'RDF',
  roles: ['decision_authority'],
  permissions: ['application.accept', 'adjudication.decide'],
  idleExpiresAt: '2099-01-01T00:00:00.000Z',
  absoluteExpiresAt: '2099-01-02T00:00:00.000Z',
};

test('officer login reaches the current dashboard', async ({ page }) => {
  let authenticated = false;

  await page.route('**/edge/v1/session', (route) =>
    route.fulfill(authenticated
      ? { status: 200, contentType: 'application/json', body: JSON.stringify(OFFICER_SESSION) }
      : { status: 401, body: '{"error":"INVALID_SESSION"}' }),
  );
  await page.route('**/edge/v1/auth/officer/login', (route) => {
    authenticated = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/edge/v1/applications', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ applicationId: '00000000-0000-4000-8000-000000000001', processingCode: 'RDF-98001', category: 'Infantry Recruit', status: 'SUBMITTED', agency: 'RDF', submittedAt: '2026-08-01T08:00:00.000Z' }]) }),
  );
  await page.route('**/edge/v1/applications/amber-queue', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );

  await page.goto('/login');

  // Wait for the lazy-loaded login form to render.
  const loginInput = page.locator('input[name="loginHandle"]');
  await expect(loginInput).toBeVisible({ timeout: 15_000 });
  await loginInput.fill('j.nsanzimana');

  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.fill('correct-horse-battery-staple');

  await page.getByRole("button", { name: /injira/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByTestId('metric-total-applications')).toBeVisible({ timeout: 10_000 });
});

test('officer detail executes an allowed transition and re-reads authoritative state', async ({ page }) => {
  const applicationId = '00000000-0000-4000-8000-000000000002';
  let detailReads = 0;
  let transitionCalls = 0;

  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(OFFICER_SESSION),
    }),
  );

  await page.route(`**/edge/v1/applications/detail?applicationId=${applicationId}`, (route) => {
    detailReads += 1;
    const accepted = detailReads > 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        application: {
          applicationId,
          processingCode: 'RDF-98002',
          category: 'Infantry Recruit',
          status: accepted ? 'ACCEPTED' : 'FINAL_SHORTLIST',
          agency: 'RDF',
          academicStatus: 'VERIFIED',
          nesaIndexNumber: null,
          nesaVerifiedAt: null,
          hecRegistrationNumber: null,
          hecVerifiedAt: null,
          declaredSpecialistField: null,
          academicEligibilityDetail: null,
          ageEligibilityStatus: 'ELIGIBLE',
          ageVerifiedAt: '2026-08-02T08:00:00.000Z',
          ageEligibilityDetail: null,
          criminalClearanceStatus: 'CLEARED',
          criminalClearanceAt: '2026-08-03T08:00:00.000Z',
          documentLane: 'GREEN',
          documentForensicsScore: 0.12,
          documentForensicsFlags: null,
          documentReviewedAt: null,
          documentReviewDecision: null,
          assignedDistrict: 'Gasabo',
          assignedVenueName: 'Kigali Arena',
          physicalTestScheduledAt: '2026-09-01T08:00:00.000Z',
          physicalTestCompletedAt: '2026-09-01T10:00:00.000Z',
          qrInvitationIssuedAt: '2026-08-28T08:00:00.000Z',
          smsNotificationSentAt: '2026-08-28T08:05:00.000Z',
          finalDecisionAt: '2026-09-02T08:00:00.000Z',
          finalDecisionNotes: null,
          submittedAt: '2026-08-01T08:00:00.000Z',
          createdAt: '2026-08-01T08:00:00.000Z',
          updatedAt: accepted ? '2026-09-03T08:00:00.000Z' : '2026-09-02T08:00:00.000Z',
        },
        history: [
          {
            entryId: 'history-1',
            fromStatus: 'MEDICAL_REVIEW',
            toStatus: 'FINAL_SHORTLIST',
            status: 'FINAL_SHORTLIST',
            note: null,
            actorKind: 'OFFICER',
            occurredAt: '2026-09-02T08:00:00.000Z',
          },
          ...(accepted
            ? [{
                entryId: 'history-2',
                fromStatus: 'FINAL_SHORTLIST',
                toStatus: 'ACCEPTED',
                status: 'ACCEPTED',
                note: null,
                actorKind: 'OFFICER',
                occurredAt: '2026-09-03T08:00:00.000Z',
              }]
            : []),
        ],
      }),
    });
  });

  await page.route('**/edge/v1/applications/accept', async (route) => {
    transitionCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        applicationId,
        outcome: 'APPLIED',
        fromStatus: 'FINAL_SHORTLIST',
        status: 'ACCEPTED',
      }),
    });
  });

  await page.goto(`/applications/${applicationId}`);
  await expect(page.getByRole('heading', { name: 'RDF-98002' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Final shortlist')).toBeVisible();

  await page.getByRole('button', { name: /^Accept$/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /confirm accept/i }).click();

  await expect.poll(() => transitionCalls).toBe(1);
  await expect.poll(() => detailReads).toBeGreaterThan(1);
  await expect(page.getByText('Accepted')).toBeVisible({ timeout: 10_000 });
});
