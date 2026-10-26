/**
 * USRP-specific semantic token extensions on top of Atlassian ADS.
 * Raw colours never belong in components; all values below are ADS tokens.
 */
export { token } from "@atlaskit/tokens";

/**
 * Agency accents, for the rare place an agency needs a colour of its own (a
 * badge where no emblem fits). Non-semantic ADS accent tokens only, picked
 * from each agency's own emblem: RDF's green field, RNP's blue roundel, RCS's
 * charcoal. They were previously brand/discovery/SUCCESS - which made every
 * RCS badge read as "approved". Semantic tokens mean a status, never an
 * institution (ADR-FE-020).
 */
export const agencyTokens = {
  RDF: { background: "color.background.accent.green.bolder", text: "color.text.inverse", borderColor: "color.border.accent.green" },
  RNP: { background: "color.background.accent.blue.bolder", text: "color.text.inverse", borderColor: "color.border.accent.blue" },
  RCS: { background: "color.background.accent.gray.bolder", text: "color.text.inverse", borderColor: "color.border.accent.gray" },
} as const;

export type AgencyTokenSet = (typeof agencyTokens)[keyof typeof agencyTokens];

import type { ApplicationStatus } from "@usrp/contracts";

export type LozengeAppearance = "default" | "inprogress" | "moved" | "new" | "removed" | "success";

export const statusLozenge: Record<ApplicationStatus, LozengeAppearance> = {
  DRAFT: "default",
  SUBMITTED: "new",
  ACADEMIC_VETTING: "inprogress",
  CRIMINAL_CLEARANCE: "inprogress",
  DOCUMENT_REVIEW_GREEN: "success",
  DOCUMENT_REVIEW_AMBER: "inprogress",
  SLOT_ASSIGNED: "moved",
  PHYSICAL_TEST_SCHEDULED: "inprogress",
  PHYSICAL_TEST_COMPLETE: "success",
  MEDICAL_REVIEW: "inprogress",
  FINAL_SHORTLIST: "moved",
  ACCEPTED: "success",
  ADJUDICATION_REVIEW: "inprogress",
  REJECTED: "removed",
  WITHDRAWN: "default",
  WALK_IN_REGISTERED: "new",
  WALK_IN_ON_SITE_VETTING: "inprogress",
  WALK_IN_PHYSICAL_TEST: "inprogress",
  WALK_IN_REJECTED: "removed",
};
