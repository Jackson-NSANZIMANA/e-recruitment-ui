import { expect, test, type Page } from '@playwright/test';

/**
 * S08 stations over the real production bundle with the edge intercepted:
 * setup + enrolment, physical (signed, acknowledged per record), medical (board
 * and certificate), supervisor (counts, sync centre, fleet), conflicts, and the
 * check-in notice. The real device runtime runs (WebCrypto Ed25519, IndexedDB).
 * Nothing here may call a record "saved" without a per-record server answer.
 */
const APP_ID = '0190a000-0000-7000-8000-00000000a001';
const VENUE = 'Nyagatare Stadium';
const DAY = '2026-06-06';

const session = (permissions: string[], agency = 'RDF') => ({
  kind: 'officer', agency, roles: ['screening_officer'], permissions,
  idleExpiresAt: '2099-01-01T00:00:00.000Z', absoluteExpiresAt: '2099-01-02T00:00:00.000Z',
});
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const b64url = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A pass the station can DECODE (the server re-verifies on every write). */
const pass = (agency = 'RDF'): string =>
  `USRP-SLOT.v1.${b64url({ v: 1, keyId: 'k1', ticketId: 'ticket-001', applicationId: APP_ID, applicantId: 'a1', agency, campaignId: 'c1', slotId: 's1', venueName: VENUE, examDate: DAY, reportingTimeHour: 7, issuedAt: '2026-05-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z' })}.c2ln`;

async function signIn(page: Page, permissions: string[], agency = 'RDF'): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) => route.fulfill(json(session(permissions, agency))));
}

async function confirmVenueDay(page: Page): Promise<void> {
  await page.addInitScript(([venue, day]) => {
    window.localStorage.setItem('usrp_field_venue_day', JSON.stringify({ campaign: 'rdf-2026', district: 'Nyagatare', examDate: day, venueName: venue }));
  }, [VENUE, DAY]);
}

const ROSTER = { agency: 'RDF', venue: { venueName: VENUE, district: 'Nyagatare', examDate: DAY, reportingTimeHour: 7, capacityLimit: null, registeredCount: 3 }, candidates: [], truncated: false };

async function enrolDevice(page: Page): Promise<void> {
  await page.route('**/edge/v1/gate/roster**', (route) => route.fulfill(json(ROSTER)));
  await page.route('**/edge/v1/field-sync/devices', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill(json({ status: 'ENROLLED', deviceId: route.request().postDataJSON().deviceId, agency: 'RDF' }, 201))
      : route.fulfill(json({ devices: [] })));
  await page.goto('/setup');
  await page.getByTestId('setup-enrol').click();
  await expect(page.getByTestId('setup-enrolled')).toBeVisible({ timeout: 15_000 });
}

async function scanPass(page: Page, scanner: string, agency = 'RDF'): Promise<void> {
  const field = page.locator('input[type="password"]').first();
  await field.fill(pass(agency));
  await field.press('Enter');
  await expect(page.getByTestId(`${scanner}-captured`)).toBeVisible();
}

async function fillMetrics(page: Page, v: { height: string; weight: string; chest: string; run: string }): Promise<void> {
  await page.getByLabel('Height (cm)').fill(v.height);
  await page.getByLabel('Weight (kg)').fill(v.weight);
  await page.getByLabel('Chest (cm)').fill(v.chest);
  await page.getByLabel('3 km run (seconds)').fill(v.run);
}

