import { test } from "node:test";
import assert from "node:assert/strict";
import { actionsToShow, blockedByPost, evidenceSummary, filtersActive, EMPTY_FILTERS, lockedBy, searchQueryOf } from "./workspace.ts";

test("an action shows only when the state allows it AND the post permits it", () => {
  assert.deepEqual(actionsToShow("PHYSICAL_TEST_COMPLETE", ["medical.review"]), ["MEDICAL"]);
  assert.deepEqual(actionsToShow("PHYSICAL_TEST_COMPLETE", ["decision.final"]), []);
  assert.deepEqual(actionsToShow("MEDICAL_REVIEW", ["decision.final", "application.accept"]), ["FINAL"]);
  assert.deepEqual(actionsToShow("FINAL_SHORTLIST", ["application.accept"]), ["ACCEPT"]);
  assert.deepEqual(actionsToShow("DOCUMENT_REVIEW_AMBER", ["adjudication.decide"]), ["ADJUDICATE"]);
  assert.deepEqual(actionsToShow("ACCEPTED", ["medical.review", "decision.final", "application.accept", "adjudication.decide"]), []);
});

test("a reviewer sees the state allows an action but their post does not", () => {
  assert.deepEqual(blockedByPost("MEDICAL_REVIEW", ["application.read"]), ["FINAL"]);
  assert.deepEqual(blockedByPost("MEDICAL_REVIEW", ["decision.final"]), []);
});

test("the search query drops empty filters and carries the preset statuses and the cursor", () => {
  assert.deepEqual(searchQueryOf(EMPTY_FILTERS), { limit: 50 });
  const q = searchQueryOf({ preset: "final", category: "", campaign: "REH-RDF-1", district: "GASABO" }, "abc");
  assert.deepEqual(q.status, ["MEDICAL_REVIEW", "FINAL_SHORTLIST"]);
  assert.equal(q.campaign, "REH-RDF-1");
  assert.equal(q.cursor, "abc");
  assert.equal(filtersActive(EMPTY_FILTERS), false);
  assert.equal(filtersActive({ ...EMPTY_FILTERS, district: "X" }), true);
});

test("the cross-agency lock names the holder only when the body does", () => {
  assert.equal(lockedBy({ lockedByAgency: "RNP" }), "RNP");
  assert.equal(lockedBy({}), null);
  assert.equal(lockedBy({ lockedByAgency: 5 }), null);
});

test("biometric evidence is advisory text: scores as percentages, no verdict words", () => {
  const s = evidenceSummary({ outcome: "NO_MATCH", livenessScoreBp: 9100, matchScoreBp: null });
  assert.equal(s.liveness, "91.0%");
  assert.equal(s.match, "—");
  assert.equal(s.outcomeKey, "applications.biometric.outcome.NO_MATCH");
});
