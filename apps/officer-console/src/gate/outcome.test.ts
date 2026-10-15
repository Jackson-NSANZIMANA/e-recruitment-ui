import { describe, expect, it } from "vitest";
import type { GateAdmissionResult } from "@usrp/api-client";
import { gateMessage, kigaliTime, normaliseNationalId, reportingTime } from "./outcome.js";

const CANDIDATE = { applicationId: "22222222-2222-4222-8222-222222222222", processingCode: "RDF-90001", category: "GENERAL_ENLISTMENT" };

describe("gate outcome messages", () => {
  it("only ADMITTED says let them in, in green", () => {
    const all: GateAdmissionResult[] = [
      { outcome: "ADMITTED", candidate: CANDIDATE, venueName: "V", examDate: "2026-12-01", reportingTimeHour: 8, admittedAt: "2026-12-01T06:01:00.000Z", statusAdvanced: true },
      { outcome: "ALREADY_ADMITTED", candidate: CANDIDATE, admittedAt: "2026-12-01T05:42:00.000Z", venueName: "V", admittedBySelf: false },
      { outcome: "IDENTITY_MISMATCH", candidate: CANDIDATE },
      { outcome: "NOT_ADMISSIBLE", candidate: CANDIDATE, currentStatus: "WITHDRAWN" },
      { outcome: "WRONG_VENUE", ticketVenueName: "Amahoro" },
      { outcome: "TOO_EARLY", examDate: "2026-12-02" },
      { outcome: "EXPIRED", examDate: "2026-11-30" },
      { outcome: "INVALID_TICKET", reason: "TICKET_NOT_ISSUED" },
    ];
    const admits = all.map((r) => gateMessage(r, " (by you)")).filter((m) => m.admit);
    expect(admits).toHaveLength(1);
    expect(admits[0]?.appearance).toBe("success");
    expect(all.slice(1).every((r) => gateMessage(r, "").appearance !== "success")).toBe(true);
  });

  it("a spent QR names where and when, in Kigali time, and whether it was this officer", () => {
    const m = gateMessage({ outcome: "ALREADY_ADMITTED", candidate: CANDIDATE, admittedAt: "2026-12-01T05:42:00.000Z", venueName: "ULK", admittedBySelf: true }, " (by you)");
    expect(m.values).toEqual({ venue: "ULK", time: "07:42", by: " (by you)" });
  });

  it("an invalid ticket explains the specific reason", () => {
    expect(gateMessage({ outcome: "INVALID_TICKET", reason: "WRONG_AGENCY" }, "").bodyKey).toBe("gate.invalid_reasons.WRONG_AGENCY");
  });

  it("formats and validates what the officer types", () => {
    expect(reportingTime(8)).toBe("08:00");
    expect(kigaliTime("2026-12-01T22:30:00.000Z")).toBe("00:30");
    expect(normaliseNationalId("1199 8800 1234 5678")).toBe("1199880012345678");
    expect(normaliseNationalId("12345")).toBeNull();
  });
});
