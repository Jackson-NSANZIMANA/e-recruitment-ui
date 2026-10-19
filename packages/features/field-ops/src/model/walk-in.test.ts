import { describe, expect, it } from "vitest";
import { ApiError, normaliseErrorBody } from "@usrp/api-client";
import { academicInput, academicPathOf, walkInCategories, walkInRefusal } from "./walk-in.ts";

/** An ApiError exactly as the transport builds it from a wire response. */
const wire = (status: number, body: unknown): ApiError => new ApiError(normaliseErrorBody(status, body), `HTTP ${String(status)}`);

describe("walk-in categories", () => {
  it("offers only the officer's own agency's categories", () => {
    expect(walkInCategories("RDF")).toEqual([
      "GENERAL_ENLISTMENT",
      "RESERVE_FORCE_ALEVEL",
      "RESERVE_FORCE_UNIVERSITY",
      "RESERVE_FORCE_SPECIALIST",
    ]);
    expect(walkInCategories("RNP")).not.toContain("GENERAL_ENLISTMENT");
  });

  it("names the registry reference each category needs", () => {
    expect(academicPathOf("GENERAL_ENLISTMENT")).toBe("NESA");
    expect(academicPathOf("RESERVE_FORCE_UNIVERSITY")).toBe("HEC");
    expect(academicInput("GENERAL_ENLISTMENT", " RW2024/1001 ")).toEqual({ nesaIndexNumber: "RW2024/1001" });
    expect(academicInput("RESERVE_FORCE_SPECIALIST", "HEC-1")).toEqual({ hecRegistrationNumber: "HEC-1" });
  });
});

describe("walk-in refusals", () => {
  it("names the academic refusal exactly as the live edge sends it", () => {
    const e = wire(422, { error: "INVALID_ACADEMIC_INPUT", detail: 'Category "GENERAL_ENLISTMENT" requires a NESA index number.' });
    expect(walkInRefusal(e, "NESA")).toEqual({
      code: "INVALID_ACADEMIC_INPUT",
      key: "walk_in.refusals.INVALID_ACADEMIC_INPUT",
      values: { registry: "NESA" },
    });
  });

  it("names the missing campaign, and points a duplicate at its existing application", () => {
    expect(walkInRefusal(wire(409, { error: "NO_WALK_IN_CAMPAIGN" }), "NESA")?.code).toBe("NO_WALK_IN_CAMPAIGN");
    const dup = walkInRefusal(wire(409, { status: "ALREADY_APPLIED", applicationId: "a", processingCode: "RDF-W-7" }), "NESA");
    expect(dup?.values).toEqual({ registry: "NESA", processingCode: "RDF-W-7" });
  });

  it("maps the bodiless statuses to the backend's documented meaning", () => {
    expect(walkInRefusal(wire(404, {}), "NESA")?.code).toBe("APPLICANT_NOT_FOUND");
    expect(walkInRefusal(wire(403, { error: "FORBIDDEN" }), "NESA")?.code).toBe("FORBIDDEN");
    expect(walkInRefusal(wire(501, { status: "UNSUPPORTED_AGENCY", agency: "RNP" }), "NESA")?.code).toBe("UNSUPPORTED_AGENCY");
  });

  it("leaves infrastructure faults and unknown outcomes to the generic message", () => {
    expect(walkInRefusal(wire(500, { error: "INTERNAL" }), "NESA")).toBeNull();
    expect(walkInRefusal(wire(409, { status: "SOMETHING_NEW" }), "NESA")).toBeNull();
    expect(walkInRefusal(new Error("network"), "NESA")).toBeNull();
  });
});
