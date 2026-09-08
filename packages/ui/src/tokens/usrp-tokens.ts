/**
 * USRP-specific semantic token extensions on top of Atlassian ADS.
 * Raw colours never belong in components; all values below are ADS tokens.
 */
export { token } from "@atlaskit/tokens";

export const agencyTokens = {
  RDF: { background: "color.background.brand.bold", text: "color.text.inverse", borderColor: "color.border.brand" },
  RNP: { background: "color.background.discovery.bold", text: "color.text.inverse", borderColor: "color.border.discovery" },
  RCS: { background: "color.background.success.bold", text: "color.text.inverse", borderColor: "color.border.success" },
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
