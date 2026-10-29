// ══════════════════════════════════════════════════════════════════
// campaigns — preflight (step 4) and lifecycle consequences
//
// PURE. The checklist is advice: it stops the officer publishing something the
// server will refuse (409 INCOMPLETE_COVERAGE, POLICY_NOT_SET, ...). The server
// re-checks everything and its structured 409 is still rendered, with the step
// that failed (`stepOfRefusal`).
// ══════════════════════════════════════════════════════════════════

import type { CampaignAdminDetail } from '@usrp/api-client';
import { coverageOf } from './sessions.ts';

export const PREFLIGHT_CHECKS = ['draft', 'policy', 'coverage', 'capacity', 'windows'] as const;
export type PreflightCheckId = (typeof PREFLIGHT_CHECKS)[number];
export interface PreflightItem { readonly id: PreflightCheckId; readonly ok: boolean; readonly count: number }

export function preflight(detail: CampaignAdminDetail): readonly PreflightItem[] {
  const s = detail;
  const active = detail.sessions.filter((x) => x.isActive);
  const coverage = coverageOf(s.targetDistricts, detail.sessions);
  const badCapacity = active.filter((x) => x.capacityLimit === null ? x.capacityDecisionCode !== 'UNBOUNDED_CAPACITY' : x.capacityLimit < 1);
  const examStart = s.examinationStartDate;
  const examEnd = s.examinationEndDate;
  const outside = active.filter((x) => x.examDate < examStart || x.examDate > examEnd);
  const windowsOk = Date.parse(s.registrationOpensAt) < Date.parse(s.registrationClosesAt) && examStart <= examEnd && outside.length === 0;
  return [
    { id: 'draft', ok: s.status === 'DRAFT', count: 0 },
    { id: 'policy', ok: detail.policy !== null, count: 0 },
    { id: 'coverage', ok: coverage.missing.length === 0 && coverage.total > 0, count: coverage.missing.length },
    { id: 'capacity', ok: active.length > 0 && badCapacity.length === 0, count: badCapacity.length },
    { id: 'windows', ok: windowsOk, count: outside.length },
  ];
}

export function canPublish(items: readonly PreflightItem[]): boolean {
  return items.every((i) => i.ok);
}

export type StudioStep = 'basics' | 'policy' | 'sessions' | 'publish';

/** Which step an officer must return to for a refusal code, so a 409 "points to the failing step". */
export function stepOfRefusal(code: string): StudioStep | null {
  switch (code) {
    case 'POLICY_NOT_SET': case 'POLICY_VERSION_CONFLICT': case 'POLICY_HASH_MISMATCH': case 'POLICY_CATEGORY_COVERAGE_MISMATCH': return 'policy';
    case 'INCOMPLETE_COVERAGE': case 'STALE_COVERAGE': case 'INVALID_CAPACITY': case 'CAPACITY_DECISION_REQUIRED': case 'SESSION_ALREADY_RESERVED':
    case 'SESSION_CONFLICT': case 'INVALID_SESSION_DATE': case 'INVALID_REPORTING_HOUR': case 'DISTRICT_PROVINCE_MISMATCH': return 'sessions';
    case 'INVALID_STATE': case 'CAMPAIGN_NOT_FOUND': case 'PUBLIC_CODE_ALREADY_EXISTS': case 'CAMPAIGN_LABEL_ALREADY_EXISTS': return 'basics';
    default: return null;
  }
}

/** What a lifecycle command will touch. `null` means unavailable (never shown as zero). */
export interface Consequences { readonly registered: number | null; readonly sessions: number | null }

export function consequencesOf(detail: CampaignAdminDetail): Consequences {
  const o = detail.occupancy as { readonly registeredTotal?: unknown; readonly sessionCount?: unknown } | undefined;
  return {
    registered: typeof o?.registeredTotal === 'number' ? o.registeredTotal : null,
    sessions: typeof o?.sessionCount === 'number' ? o.sessionCount : null,
  };
}
