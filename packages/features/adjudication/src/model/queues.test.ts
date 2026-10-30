import { expect, test } from "vitest";
import { rowTransitions, runBulk, visibleQueues } from "./queues.js";

test("a row offers only what the status allows and the post permits", () => {
  expect(rowTransitions("amber", "DOCUMENT_REVIEW_AMBER", ["adjudication.decide"])).toEqual(["clear", "reject", "open"]);
  expect(rowTransitions("holds", "ADJUDICATION_REVIEW", ["adjudication.decide"])).toEqual(["clear", "reject", "open"]);
  expect(rowTransitions("amber", "DOCUMENT_REVIEW_AMBER", ["adjudication.read"])).toEqual(["open"]);
  expect(rowTransitions("medical", "PHYSICAL_TEST_COMPLETE", ["medical.review"])).toEqual(["verdict", "open"]);
  expect(rowTransitions("final", "MEDICAL_REVIEW", ["decision.final", "application.accept"])).toEqual(["shortlist", "reject", "open"]);
  expect(rowTransitions("final", "FINAL_SHORTLIST", ["decision.final", "application.accept"])).toEqual(["accept", "open"]);
  expect(rowTransitions("final", "FINAL_SHORTLIST", ["decision.final"])).toEqual(["open"]);
});

test("D10: a registry hold offers no decision, even to an officer who may decide", () => {
  // The adjudicate transaction accepts only the two holds. A criminal-clearance
  // or NESA-review row used to be offered Clear and Reject anyway; the only
  // possible outcome was a refusal that changed nothing.
  expect(rowTransitions("holds", "CRIMINAL_CLEARANCE", ["adjudication.decide"])).toEqual(["open"]);
  expect(rowTransitions("holds", "ACADEMIC_VETTING", ["adjudication.decide", "application.accept"])).toEqual(["open"]);
  // An unknown or absent status is not actionable either: "we do not know" is not
  // a licence to offer a decision.
  expect(rowTransitions("holds", "SOMETHING_NEW", ["adjudication.decide"])).toEqual(["open"]);
  expect(rowTransitions("holds", "", ["adjudication.decide"])).toEqual(["open"]);
});

test("a dpo or a non-reader sees no queue tabs", () => {
  expect(visibleQueues(["erasure.queue.read", "erasure.decide"])).toEqual([]);
  expect(visibleQueues(["adjudication.read"]).length).toBe(4);
});

test("bulk runs in order, one row at a time, reports each row, never retries, and survives a failure", async () => {
  const order: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const seen: string[] = [];
  const results = await runBulk(
    ["a", "b", "c"],
    async (id) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      order.push(id);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      if (id === "b") throw new Error("boom");
      return { ok: id !== "c", code: id === "c" ? "CROSS_AGENCY_LOCKED" : "APPLIED" };
    },
    (r) => seen.push(r.id),
  );
  expect(order).toEqual(["a", "b", "c"]);
  expect(maxInFlight).toBe(1);
  expect(results).toEqual([
    { id: "a", ok: true, code: "APPLIED" },
    { id: "b", ok: false, code: "ERROR" },
    { id: "c", ok: false, code: "CROSS_AGENCY_LOCKED" },
  ]);
  expect(seen).toEqual(["a", "b", "c"]);
});
