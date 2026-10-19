import { expect, test, type Page } from '@playwright/test';

/**
 * Venue gate (BUILD-003, ADR-034) over the Field Station's production bundle,
 * with the edge intercepted. Moved here from apps/officer-console/e2e in S02
 * (ADR-FE-007) together with the screen. Proves the screen sends exactly what the contract says,
 * shows green only for ADMITTED, and treats a second scan of the same QR as
 * the refusal it is.
 */
const SESSION = (permissions: string[]) => ({
  kind: 'officer',
  agency: 'RDF',
  roles: ['screening_officer'],
  permissions,
  idleExpiresAt: '2099-01-01T00:00:00.000Z',
  absoluteExpiresAt: '2099-01-02T00:00:00.000Z',
});
const CANDIDATE = { applicationId: '22222222-2222-4222-8222-222222222222', processingCode: 'RDF-90001', category: 'GENERAL_ENLISTMENT' };
const QR = 'USRP-SLOT.v1.eyJ0IjoxfQ.c2ln';
const NID = '1199880012345678';
const VENUE = 'IPRC Kicukiro Stadium';

async function mockSession(page: Page, permissions: string[]): Promise<void> {
  await page.route('**/edge/v1/session', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION(permissions)) }),
  );
}

test('the gate admits once and refuses the same QR the second time', async ({ page }) => {
  await mockSession(page, ['admission.gate', 'application.read']);
  const bodies: unknown[] = [];
  await page.route('**/edge/v1/gate/admissions', async (route) => {
    bodies.push(route.request().postDataJSON());
    const first = bodies.length === 1;
    await route.fulfill(first
      ? { status: 200, contentType: 'application/json', body: JSON.stringify({ outcome: 'ADMITTED', candidate: CANDIDATE, venueName: VENUE, examDate: '2026-12-01', reportingTimeHour: 8, admittedAt: '2026-12-01T06:01:00.000Z', statusAdvanced: true }) }
      : { status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'ALREADY_ADMITTED', candidate: CANDIDATE, admittedAt: '2026-12-01T06:01:00.000Z', venueName: VENUE, admittedBySelf: true }) });
  });

  await page.goto('/gate');
  const venue = page.getByLabel(/this gate's venue|aho iri rembo riri|site de cette porte/i);
  await expect(venue).toBeVisible({ timeout: 15_000 });
  await venue.fill(VENUE);
  await venue.press('Enter');

  const admitOnce = async (): Promise<void> => {
    const qr = page.getByLabel(/exam qr code|kode qr y'ikizamini|qr d'examen/i);
    await qr.fill(QR);
    await qr.press('Enter');
    await expect(page.getByTestId('gate-qr-captured')).toBeVisible();
    await page.getByLabel(/national id number|nimero y'indangamuntu|numéro d'identité/i).fill('1199 8800 1234 5678');
    await page.getByTestId('gate-admit').click();
  };

  await admitOnce();
  const outcome = page.getByTestId('gate-outcome');
  await expect(outcome).toContainText(/admitted|yinjiye|admis/i);
  await expect(outcome).toContainText('RDF-90001');
  expect(bodies[0]).toEqual({ qrToken: QR, nationalId: NID, gateVenueName: VENUE });
  await expect(page.getByText(QR)).toHaveCount(0); // the credential is never displayed

  await page.getByRole('button', { name: /next candidate|umukandida ukurikira|candidat suivant/i }).click();
  await admitOnce();
  await expect(outcome).toContainText(/already used|yamaze gukoreshwa|déjà utilisé/i);
  await expect(outcome).toContainText(VENUE);
});

test('an officer without admission.gate sees why, and no gate on the station picker', async ({ page }) => {
  await mockSession(page, ['application.read', 'walkin.register']);
  await page.route('**/edge/v1/gate/admissions', (route) => route.abort());
  await page.goto('/gate');
  await expect(page.getByText(/cannot admit at the gate|ntizikwemerera kwinjiza|ne permet pas d'admettre/i)).toBeVisible({ timeout: 15_000 });
  await page.goto('/stations');
  await expect(page.getByTestId('station-walk_in')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('station-gate')).toHaveCount(0);
});
