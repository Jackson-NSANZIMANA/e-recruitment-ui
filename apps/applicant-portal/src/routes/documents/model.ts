// The citizen's document checklist, as copy keys (S12b clearance states, ADR-032). PURE.
import type { ClearanceItem, ClearanceState, DocumentChecklist } from "@usrp/api-client";

type Item = DocumentChecklist["items"][number];

/** A letter, 12 digits and 4 letters; spaces and hyphens are ignored (the edge's own rule). */
export function normaliseClearanceNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function isClearanceNumberShape(raw: string): boolean {
  return /^[A-Z]\d{12}[A-Z]{4}$/.test(normaliseClearanceNumber(raw));
}

/** The number field is shown when a number is wanted, or when the last one needs correcting. */
export function wantsNumber(state: ClearanceState): boolean {
  return state === "NUMBER_REQUIRED" || state === "CORRECTION_NEEDED";
}

/** While the registry answers, the page re-reads the checklist. */
export function isInFlight(checklist: DocumentChecklist | undefined): boolean {
  return (checklist?.items ?? []).some((i) => i.clearance?.state === "VERIFYING");
}

const KNOWN_CODES: ReadonlySet<string> = new Set([
  "CERTIFICATE_NUMBER_MALFORMED",
  "CERTIFICATE_NOT_FOUND",
  "CERTIFICATE_NOT_VALID",
  "CERTIFICATE_WRONG_TYPE",
  "CERTIFICATE_EXPIRED",
  "CERTIFICATE_NOT_BOUND",
]);

/** The i18n key for a clearance item; a code outside the closed set falls back to a neutral line. */
export function clearanceCopyKey(c: ClearanceItem): string {
  if (c.state === "CORRECTION_NEEDED") {
    return c.code !== null && KNOWN_CODES.has(c.code) ? `citizen_docs.clearance.code.${c.code}` : "citizen_docs.clearance.code.DEFAULT";
  }
  return `citizen_docs.clearance.state.${c.state}`;
}

/** The i18n key for an item's satisfaction; NESA awaiting gets its own words (results not yet published). */
export function satisfactionCopyKey(item: Item): string {
  if (item.satisfaction === "AWAITING_REGISTRY" && item.registry === "NESA") return "citizen_docs.sat.AWAITING_NESA";
  return `citizen_docs.sat.${item.satisfaction}`;
}

export function documentTypeKey(documentType: string): string {
  return `citizen_docs.type.${documentType}`;
}

/** The RIB item that carries the clearance state, if the flow is on. */
export function clearanceItem(checklist: DocumentChecklist | undefined): Item | undefined {
  return (checklist?.items ?? []).find((i) => i.clearance !== undefined);
}
