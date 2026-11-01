import { describe, expect, it } from "vitest";
import type { DocumentChecklist } from "@usrp/api-client";
import { clearanceCopyKey, clearanceItem, isClearanceNumberShape, isInFlight, normaliseClearanceNumber, satisfactionCopyKey, wantsNumber } from "./model.js";

const list = (clearance: NonNullable<DocumentChecklist["items"][number]["clearance"]>): DocumentChecklist => ({
  agency: "RDF", source: "POLICY_VERSION", complete: false,
  items: [{ documentType: "NON_CONVICTION_CERTIFICATE", satisfaction: "AWAITING_REGISTRY", registry: "RIB", clearance }],
});

describe("clearance number", () => {
  it("accepts a letter, 12 digits and 4 letters, ignoring spaces, hyphens and case", () => {
    expect(isClearanceNumberShape("A000000000000ABCD")).toBe(true);
    expect(isClearanceNumberShape(" a 000000000000-abcd ")).toBe(true);
    expect(normaliseClearanceNumber(" a 000000000000-abcd ")).toBe("A000000000000ABCD");
  });
  it("refuses the wrong shape before anything is sent", () => {
    for (const bad of ["", "A00000000000ABCD", "000000000000ABCD", "A000000000000AB", "not a number"]) expect(isClearanceNumberShape(bad)).toBe(false);
  });
});

describe("clearance states", () => {
  it("shows the number field only when a number is wanted or must be corrected", () => {
    expect(wantsNumber("NUMBER_REQUIRED")).toBe(true);
    expect(wantsNumber("CORRECTION_NEEDED")).toBe(true);
    for (const s of ["VERIFYING", "UNDER_OFFICER_REVIEW", "VERIFIED"] as const) expect(wantsNumber(s)).toBe(false);
  });
  it("names the correction for a known code and falls back for an unknown one", () => {
    expect(clearanceCopyKey({ state: "CORRECTION_NEEDED", code: "CERTIFICATE_NOT_BOUND" })).toBe("citizen_docs.clearance.code.CERTIFICATE_NOT_BOUND");
    expect(clearanceCopyKey({ state: "CORRECTION_NEEDED", code: "SOMETHING_NEW" })).toBe("citizen_docs.clearance.code.DEFAULT");
    expect(clearanceCopyKey({ state: "UNDER_OFFICER_REVIEW", code: null })).toBe("citizen_docs.clearance.state.UNDER_OFFICER_REVIEW");
  });
  it("polls only while the registry is answering", () => {
    expect(isInFlight(list({ state: "VERIFYING", code: null }))).toBe(true);
    expect(isInFlight(list({ state: "VERIFIED", code: null }))).toBe(false);
    expect(isInFlight(undefined)).toBe(false);
    expect(clearanceItem(list({ state: "VERIFIED", code: null }))?.documentType).toBe("NON_CONVICTION_CERTIFICATE");
  });
  it("gives NESA awaiting its own words", () => {
    expect(satisfactionCopyKey({ documentType: "ALEVEL_CERTIFICATE", satisfaction: "AWAITING_REGISTRY", registry: "NESA" })).toBe("citizen_docs.sat.AWAITING_NESA");
    expect(satisfactionCopyKey({ documentType: "NATIONAL_ID", satisfaction: "API_VERIFIED", registry: "NIDA" })).toBe("citizen_docs.sat.API_VERIFIED");
  });
});
