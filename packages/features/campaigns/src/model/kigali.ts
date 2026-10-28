// campaigns — Kigali wall-clock time. PURE.
//
// Rwanda keeps UTC+2 all year (Africa/Kigali, no daylight saving), so the
// conversion is a fixed offset. The Studio shows and accepts Kigali time and
// always sends an instant with an explicit offset, as the edge requires.

export const KIGALI_OFFSET_HOURS = 2;
export const KIGALI_OFFSET = '+02:00';

const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

/** "2026-11-01T08:00" (Kigali wall clock, as a datetime-local input gives it) → "2026-11-01T08:00:00+02:00", or null. */
export function kigaliLocalToInstant(local: string): string | null {
  const m = LOCAL.exec(local);
  if (m === null) return null;
  const instant = `${m[1]}T${m[2]}:${m[3]}:00${KIGALI_OFFSET}`;
  return Number.isNaN(Date.parse(instant)) ? null : instant;
}

/** Any ISO instant → "YYYY-MM-DDTHH:mm" on the Kigali wall clock (the datetime-local value). */
export function instantToKigaliLocal(instant: string): string {
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) return '';
  return new Date(ms + KIGALI_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 16);
}

/** Display form: "2026-11-01 08:00 (Kigali)". The zone is part of the text, never implied. */
export function formatKigali(instant: string): string {
  const local = instantToKigaliLocal(instant);
  return local === '' ? instant : `${local.replace('T', ' ')} (Kigali, UTC+2)`;
}

/** Every calendar day from `start` to `end` inclusive (YYYY-MM-DD), capped at 62 days. */
export function daysBetween(start: string, end: string): readonly string[] {
  const out: string[] = [];
  const first = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(first) || Number.isNaN(last) || first > last) return out;
  for (let ms = first; ms <= last && out.length < 62; ms += 86_400_000) out.push(new Date(ms).toISOString().slice(0, 10));
  return out;
}

/** Today's date on the Kigali calendar (YYYY-MM-DD). */
export function kigaliToday(now: Date): string {
  return new Date(now.getTime() + KIGALI_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}
