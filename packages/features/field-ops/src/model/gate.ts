// ═══════════════════════════════════════════════════════════════
// field-ops — what the gate screen says for each answer (ADR-034)
//
// Moved from apps/officer-console/src/gate/outcome.ts in S02 (ADR-FE-007):
// the gate runs on the Field Station now, and the logic belongs to the slice.
//
// PURE. One place maps a GateAdmissionResult to the message an officer acts
// on, so the screen and its tests agree. The rule of the gate is simple and
// the colours carry it: green means let them in, everything else means do not.
// ═══════════════════════════════════════════════════════════════

import type { GateAdmissionResult } from "@usrp/api-client";

export type GateAppearance = "success" | "warning" | "error";

export interface GateMessage {
  readonly appearance: GateAppearance;
  /** i18n key of the title. */
  readonly titleKey: string;
  /** i18n key of the body. */
  readonly bodyKey: string;
  readonly values: Readonly<Record<string, string>>;
  /** True only for ADMITTED: the single instruction "let them in". */
  readonly admit: boolean;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** "08:00" from an integer hour. */
export function reportingTime(hour: number): string {
  return `${pad(hour)}:00`;
}

/** The time of day in Kigali, for "used at 07:42". */
export function kigaliTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function gateMessage(result: GateAdmissionResult, selfSuffix: string): GateMessage {
  const base = (outcome: string): { titleKey: string; bodyKey: string } => ({
    titleKey: `gate.outcomes.${outcome}.title`,
    bodyKey: `gate.outcomes.${outcome}.body`,
  });
  switch (result.outcome) {
    case "ADMITTED":
      return {
        appearance: "success",
        ...base("ADMITTED"),
        values: {
          code: result.candidate.processingCode,
          category: result.candidate.category,
          hour: reportingTime(result.reportingTimeHour),
        },
        admit: true,
      };
    case "ALREADY_ADMITTED":
      return {
        appearance: "error",
        ...base("ALREADY_ADMITTED"),
        values: { venue: result.venueName, time: kigaliTime(result.admittedAt), by: result.admittedBySelf ? selfSuffix : "" },
        admit: false,
      };
    case "IDENTITY_MISMATCH":
      return { appearance: "error", ...base("IDENTITY_MISMATCH"), values: { code: result.candidate.processingCode }, admit: false };
    case "MANUAL_IDENTITY_REQUIRED":
      return { appearance: "warning", ...base("MANUAL_IDENTITY_REQUIRED"), values: { code: result.candidate.processingCode }, admit: false };
    case "NOT_ADMISSIBLE":
      return {
        appearance: "error",
        ...base("NOT_ADMISSIBLE"),
        values: { code: result.candidate.processingCode, status: result.currentStatus },
        admit: false,
      };
    case "WRONG_VENUE":
      return { appearance: "warning", ...base("WRONG_VENUE"), values: { venue: result.ticketVenueName }, admit: false };
    case "TOO_EARLY":
    case "EXPIRED":
      return { appearance: "warning", ...base(result.outcome), values: { date: result.examDate }, admit: false };
    case "INVALID_TICKET":
      return {
        appearance: "error",
        titleKey: "gate.outcomes.INVALID_TICKET.title",
        bodyKey: `gate.invalid_reasons.${result.reason}`,
        values: {},
        admit: false,
      };
  }
}

/** The 16-digit shape the server also enforces; spaces from the card are dropped. */
export function normaliseNationalId(raw: string): string | null {
  const digits = raw.replace(/\s+/g, "");
  return /^\d{16}$/.test(digits) ? digits : null;
}

/** Where the gate's venue is remembered on this device. */
export const GATE_VENUE_STORAGE_KEY = "usrp_gate_venue";

export function readStoredVenue(): string {
  try {
    return localStorage.getItem(GATE_VENUE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeVenue(venue: string): void {
  try {
    localStorage.setItem(GATE_VENUE_STORAGE_KEY, venue);
  } catch {
    // Storage unavailable (private mode): the venue lives in component state.
  }
}
