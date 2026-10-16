// Walk-in lane (ADR-012): which categories the desk may offer, which registry
// reference each one needs, and what a refusal means. Pure, so the screen's
// decisions are testable without a browser.
import {
  ACADEMIC_PATH_BY_CATEGORY,
  APPLICATION_CATEGORIES,
  CATEGORY_AGENCY,
  type Agency,
  type ApplicationCategory,
} from "@usrp/contracts";
import { ApiError } from "@usrp/api-client";

export type AcademicPath = "NESA" | "HEC";

/** Only the officer's own agency's categories; the server rejects any other. */
export function walkInCategories(agency: Agency): readonly ApplicationCategory[] {
  return APPLICATION_CATEGORIES.filter((category) => CATEGORY_AGENCY[category] === agency);
}

export function academicPathOf(category: ApplicationCategory): AcademicPath {
  return ACADEMIC_PATH_BY_CATEGORY[category];
}

/** The register request's academic field, named by the category's path. */
export function academicInput(
  category: ApplicationCategory,
  reference: string,
): { nesaIndexNumber: string } | { hecRegistrationNumber: string } {
  const value = reference.trim();
  return academicPathOf(category) === "NESA" ? { nesaIndexNumber: value } : { hecRegistrationNumber: value };
}

export const WALK_IN_REFUSALS = [
  "INVALID_ACADEMIC_INPUT",
  "NO_WALK_IN_CAMPAIGN",
  "ALREADY_APPLIED",
  "WRONG_AGENCY_CATEGORY",
  "IDENTITY_NOT_VERIFIED",
  "APPLICANT_NOT_FOUND",
  "UNSUPPORTED_AGENCY",
  "FORBIDDEN",
] as const;
export type WalkInRefusal = (typeof WALK_IN_REFUSALS)[number];

export interface RefusalMessage {
  readonly code: WalkInRefusal;
  readonly key: `walk_in.refusals.${WalkInRefusal}`;
  readonly values: Readonly<Record<string, string>>;
}

const KNOWN: ReadonlySet<string> = new Set(WALK_IN_REFUSALS);

/**
 * A registration refusal the officer can act on, or null for an infrastructure
 * fault (network, 5xx, a malformed body), which keeps the generic message.
 * A bare 404 is the backend's APPLICANT_NOT_FOUND (its 404 bodies carry no
 * detail on purpose), so it is named here rather than left as "not found".
 */
export function walkInRefusal(error: unknown, registry: AcademicPath): RefusalMessage | null {
  if (!(error instanceof ApiError)) return null;
  const n = error.normalised;
  const message = (code: WalkInRefusal, values: Record<string, string> = {}): RefusalMessage => ({
    code,
    key: `walk_in.refusals.${code}`,
    values: { registry, ...values },
  });
  switch (n.kind) {
    case "conflict":
    case "unprocessable": {
      if (!KNOWN.has(n.outcome)) return null;
      const code = n.outcome as WalkInRefusal;
      const processingCode = n.data["processingCode"];
      return message(code, typeof processingCode === "string" ? { processingCode } : {});
    }
    case "notFound":
      return message("APPLICANT_NOT_FOUND");
    case "forbidden":
      return message("FORBIDDEN");
    case "unsupportedAgency":
      return message("UNSUPPORTED_AGENCY");
    default:
      return null;
  }
}
