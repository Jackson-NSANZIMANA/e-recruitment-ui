// The category picker's rules, from the campaign's public eligibility summary (ADR-049). PURE.
import type { PublicCategoryEligibility } from "@usrp/api-client";

export interface BandRow {
  /** i18n keys, one per qualification the band names. */
  readonly qualificationKeys: readonly string[];
  readonly minimumAge: number;
  readonly maximumAge: number;
  /** The band names only a ceiling worth stating (the minimum is the usual 18). */
  readonly ceilingOnly: boolean;
}

export interface CategoryRulesView {
  readonly bands: readonly BandRow[];
  readonly acceptedLevelKeys: readonly string[];
  readonly sciencePercent: number | null;
}

/** `FIELD:LAW` -> `category_rules.qual.FIELD_LAW` (a colon is i18next's namespace separator). */
export function qualificationKey(code: string): string {
  return `category_rules.qual.${code.replace(":", "_")}`;
}

export function rulesFor(eligibility: Readonly<Record<string, PublicCategoryEligibility>> | undefined, category: string): CategoryRulesView | null {
  const e = eligibility?.[category];
  if (e === undefined || e.ageBands.length === 0) return null;
  const bands = [...e.ageBands]
    .sort((a, b) => a.maximumAge - b.maximumAge || a.minimumAge - b.minimumAge)
    .map((b): BandRow => ({
      qualificationKeys: b.qualifications.map(qualificationKey),
      minimumAge: b.minimumAge,
      maximumAge: b.maximumAge,
      ceilingOnly: b.minimumAge === 18,
    }));
  return { bands, acceptedLevelKeys: e.educationAlternatives.map((a) => qualificationKey(a.level)), sciencePercent: e.minimumSciencePercent };
}
