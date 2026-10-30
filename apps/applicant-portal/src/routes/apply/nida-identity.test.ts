import { describe, expect, it } from "vitest";
import type { MyIdentity } from "@usrp/api-client";
import { askedFor, districtLabel, nidaRows, sexKey } from "./nida-identity.js";

// Synthetic identity only.
const identity: MyIdentity = { fullName: "TEST Person", sex: "FEMALE", dateOfBirth: "2005-03-04", homeDistrict: "GASABO", homeProvince: "KIGALI_CITY", placeOfBirth: null, nationality: null };

describe("NIDA identity block", () => {
  it("shows what NIDA holds and asks for what the platform does not retain", () => {
    expect(nidaRows(identity).find((r) => r.key === "full_name")?.value).toBe("TEST Person");
    expect(askedFor(identity)).toEqual(["place_of_birth", "nationality"]);
    expect(askedFor({ ...identity, placeOfBirth: "Gasabo", nationality: "Rwandan" })).toEqual([]);
  });
  it("never carries a field the citizen should not see", () => {
    const keys = nidaRows(identity).map((r) => r.key);
    for (const forbidden of ["photo", "signature", "father", "mother", "national_id"]) expect(keys).not.toContain(forbidden);
  });
  it("renders codes as words", () => {
    expect(districtLabel("GASABO")).toBe("Gasabo");
    expect(districtLabel("NYARUGENGE_X")).toBe("Nyarugenge X");
    expect(sexKey("MALE")).toBe("male");
  });
});
