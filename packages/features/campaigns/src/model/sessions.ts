// ══════════════════════════════════════════════════════════════════
// campaigns — district sessions and coverage (step 3 of the control plane)
//
// PURE. BUILD-001: one session per target district. A session is a venue, an
// exam day, a reporting hour and a capacity. A capacity left open is an
// explicit, audited decision (UNBOUNDED_CAPACITY), never an empty box.
// ══════════════════════════════════════════════════════════════════

import type { CampaignSessionOccupancy, ConfigureCampaignSessionInput } from '@usrp/api-client';
import { provinceOf } from './geography.ts';
import { isRealDate } from './kigali.ts';

export interface SessionForm {
  readonly venueName: string;
  readonly examDate: string;
  readonly reportingTimeHour: string;
  readonly capacityMode: 'BOUNDED' | 'UNBOUNDED';
  readonly capacityLimit: string;
  readonly isActive: boolean;
}

export const EMPTY_SESSION: SessionForm = { venueName: '', examDate: '', reportingTimeHour: '', capacityMode: 'BOUNDED', capacityLimit: '', isActive: true };

export type SessionField = 'venueName' | 'examDate' | 'reportingTimeHour' | 'capacityLimit';

export function sessionFormOf(s: CampaignSessionOccupancy): SessionForm {
  return {
    venueName: s.venueName,
    examDate: s.examDate,
    reportingTimeHour: String(s.reportingTimeHour),
    capacityMode: s.capacityLimit === null ? 'UNBOUNDED' : 'BOUNDED',
    capacityLimit: s.capacityLimit === null ? '' : String(s.capacityLimit),
    isActive: s.isActive,
  };
}

/** PURE. Per-field problems (i18n key under `campaigns.errors.*`); `window` is the campaign's exam window. */
export function validateSession(form: SessionForm, window: { readonly start: string; readonly end: string }): Partial<Record<SessionField, string>> {
  const e: Partial<Record<SessionField, string>> = {};
  const venue = form.venueName.trim();
  if (venue === '' || venue.length > 200) e.venueName = 'venue';
  if (!isRealDate(form.examDate)) e.examDate = 'dateRequired';
  else if (form.examDate < window.start || form.examDate > window.end) e.examDate = 'sessionOutsideWindow';
  const hour = Number(form.reportingTimeHour);
  if (form.reportingTimeHour.trim() === '' || !Number.isInteger(hour) || hour < 0 || hour > 23) e.reportingTimeHour = 'reportingHour';
  if (form.capacityMode === 'BOUNDED') {
    const cap = Number(form.capacityLimit);
    if (form.capacityLimit.trim() === '' || !Number.isSafeInteger(cap) || cap < 1) e.capacityLimit = 'capacity';
  }
  return e;
}

/** PURE. The configure-session body for a VALID form; the province comes from the district, never from the officer. */
export function toSessionCommand(publicCode: string, district: string, form: SessionForm): ConfigureCampaignSessionInput {
  const province = provinceOf(district);
  if (province === null) throw new Error(`toSessionCommand: unknown district ${district}`);
  const bounded = form.capacityMode === 'BOUNDED';
  return {
    publicCode,
    district,
    province,
    venueName: form.venueName.trim().normalize('NFC'),
    examDate: form.examDate,
    reportingTimeHour: Number(form.reportingTimeHour),
    capacityLimit: bounded ? Number(form.capacityLimit) : null,
    ...(bounded ? {} : { capacityDecisionCode: 'UNBOUNDED_CAPACITY' as const }),
    isActive: form.isActive,
  };
}

export interface Coverage {
  readonly covered: readonly string[];
  readonly missing: readonly string[];
  readonly total: number;
}

/** PURE. Which target districts have an active session. Inactive sessions do not cover. */
export function coverageOf(targetDistricts: readonly string[], sessions: readonly CampaignSessionOccupancy[]): Coverage {
  const active = new Set(sessions.filter((s) => s.isActive).map((s) => s.district));
  const covered = targetDistricts.filter((d) => active.has(d));
  return { covered, missing: targetDistricts.filter((d) => !active.has(d)), total: targetDistricts.length };
}
