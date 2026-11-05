// What the upload panel offers, from the APPLICATION's own checklist (PURE).
//
// The required list is the campaign's policy version, authored by the officer in
// the campaign studio and bound to the application when it was filed (BUILD-001,
// resolved server-side by application-service). The browser never re-derives it
// from the agency's catalogue: that catalogue says what an agency CAN store, not
// what THIS campaign asks for. Only when the checklist cannot be read does the
// panel fall back to the agency catalogue, and it says so.
import type { DocumentChecklist } from "@usrp/api-client";
import { satisfactionCopyKey } from "../documents/model.js";

type Item = DocumentChecklist["items"][number];

/** Satisfied by a registry, an upload that cleared, or the venue: nothing to send. */
const DONE: ReadonlySet<string> = new Set(["API_VERIFIED", "UPLOADED_CLEARED", "VENUE_VERIFIED", "AWAITING_REGISTRY"]);

export type UploadChoices =
  /** The checklist is still loading. */
  | { readonly kind: "LOADING" }
  /** The checklist could not be read: the agency catalogue, flagged as a fallback. */
  | { readonly kind: "FALLBACK"; readonly types: readonly string[] }
  /** The campaign's own list: what may still be uploaded, and the Irembo clearance item, if any. */
  | {
      readonly kind: "POLICY";
      readonly required: readonly Item[];
      readonly types: readonly string[];
      readonly clearance: Item | null;
    };

/**
 * The document types the citizen may upload now.
 *
 *   • only types the campaign requires (the checklist items);
 *   • the criminal-clearance item stays uploadable until it is verified: its
 *     IremboGov application number proves the certificate authentic and the
 *     applicant's, but when its type can carry convictions an officer must read
 *     what it says, from the PDF uploaded here (ADR-048 §2.3.4). A verified
 *     certificate is API_VERIFIED, so it drops out like any satisfied item;
 *   • not an item a registry, a cleared upload or the venue already satisfied;
 *   • only types the agency can store (a policy is validated against that, so
 *     this is belt and braces).
 */
export function uploadChoices(
  checklist: DocumentChecklist | undefined,
  state: { readonly isLoading: boolean; readonly isError: boolean },
  agencyTypes: readonly string[],
): UploadChoices {
  if (checklist === undefined) {
    if (state.isError) return { kind: "FALLBACK", types: agencyTypes };
    return { kind: "LOADING" };
  }
  // The checklist is not decoded at the boundary: an answer without an item list is unreadable,
  // not "the campaign requires nothing".
  const items: unknown = typeof checklist === "object" && checklist !== null ? (checklist as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) return { kind: "FALLBACK", types: agencyTypes };
  const required = items as readonly Item[];
  const storable = new Set(agencyTypes);
  const clearance = required.find((i) => i.clearance !== undefined) ?? null;
  const types = required
    .filter((i) => !DONE.has(i.satisfaction) && storable.has(i.documentType))
    .map((i) => i.documentType);
  return { kind: "POLICY", required, types, clearance };
}

/** The selected type, kept valid when the offered list changes (a refetch after an upload). */
export function selectedType(current: string | null, types: readonly string[]): string | null {
  if (current !== null && types.includes(current)) return current;
  return types[0] ?? null;
}

/**
 * The i18n key for one required item's line. The clearance item is checked through IremboGov;
 * a missing item the citizen can upload here says so, rather than only "bring it to the venue".
 */
export function requiredItemCopyKey(item: Item, uploadable: readonly string[]): string {
  if (item.clearance !== undefined) return "apply.required_docs.via_irembo";
  if (item.satisfaction === "MISSING" && uploadable.includes(item.documentType)) return "apply.required_docs.missing_upload";
  return satisfactionCopyKey(item);
}
