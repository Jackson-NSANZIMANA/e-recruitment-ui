/**
 * USRP-specific semantic token extensions on top of the Atlassian Design
 * System token layer.
 *
 * RULE: Never use raw hex values in components.  Always reference a token.
 *  - For ADS tokens: import { token } from "@atlaskit/tokens"
 *  - For USRP semantic overrides: import { usrpToken } from "@usrp/ui/tokens"
 *
 * The three agencies each have a distinct primary colour.  All other design
 * decisions (spacing, elevation, typography) are inherited from ADS.
 */

/**
 * Returns the CSS custom-property reference for an ADS design token.
 * We re-export this so components only import from @usrp/ui, not directly
 * from @atlaskit/tokens — giving us a single seam to extend.
 */
export { token } from "@atlaskit/tokens";

// ─── Agency colour semantics ──────────────────────────────────────────────────
// Values are ADS token names.  They resolve at runtime to the active theme's
// CSS variables.  We do NOT hard-code agency hex colours; we map agencies to
// ADS semantic colour roles so that light/dark mode and high-contrast themes
// work correctly for free.

export const agencyTokens = {
  RDF: {
    /** The RDF brand maps to ADS "brand" — deep blue. */
    background: "color.background.brand.bold",
    text: "color.text.inverse",
    borderColor: "color.border.brand",
  },
  RNP: {
    /** RNP maps to ADS "discovery" — dark navy / indigo. */
    background: "color.background.discovery.bold",
    text: "color.text.inverse",
    borderColor: "color.border.discovery",
  },
  RCS: {
    /** RCS maps to ADS "success" — institutional green. */
    background: "color.background.success.bold",
    text: "color.text.inverse",
    borderColor: "color.border.success",
  },
} as const;

export type AgencyTokenSet = (typeof agencyTokens)[keyof typeof agencyTokens];

// ─── Application status colour map ───────────────────────────────────────────
// Maps every lifecycle state to an ADS Lozenge appearance value so we never
// hand-pick colours for status labels.

import type { ApplicationStatus } from "@usrp/shared-types";

export type LozengeAppearance =
  | "default"
  | "inprogress"
  | "moved"
  | "new"
  | "removed"
  | "success";

export const statusLozenge: Record<ApplicationStatus, LozengeAppearance> = {
  DRAFT: "default",
  SUBMITTED: "new",
  UNDER_REVIEW: "inprogress",
  SHORTLISTED: "inprogress",
  PHYSICAL_SCHEDULED: "inprogress",
  PHYSICAL_PASSED: "inprogress",
  PHYSICAL_FAILED: "removed",
  MEDICAL_SCHEDULED: "inprogress",
  MEDICAL_PASSED: "inprogress",
  MEDICAL_FAILED: "removed",
  VETTING_IN_PROGRESS: "moved",
  VETTING_PASSED: "inprogress",
  VETTING_FAILED: "removed",
  ACCEPTED: "success",
  REJECTED: "removed",
  WITHDRAWN: "default",
  EXPIRED: "default",
};
