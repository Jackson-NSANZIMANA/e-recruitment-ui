import type { Page } from '@playwright/test';
import { ID1, ID2, ID3, json, officerRow } from './support';

// A deterministic fake of the edge's search: it honours `campaign`, `category`,
// `status` (a stage) and `submittedFrom`/`submittedTo`, and answers `total` only,
// which is all the analytics screens read. The numbers are chosen so exact
// figures can be asserted.

export const STAGE_OF: Record<string, number> = {
  SUBMITTED: 0, ACADEMIC_VETTING: 0, CRIMINAL_CLEARANCE: 0,
  DOCUMENT_REVIEW_GREEN: 1, DOCUMENT_REVIEW_AMBER: 1, ADJUDICATION_REVIEW: 1,
  SLOT_ASSIGNED: 2, PHYSICAL_TEST_SCHEDULED: 2, PHYSICAL_TEST_COMPLETE: 2,
  MEDICAL_REVIEW: 3, FINAL_SHORTLIST: 3,
  ACCEPTED: 4,
  REJECTED: 5, WITHDRAWN: 5,
};

/** Per campaign: vetting, documents, exam, medical, accepted, closed. */
export const MATRIX: Record<string, readonly number[]> = {
  'RDF-2026-REG': [42, 9, 31, 5, 3, 11],
  'RDF-2026-RES': [20, 6, 10, 2, 1, 4],
  'RDF-2025-OLD': [2, 0, 0, 0, 2, 10],
};
const CATEGORY_SHARE: Record<string, number> = { GENERAL_ENLISTMENT: 0.6, RESERVE_FORCE_ALEVEL: 0.4 };

// Keyed on the day number since the epoch, so the same weekday a week apart differs.
const dayValue = (date: string): number => {
  const d = new Date(`${date}T00:00:00Z`);
  const epochDay = Math.floor(d.getTime() / 86_400_000);
  return ((epochDay * 7) % 9 + d.getUTCDay()) % 9;
};

export function searchTotal(params: URLSearchParams): number {
  const campaigns = params.get('campaign') !== null ? [params.get('campaign') as string] : Object.keys(MATRIX);
  const status = params.get('status')?.split(',') ?? [];
  const share = CATEGORY_SHARE[params.get('category') ?? ''] ?? 1;
  let n = 0;
  if (status.length > 0) {
    const stage = STAGE_OF[status[0] as string] ?? 0;
    n = campaigns.reduce((s, c) => s + (MATRIX[c]?.[stage] ?? 0), 0);
  } else {
    const from = params.get('submittedFrom');
    const to = params.get('submittedTo') ?? from;
    if (from !== null && to !== null) {
      // The single-day queries the screens make: a stable per-day figure, split across campaigns.
      n = dayValue(from) * (campaigns.length === Object.keys(MATRIX).length ? 1 : 0.5);
    } else {
      n = campaigns.reduce((s, c) => s + (MATRIX[c] ?? []).reduce((a, b) => a + b, 0), 0);
    }
  }
  return Math.round(n * share);
}

const campaign = (code: string, label: string, status: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  publicCode: code, campaignLabel: label, status,
  targetCategories: ['GENERAL_ENLISTMENT', 'RESERVE_FORCE_ALEVEL'], targetDistricts: ['NYAGATARE'],
  registrationOpensAt: '2026-10-20T06:00:00.000Z', registrationClosesAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
  examinationStartDate: '2026-12-01', examinationEndDate: '2026-12-02', allowsWalkIn: true, targetIntakeCount: 400,
  publishedAt: '2026-10-20T06:00:00.000Z', createdAt: '2026-10-19T06:00:00.000Z',
  occupancy: { sessionCount: 2, capacityTotal: 300, hasUnboundedSession: false, registeredTotal: 120 }, ...over,
});

// An hour of margin: the page reads its own clock slightly before this runs, and ages are whole days (floored).
const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000 - 3_600_000).toISOString();

/** Stub every read the dashboard and the analytics screens make. */
export async function analyticsReads(page: Page): Promise<void> {
  await page.route('**/edge/v1/campaigns/admin**', (route) => json(route, 200, {
    agency: 'RDF', total: 3, nextCursor: null,
    campaigns: [
      campaign('RDF-2026-REG', 'RDF 2026 regular personnel', 'REGISTRATION_OPEN'),
      campaign('RDF-2026-RES', 'RDF 2026 Reserve Force', 'REGISTRATION_OPEN', { occupancy: { sessionCount: 1, capacityTotal: 100, hasUnboundedSession: false, registeredTotal: 95 } }),
      campaign('RDF-2025-OLD', 'RDF 2025', 'COMPLETED', { createdAt: '2025-05-01T06:00:00.000Z' }),
    ],
  }));
  await page.route('**/edge/v1/applications/search**', (route) => {
    const total = searchTotal(new URL(route.request().url()).searchParams);
    return json(route, 200, { agency: 'RDF', applications: [], total, nextCursor: null });
  });
  await page.route('**/edge/v1/applications/amber-queue', (route) => json(route, 200, [
    { applicationId: ID1, processingCode: 'RDF-0001', status: 'DOCUMENT_REVIEW_AMBER', queuedAt: daysAgo(6), agency: 'RDF', reasons: ['DOCUMENT_HOLD'] },
    { applicationId: ID2, processingCode: 'RDF-0002', status: 'DOCUMENT_REVIEW_AMBER', queuedAt: daysAgo(2), agency: 'RDF', reasons: [] },
    { applicationId: ID3, processingCode: 'RDF-0003', status: 'ADJUDICATION_REVIEW', queuedAt: daysAgo(0), agency: 'RDF' },
  ]));
  await page.route('**/edge/v1/officers', (route) => json(route, 200, { officers: [officerRow({ officerId: ID1, loginHandle: 'rdf.admin', posts: ['agency_admin'] })] }));
  await page.route('**/edge/v1/field-sync/devices', (route) => json(route, 200, { devices: [] }));
}
