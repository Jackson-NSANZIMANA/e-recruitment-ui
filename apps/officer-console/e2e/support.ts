import type { Page, Route } from '@playwright/test';

export type Perms = readonly string[];

/** Posts → permissions, as the backend's session view reports them (provisional role table, ADR-031). */
export const POSTS = {
  admin: ['application.read', 'adjudication.read', 'campaign.read.admin', 'campaign.create', 'campaign.policy.create', 'campaign.session.configure', 'campaign.publish', 'campaign.registration.close', 'campaign.complete', 'campaign.cancel', 'officer.read', 'officer.create', 'officer.posts.assign', 'officer.disable', 'officer.sessions.revoke'],
  medical: ['medical.review', 'application.read', 'adjudication.read'],
  director: ['decision.final', 'application.accept', 'biometric.evidence.read', 'application.read', 'adjudication.read'],
  adjudicator: ['adjudication.decide', 'biometric.evidence.read', 'application.read', 'adjudication.read'],
  reviewer: ['campaign.read.admin', 'biometric.evidence.read', 'application.read', 'adjudication.read'],
  dpo: ['erasure.queue.read', 'erasure.decide'],
} as const satisfies Record<string, Perms>;

export const json = (route: Route, status: number, body: unknown): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export async function signIn(page: Page, roles: readonly string[], permissions: Perms, agency = 'RDF'): Promise<void> {
  await page.addInitScript(() => window.localStorage.setItem('usrp_lang', 'en'));
  await page.route('**/edge/v1/session', (route) =>
    json(route, 200, { kind: 'officer', agency, roles, permissions, idleExpiresAt: '2099-01-01T00:00:00.000Z', absoluteExpiresAt: '2099-01-02T00:00:00.000Z' }),
  );
  // Anything not mocked by a spec is an empty read, never a network call.
  await page.route('**/edge/v1/applications', (route) => json(route, 200, []));
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, []));
}

export const ID1 = '00000000-0000-4000-8000-000000000001';
export const ID2 = '00000000-0000-4000-8000-000000000002';
export const ID3 = '00000000-0000-4000-8000-000000000003';

export function application(status: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    applicationId: ID1, processingCode: 'RDF-98001', category: 'Infantry Recruit', status, agency: 'RDF',
    academicStatus: 'VERIFIED', nesaIndexNumber: '123456789012', nesaVerifiedAt: null, hecRegistrationNumber: null, hecVerifiedAt: null,
    declaredSpecialistField: null, academicEligibilityDetail: null, ageEligibilityStatus: 'ELIGIBLE', ageVerifiedAt: null, ageEligibilityDetail: null,
    criminalClearanceStatus: 'CLEARED', criminalClearanceAt: null, documentLane: 'GREEN', documentForensicsScore: null, documentForensicsFlags: null,
    documentReviewedAt: null, documentReviewDecision: null, assignedDistrict: 'Gasabo', assignedVenueName: 'Kigali Arena',
    physicalTestScheduledAt: '2026-09-01T08:00:00.000Z', physicalTestCompletedAt: null, qrInvitationIssuedAt: null, smsNotificationSentAt: null,
    finalDecisionAt: null, finalDecisionNotes: null, submittedAt: '2026-08-01T08:00:00.000Z', createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-02T08:00:00.000Z',
    ...overrides,
  };
}

export const officerRow = (o: Record<string, unknown> = {}): Record<string, unknown> => ({
  officerId: ID2, loginHandle: 'rdf.med.one', posts: ['medical_officer'], status: 'active', createdAt: '2026-10-22T08:00:00.000Z',
  activatedAt: '2026-10-22T09:00:00.000Z', lastLoginAt: null, activationExpiresAt: null, activationState: null, releasableByYou: false, ...o,
});