test.describe('setup and enrolment', () => {
  test('a fresh tablet is blocked until it is enrolled and the venue day is confirmed', async ({ page }) => {
    await signIn(page, ['field.device.enroll', 'field.score.sync']);
    await page.route('**/edge/v1/gate/roster**', (route) => route.fulfill(json(ROSTER)));
    let enrolBody: Record<string, string> | null = null;
    await page.route('**/edge/v1/field-sync/devices', (route) => {
      enrolBody = route.request().postDataJSON();
      return route.fulfill(json({ status: 'ENROLLED', deviceId: enrolBody?.['deviceId'], agency: 'RDF' }, 201));
    });
    await page.goto('/setup');
    await expect(page.getByTestId('setup-blocked')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('check-ed25519')).toContainText('OK');
    await expect(page.getByTestId('check-enrolment')).toContainText('Blocked');

    await page.getByTestId('setup-enrol').click();
    await expect(page.getByTestId('setup-enrolled')).toBeVisible();
    // The public key only: never a private key (ADR-FE-016).
    expect(enrolBody?.['publicKeyPem']).toContain('BEGIN PUBLIC KEY');
    expect(JSON.stringify(enrolBody)).not.toMatch(/PRIVATE/);

    await page.getByLabel('Campaign code').fill('rdf-2026');
    await page.getByLabel('District').fill('Nyagatare');
    await page.getByLabel('Exam date').fill(DAY);
    await page.getByTestId('setup-confirm-venue').click();
    await expect(page.getByTestId('setup-venue-confirmed')).toContainText(VENUE);
    await expect(page.getByTestId('setup-ready')).toBeVisible();
  });

  test('a venue that the server does not know is not confirmed', async ({ page }) => {
    await signIn(page, ['field.device.enroll']);
    await page.route('**/edge/v1/gate/roster**', (route) => route.fulfill(json({ error: 'NOT_FOUND' }, 404)));
    await page.goto('/setup');
    await page.getByLabel('Campaign code').fill('rdf-2026');
    await page.getByLabel('District').fill('Nowhere');
    await page.getByLabel('Exam date').fill(DAY);
    await page.getByTestId('setup-confirm-venue').click();
    await expect(page.getByTestId('setup-venue-failed')).toBeVisible();
    await expect(page.getByTestId('setup-venue-confirmed')).toHaveCount(0);
  });

  test('a revoked device is told so, and stays unenrolled', async ({ page }) => {
    await signIn(page, ['field.device.enroll']);
    await page.route('**/edge/v1/field-sync/devices', (route) => route.fulfill(json({ error: 'DEVICE_REVOKED' }, 409)));
    await page.goto('/setup');
    await page.getByTestId('setup-enrol').click();
    await expect(page.getByTestId('setup-enrol-failed')).toContainText(/revoked/i);
    await expect(page.getByTestId('setup-enrolled')).toHaveCount(0);
  });
});

