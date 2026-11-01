import { describe, expect, it } from "vitest";
import type { PublicCategoryEligibility } from "@usrp/api-client";
import { qualificationKey, rulesFor } from "./category-rules.js";

const reserve: Record<string, PublicCategoryEligibility> = {
  RESERVE_FORCE_ALEVEL: { ageBands: [{ qualifications: ["A_LEVEL_A2"], minimumAge: 18, maximumAge: 25 }, { qualifications: ["BACHELOR_A0", "A1_IPRC"], minimumAge: 18, maximumAge: 26 }, { qualifications: ["FIELD:MEDICINE", "FIELD:LAW"], minimumAge: 18, maximumAge: 27 }], educationAlternatives: [{ level: "A_LEVEL_A2" }], minimumSciencePercent: null },
  OFFICER_FOUR_YEAR_UR: { ageBands: [{ qualifications: ["A_LEVEL_A2"], minimumAge: 18, maximumAge: 21 }], educationAlternatives: [{ level: "A_LEVEL_A2" }], minimumSciencePercent: 70 },
};

describe("category rules", () => {
  it("lists the three Reserve caps from lowest to highest, qualifications as words", () => {
    const view = rulesFor(reserve, "RESERVE_FORCE_ALEVEL");
    expect(view?.bands.map((b) => b.maximumAge)).toEqual([25, 26, 27]);
    expect(view?.bands[2]?.qualificationKeys).toEqual(["category_rules.qual.FIELD_MEDICINE", "category_rules.qual.FIELD_LAW"]);
  });
  it("carries the science bar", () => {
    expect(rulesFor(reserve, "OFFICER_FOUR_YEAR_UR")?.sciencePercent).toBe(70);
  });
  it("is null for a v1 campaign or an unknown category", () => {
    expect(rulesFor(undefined, "X")).toBeNull();
    expect(rulesFor({}, "X")).toBeNull();
    expect(rulesFor(reserve, "NOPE")).toBeNull();
  });
  it("never puts a colon in a translation key", () => {
    expect(qualificationKey("FIELD:LAW")).not.toContain(":");
  });
});
