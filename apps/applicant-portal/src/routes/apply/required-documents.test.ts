import { describe, expect, it } from "vitest";
import type { DocumentChecklist } from "@usrp/api-client";
import { selectedType, uploadChoices } from "./required-documents.js";

const AGENCY = ["NATIONAL_ID", "OLEVEL_CERTIFICATE", "NON_CONVICTION_CERTIFICATE", "GOOD_CONDUCT_CERTIFICATE", "BIRTH_CERTIFICATE"];
const ok = { isLoading: false, isError: false };

function checklist(items: DocumentChecklist["items"]): DocumentChecklist {
  return { source: "POLICY_VERSION", complete: false, items } as unknown as DocumentChecklist;
}

describe("uploadChoices: the campaign's list, never the agency catalogue", () => {
  it("offers only what the campaign requires", () => {
    const c = uploadChoices(checklist([
      { documentType: "GOOD_CONDUCT_CERTIFICATE", satisfaction: "MISSING", registry: null },
    ]), ok, AGENCY);
    expect(c.kind).toBe("POLICY");
    expect(c.kind === "POLICY" ? c.types : []).toEqual(["GOOD_CONDUCT_CERTIFICATE"]);
  });

  it("drops what a registry, a cleared upload or the venue already satisfied", () => {
    const c = uploadChoices(checklist([
      { documentType: "NATIONAL_ID", satisfaction: "API_VERIFIED", registry: "NIDA" },
      { documentType: "BIRTH_CERTIFICATE", satisfaction: "VENUE_VERIFIED", registry: null },
      { documentType: "GOOD_CONDUCT_CERTIFICATE", satisfaction: "REJECTED", registry: null },
    ]), ok, AGENCY);
    expect(c.kind === "POLICY" ? c.types : []).toEqual(["GOOD_CONDUCT_CERTIFICATE"]);
  });

  it("routes the criminal-clearance item to the Irembo number, not to an upload", () => {
    const clearanceItem = { documentType: "NON_CONVICTION_CERTIFICATE", satisfaction: "MISSING", registry: "RIB", clearance: { state: "NUMBER_REQUIRED", code: null, reasons: [] } };
    const c = uploadChoices(checklist([clearanceItem] as unknown as DocumentChecklist["items"]), ok, AGENCY);
    expect(c.kind === "POLICY" ? c.types : ["x"]).toEqual([]);
    expect(c.kind === "POLICY" ? c.clearance?.documentType : null).toBe("NON_CONVICTION_CERTIFICATE");
  });

  it("still offers an upload for the criminal item when the Irembo flow is off", () => {
    const c = uploadChoices(checklist([{ documentType: "NON_CONVICTION_CERTIFICATE", satisfaction: "MISSING", registry: "RIB" }]), ok, AGENCY);
    expect(c.kind === "POLICY" ? c.types : []).toEqual(["NON_CONVICTION_CERTIFICATE"]);
    expect(c.kind === "POLICY" ? c.clearance : "x").toBeNull();
  });

  it("an empty policy list is respected: nothing to upload", () => {
    const c = uploadChoices(checklist([]), ok, AGENCY);
    expect(c).toEqual({ kind: "POLICY", required: [], types: [], clearance: null });
  });

  it("waits while loading, and falls back to the agency catalogue only when unreadable", () => {
    expect(uploadChoices(undefined, { isLoading: true, isError: false }, AGENCY)).toEqual({ kind: "LOADING" });
    expect(uploadChoices(undefined, { isLoading: false, isError: true }, AGENCY)).toEqual({ kind: "FALLBACK", types: AGENCY });
    expect(uploadChoices(null as unknown as DocumentChecklist, ok, AGENCY)).toEqual({ kind: "FALLBACK", types: AGENCY });
    expect(uploadChoices({} as DocumentChecklist, ok, AGENCY)).toEqual({ kind: "FALLBACK", types: AGENCY });
  });
});

describe("selectedType", () => {
  it("keeps a valid pick and repairs a stale one", () => {
    expect(selectedType("B", ["A", "B"])).toBe("B");
    expect(selectedType("Z", ["A", "B"])).toBe("A");
    expect(selectedType(null, [])).toBeNull();
  });
});