test.describe('physical test', () => {
  const metrics = { height: '178', weight: '72', chest: '96', run: '780' };

  test('is signed on the device, sent once, and called saved only on the per-record acknowledgement', async ({ page }) => {
    await signIn(page, ['field.device.enroll', 'field.score.sync']);
    await confirmVenueDay(page);
    await enrolDevice(page);
    let sent: Record<string, unknown>[] = [];
    await page.route('**/edge/v1/field-sync/scores', (route) => {
      sent = route.request().postDataJSON().records;
      const r = sent[0]!;
      return route.fulfill(json({ status: 'SYNCED', results: [{ applicationId: r['applicationId'], deviceId: r['deviceId'], status: 'ACCEPTED', scoreId: 'score-1' }] }));
    });
    await page.goto('/physical');
    await scanPass(page, 'physical-scanner');
    await fillMetrics(page, metrics);
    await page.getByTestId('physical-save').click();
    await expect(page.getByTestId('physical-outcome')).toContainText(/server has it/i);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ applicationId: APP_ID, qrInvitationCode: 'ticket-001', metrics: { heightCm: 178, weightKg: 72, chestCm: 96, run3kmTimeSeconds: 780, medicalFitnessStatus: 'PENDING_REVIEW' } });
    expect(String(sent[0]!['deviceSignature'])).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(String(sent[0]!['signedPayloadHash'])).toMatch(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('fate-ACKNOWLEDGED').first()).toBeVisible();
  });

  test('a network drop mid-capture leaves the record NOT sent, with the paper prompt', async ({ page }) => {
    await signIn(page, ['field.device.enroll', 'field.score.sync']);
    await confirmVenueDay(page);
    await enrolDevice(page);
    await page.route('**/edge/v1/field-sync/scores', (route) => route.abort('connectionreset'));
    await page.goto('/physical');
    await scanPass(page, 'physical-scanner');
    await fillMetrics(page, metrics);
    await page.getByTestId('physical-save').click();
    await expect(page.getByTestId('physical-paper-prompt')).toBeVisible();
    await expect(page.getByTestId('physical-outcome')).toContainText(/not sent/i);
    await expect(page.getByTestId('fate-WAITING').first()).toBeVisible();
    await expect(page.getByTestId('fate-ACKNOWLEDGED')).toHaveCount(0);
    // Back online: the officer's deliberate press sends it; nothing retried by itself.
    await page.unroute('**/edge/v1/field-sync/scores');
    await page.route('**/edge/v1/field-sync/scores', (route) => {
      const r = route.request().postDataJSON().records[0];
      return route.fulfill(json({ status: 'SYNCED', results: [{ applicationId: r.applicationId, deviceId: r.deviceId, status: 'ACCEPTED', scoreId: 'score-2' }] }));
    });
    await page.getByTestId('physical-send-again').click();
    await expect(page.getByTestId('physical-outcome')).toContainText(/server has it/i);
  });

  test('a refused record is named, never called saved', async ({ page }) => {
    await signIn(page, ['field.device.enroll', 'field.score.sync']);
    await confirmVenueDay(page);
    await enrolDevice(page);
    await page.route('**/edge/v1/field-sync/scores', (route) => {
      const r = route.request().postDataJSON().records[0];
      return route.fulfill(json({ status: 'SYNCED', results: [{ applicationId: r.applicationId, deviceId: r.deviceId, status: 'REJECTED', reason: 'NOT_ADMITTED' }] }));
    });
    await page.goto('/physical');
    await scanPass(page, 'physical-scanner');
    await fillMetrics(page, metrics);
    await page.getByTestId('physical-save').click();
    await expect(page.getByTestId('physical-outcome')).toContainText(/refused/i);
    await expect(page.getByTestId('physical-outcome')).toContainText(/not been admitted/i);
    await expect(page.getByTestId('fate-REFUSED').first()).toBeVisible();
  });

  test('an out-of-range value needs a remeasure reason before it can be saved', async ({ page }) => {
    await signIn(page, ['field.device.enroll', 'field.score.sync']);
    await confirmVenueDay(page);
    await enrolDevice(page);
    await page.goto('/physical');
    await scanPass(page, 'physical-scanner');
    await fillMetrics(page, { ...metrics, height: '260' });
    await expect(page.getByLabel(/why this value stands/i)).toBeVisible();
    await page.getByTestId('physical-save').click();
    await expect(page.getByText('Give the reason.')).toBeVisible();
  });

  test('an unenrolled tablet is stopped and pointed to setup', async ({ page }) => {
    await signIn(page, ['field.score.sync']);
    await confirmVenueDay(page);
    await page.goto('/physical');
    await expect(page.getByTestId('physical-blocked')).toBeVisible({ timeout: 15_000 });
  });

  test('is not offered to a session without the score permission', async ({ page }) => {
    await signIn(page, ['admission.gate']);
    await page.goto('/physical');
    await expect(page.getByTestId('station-unavailable')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('medical station', () => {
  test('RDF records the board verdict', async ({ page }) => {
    await signIn(page, ['medical.review']);
    await confirmVenueDay(page);
    let body: unknown = null;
    await page.route('**/edge/v1/applications/medical-review', (route) => { body = route.request().postDataJSON(); return route.fulfill(json({ status: 'MEDICAL_RECORDED' })); });
    await page.goto('/medical');
    await scanPass(page, 'medical-scanner');
    await page.getByTestId('medical-choice-FIT').click();
    await page.getByTestId('medical-record').click();
    await expect(page.getByTestId('medical-outcome')).toContainText(/fit recorded/i);
    expect(body).toEqual({ applicationId: APP_ID, fitnessStatus: 'FIT' });
  });

  test('RDF is never asked for a physician; RNP must name one', async ({ page }) => {
    await signIn(page, ['medical.review'], 'RNP');
    await page.addInitScript(([venue, day]) => {
      window.localStorage.setItem('usrp_field_venue_day', JSON.stringify({ campaign: 'rnp-2026', district: 'Kigali', examDate: day, venueName: venue }));
    }, [VENUE, DAY]);
    let body: unknown = null;
    await page.route('**/edge/v1/applications/medical-review', (route) => { body = route.request().postDataJSON(); return route.fulfill(json({ status: 'MEDICAL_RECORDED' })); });
    await page.goto('/medical');
    await scanPass(page, 'medical-scanner', 'RNP');
    await expect(page.getByTestId('medical-choice-FIT')).toHaveCount(0);
    await page.getByTestId('medical-choice-CERT_VERIFIED').click();
    await page.getByTestId('medical-record').click();
    await expect(page.getByText('Enter the physician who signed.')).toBeVisible();
    expect(body).toBeNull();
    await page.getByLabel('Physician name').fill('Dr A. Mukamana');
    await page.getByTestId('medical-record').click();
    await expect(page.getByTestId('medical-outcome')).toContainText(/certificate verified/i);
    expect(body).toEqual({ applicationId: APP_ID, certVerdict: 'CERT_VERIFIED', physicianName: 'Dr A. Mukamana' });
  });

  test('an application not at the medical step is refused by name, a dropped link records nothing', async ({ page }) => {
    await signIn(page, ['medical.review']);
    await confirmVenueDay(page);
    await page.route('**/edge/v1/applications/medical-review', (route) => route.fulfill(json({ error: 'NOT_APPLICABLE' }, 409)));
    await page.goto('/medical');
    await scanPass(page, 'medical-scanner');
    await page.getByTestId('medical-choice-UNFIT').click();
    await page.getByTestId('medical-record').click();
    await expect(page.getByTestId('medical-outcome')).toContainText(/not at the medical step/i);
    await page.getByTestId('medical-next').click();
    await page.unroute('**/edge/v1/applications/medical-review');
    await page.route('**/edge/v1/applications/medical-review', (route) => route.abort('connectionreset'));
    await scanPass(page, 'medical-scanner');
    await page.getByTestId('medical-choice-FIT').click();
    await page.getByTestId('medical-record').click();
    await expect(page.getByTestId('medical-outcome')).toContainText(/nothing was recorded/i);
  });
});

test.describe('supervisor station', () => {
  test('shows venue counts, this tablet and the fleet; fleet needs the manage permission', async ({ page }) => {
    await signIn(page, ['field.conflict.resolve', 'field.device.manage']);
    await confirmVenueDay(page);
    await page.route('**/edge/v1/gate/live-counts**', (route) => route.fulfill(json({ agency: 'RDF', venue: { venueName: VENUE, district: 'Nyagatare', examDate: DAY }, counts: { expected: 40, admitted: 31, physicalCaptured: 12, medicalRecorded: 5, openConflicts: 1 }, asOf: null })));
    await page.route('**/edge/v1/field-sync/devices', (route) => route.fulfill(json({ devices: [
      { deviceId: 'aaaaaaaa-1111', enrolledBy: 'x', enrolledAt: '2026-06-01T00:00:00Z', lastSeenAt: null, lastSeenSource: null, lastSyncAt: '2026-06-06T08:00:00Z', revokedAt: null, revokeReason: null, assignment: { campaignPublicCode: 'rdf-2026', district: 'Nyagatare', examDate: DAY } },
      { deviceId: 'bbbbbbbb-2222', enrolledBy: 'x', enrolledAt: '2026-06-01T00:00:00Z', lastSeenAt: null, lastSeenSource: null, lastSyncAt: null, revokedAt: '2026-06-05T00:00:00Z', revokeReason: 'LOST', assignment: null },
    ] })));
    await page.goto('/supervisor');
    await expect(page.getByTestId('supervisor-counts')).toContainText('admitted 31');
    await expect(page.getByTestId('fleet-aaaaaaaa-1111')).toContainText('Active');
    await expect(page.getByTestId('fleet-bbbbbbbb-2222')).toContainText('Revoked');
    await expect(page.getByTestId('supervisor-sync-summary')).toContainText('0 records');
  });

  test('a read that fails says so and shows no numbers', async ({ page }) => {
    await signIn(page, ['field.conflict.resolve']);
    await confirmVenueDay(page);
    await page.route('**/edge/v1/gate/live-counts**', (route) => route.abort('connectionreset'));
    await page.goto('/supervisor');
    await expect(page.getByTestId('supervisor-counts-failed')).toBeVisible();
    await expect(page.getByTestId('supervisor-counts')).toHaveCount(0);
  });
});

test.describe('conflicts', () => {
  test('a held score is resolved with a mandatory reason, and only a 200 RESOLVED clears it', async ({ page }) => {
    await signIn(page, ['field.device.enroll', 'field.score.sync', 'field.conflict.resolve']);
    await confirmVenueDay(page);
    await enrolDevice(page);
    await page.route('**/edge/v1/field-sync/scores', (route) => {
      const r = route.request().postDataJSON().records[0];
      return route.fulfill(json({ status: 'SYNCED', results: [{ applicationId: r.applicationId, deviceId: r.deviceId, status: 'CONFLICT', scoreId: 'score-9' }] }));
    });
    await page.goto('/physical');
    await scanPass(page, 'physical-scanner');
    await fillMetrics(page, { height: '170', weight: '65', chest: '90', run: '800' });
    await page.getByTestId('physical-save').click();
    await expect(page.getByTestId('physical-outcome')).toContainText(/held for a supervisor/i);

    let resolveBody: unknown = null;
    let answer: { status: number; body: unknown } = { status: 409, body: { status: 'NO_CONFLICT' } };
    await page.route('**/edge/v1/field-sync/conflicts/resolve', (route) => { resolveBody = route.request().postDataJSON(); return route.fulfill(json(answer.body, answer.status)); });
    await page.goto('/conflicts');
    const card = page.locator('[data-testid^="conflict-"]').filter({ has: page.getByText('Height 170 cm') }).first();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.getByText(/give a reason/i)).toBeVisible();
    expect(resolveBody).toBeNull();

    await card.getByLabel('Reason for the decision').fill('Re-measured at the station');
    await card.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.locator('[data-testid^="conflict-failed-"]').first()).toContainText(/no conflict/i);
    expect(resolveBody).toEqual({ applicationId: APP_ID, scoreId: 'score-9', resolution: 'Re-measured at the station' });

    answer = { status: 200, body: { status: 'RESOLVED' } };
    await card.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.getByTestId('conflicts-none')).toBeVisible();
  });

  test('is not offered without the conflict permission', async ({ page }) => {
    await signIn(page, ['field.score.sync']);
    await page.goto('/conflicts');
    await expect(page.getByTestId('station-unavailable')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('biometric check-in notice', () => {
  test('SHADOW shows nothing about a face and never refuses on a no-match', async ({ page }) => {
    await signIn(page, ['admission.gate']);
    await page.route('**/edge/v1/gate/biometric-policy', (route) => route.fulfill(json({ agency: 'RDF', mode: 'SHADOW', legalBasis: 'x', evidenceSchema: 'v1', maxBodyBytes: 1, thresholdPolicy: { version: '1', livenessPassBp: 1, matchBp: 1, noMatchBelowBp: 1 }, referenceSources: [] })));
    await page.goto('/check-in');
    await expect(page.getByTestId('check-in-mode')).toContainText(/shadow/i);
    await expect(page.getByText(/never a refusal/i)).toBeVisible();
  });
});
