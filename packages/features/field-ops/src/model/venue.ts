// ══════════════════════════════════════════════════════════════════
// field-ops — the venue day this tablet works (S08 setup)
//
// A venue day is (campaign public code, district, exam date). Its name comes
// from the server (getVenueRoster) and is what the gate sends as the venue.
// Typed and confirmed by the officer; the roster call is the confirmation.
// PURE except the optional storage argument.
// ══════════════════════════════════════════════════════════════════

export interface VenueDay {
  readonly campaign: string;
  readonly district: string;
  readonly examDate: string;
  readonly venueName: string;
}

export const VENUE_DAY_STORAGE_KEY = 'usrp_field_venue_day';

export interface VenueDayDraft { readonly campaign: string; readonly district: string; readonly examDate: string }

export type VenueDayProblem = 'campaign' | 'district' | 'examDate';

/** PURE. Which typed fields are unusable. */
export function venueDayProblems(draft: VenueDayDraft): readonly VenueDayProblem[] {
  const out: VenueDayProblem[] = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/.test(draft.campaign.trim())) out.push('campaign');
  if (draft.district.trim().length < 2 || draft.district.trim().length > 80) out.push('district');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.examDate.trim()) || Number.isNaN(Date.parse(draft.examDate.trim()))) out.push('examDate');
  return out;
}

export function readVenueDay(storage: Pick<Storage, 'getItem'> = globalThis.localStorage): VenueDay | null {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(VENUE_DAY_STORAGE_KEY) ?? 'null');
    if (parsed === null || typeof parsed !== 'object') return null;
    const v = parsed as Record<string, unknown>;
    return typeof v['campaign'] === 'string' && typeof v['district'] === 'string' && typeof v['examDate'] === 'string' && typeof v['venueName'] === 'string'
      ? { campaign: v['campaign'], district: v['district'], examDate: v['examDate'], venueName: v['venueName'] }
      : null;
  } catch {
    return null;
  }
}

export function writeVenueDay(day: VenueDay | null, storage: Pick<Storage, 'setItem' | 'removeItem'> = globalThis.localStorage): void {
  try {
    if (day === null) storage.removeItem(VENUE_DAY_STORAGE_KEY);
    else storage.setItem(VENUE_DAY_STORAGE_KEY, JSON.stringify(day));
  } catch {
    // Private mode: the venue day lives for this tab only (held by the caller).
  }
}
