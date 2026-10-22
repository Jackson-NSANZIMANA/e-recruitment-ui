import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOf, freshnessOf, listState, maskValue, sortTimeline, stateFromHttpStatus, UI_STATE_KINDS } from "../src/states/model.ts";

const NOW = new Date("2026-10-22T12:00:00Z");

test("http status maps to the failure state; unknown and network are upstream-failure", () => {
  assert.equal(stateFromHttpStatus(403), "forbidden");
  assert.equal(stateFromHttpStatus(404), "not-found");
  assert.equal(stateFromHttpStatus(409), "conflict");
  for (const s of [0, 500, 502, 503, 504, 418]) assert.equal(stateFromHttpStatus(s), "upstream-failure");
});

test("listState is total: errors beat data, empty depends on filters, partial beats stale", () => {
  const base = { isLoading: false, errorStatus: null, rowCount: 3, filtersActive: false };
  assert.equal(listState({ ...base, isLoading: true }), "loading");
  assert.equal(listState({ ...base, errorStatus: 403 }), "forbidden");
  assert.equal(listState({ ...base, rowCount: 0 }), "empty");
  assert.equal(listState({ ...base, rowCount: 0, filtersActive: true }), "filtered-empty");
  assert.equal(listState({ ...base, isPartial: true, isStale: true }), "partial");
  assert.equal(listState({ ...base, isStale: true }), "stale");
  assert.equal(listState(base), "ready");
  assert.ok(UI_STATE_KINDS.includes(listState(base)));
});

test("age buckets and units; future and garbage are age 0", () => {
  assert.deepEqual(ageOf("2026-10-22T11:30:00Z", NOW), { minutes: 30, bucket: "fresh", unit: "minute", value: 30 });
  assert.deepEqual(ageOf("2026-10-22T09:00:00Z", NOW), { minutes: 180, bucket: "fresh", unit: "hour", value: 3 });
  assert.equal(ageOf("2026-10-21T11:00:00Z", NOW).bucket, "aging");
  assert.deepEqual(ageOf("2026-10-18T12:00:00Z", NOW), { minutes: 5760, bucket: "overdue", unit: "day", value: 4 });
  assert.equal(ageOf("2027-01-01T00:00:00Z", NOW).minutes, 0);
  assert.equal(ageOf("not a date", NOW).minutes, 0);
});

test("freshness: stale at the threshold", () => {
  assert.equal(freshnessOf("2026-10-22T11:56:00Z", NOW).stale, false);
  assert.equal(freshnessOf("2026-10-22T11:55:00Z", NOW).stale, true);
});

test("masking never reveals short values and keeps only the tail of long ones", () => {
  assert.equal(maskValue("1199"), "••••");
  assert.equal(maskValue("1199880012345678"), "•••••••••••••678");
  assert.equal(maskValue(""), "");
  assert.equal(maskValue("+250788123456").endsWith("456"), true);
});

test("timeline: newest first, garbage last, stable", () => {
  const out = sortTimeline([{ at: "2026-10-01T00:00:00Z", id: "a" }, { at: "x", id: "b" }, { at: "2026-10-03T00:00:00Z", id: "c" }, { at: "2026-10-03T00:00:00Z", id: "d" }]);
  assert.deepEqual(out.map((e) => e.id), ["c", "d", "a", "b"]);
});
