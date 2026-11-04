import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { barFill, heatLevel, nearestIndex, niceCeiling, percentChange, shareOf, trendPoints } from "../src/model.ts";
import { formatShare } from "../src/format.ts";

describe("barFill", () => {
  test("a bar is value over max, clamped to its track", () => {
    assert.equal(barFill(50, 100), 0.5);
    assert.equal(barFill(150, 100), 1);
  });
  test("zero, negative and unusable readings draw nothing, never NaN", () => {
    for (const v of [0, -3, Number.NaN, Number.POSITIVE_INFINITY * 0]) assert.equal(barFill(v, 100), 0);
    assert.equal(barFill(5, 0), 0);
    assert.equal(barFill(5, Number.NaN), 0);
  });
  test("a real reading is never thinner than a visible sliver", () => {
    assert.equal(barFill(1, 1_000_000), 0.015);
  });
});

describe("shareOf", () => {
  test("is a fraction of the whole and refuses a zero whole", () => {
    assert.equal(shareOf(1, 4), 0.25);
    assert.equal(shareOf(0, 0), null);
    assert.equal(shareOf(3, -1), null);
  });
  test("never leaves 0..1", () => {
    assert.equal(shareOf(9, 3), 1);
    assert.equal(shareOf(-1, 3), 0);
  });
});

describe("niceCeiling", () => {
  test("is the smallest of 4, 8, 12, 20, 40... that holds the maximum", () => {
    assert.deepEqual([0, 3, 4, 5, 8, 9, 12, 13, 20, 21, 41].map(niceCeiling), [4, 4, 4, 8, 8, 12, 12, 20, 20, 40, 80]);
  });
  test("an empty or unusable series still gets a real scale", () => {
    assert.equal(niceCeiling(Number.NaN), 4);
    assert.equal(niceCeiling(-5), 4);
  });
  test("every ceiling halves to a whole number, so a count axis never reads 2.5", () => {
    for (const v of [1, 7, 15, 33, 99, 450, 12_345]) assert.equal(Number.isInteger(niceCeiling(v) / 2), true);
  });
});

describe("trendPoints", () => {
  const box = { width: 300, height: 100, padX: 20, padTop: 10, padBottom: 10 };
  test("spreads x evenly inside the padding and puts larger values higher up", () => {
    const pts = trendPoints([0, 4, 8], box, 8);
    assert.deepEqual(pts.map((p) => p.x), [20, 150, 280]);
    assert.deepEqual(pts.map((p) => p.y), [90, 50, 10]);
  });
  test("a single reading sits in the middle", () => {
    assert.equal(trendPoints([3], box, 4)[0]?.x, 150);
  });
  test("an unusable reading is drawn at the baseline, not off the chart", () => {
    assert.equal(trendPoints([Number.NaN], box, 4)[0]?.y, 90);
    assert.equal(trendPoints([99], box, 4)[0]?.y, 10);
  });
});

describe("nearestIndex", () => {
  const pts = trendPoints([1, 2, 3], { width: 300, height: 100, padX: 0, padTop: 0, padBottom: 0 }, 4);
  test("finds the closest point to the pointer", () => {
    assert.equal(nearestIndex(pts, 10), 0);
    assert.equal(nearestIndex(pts, 140), 1);
    assert.equal(nearestIndex(pts, 400), 2);
  });
  test("is null for an empty series", () => assert.equal(nearestIndex([], 5), null));
});

test("formatShare prints an unsigned whole percentage, and a dash with no whole", () => {
  assert.match(formatShare(0.5, "en"), /^50\s?%$/);
  assert.equal(formatShare(null, "en"), "—");
});

describe("heatLevel", () => {
  test("none is level 0 and any positive value is at least level 1", () => {
    assert.equal(heatLevel(0, 10), 0);
    assert.equal(heatLevel(1, 1000), 1);
  });
  test("splits the range into four equal bands, the maximum being the top band", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => heatLevel(v, 10)), [1, 1, 2, 2, 2, 3, 3, 4, 4, 4]);
  });
  test("an unusable value or maximum is level 0, and a value above the maximum is capped", () => {
    assert.equal(heatLevel(Number.NaN, 10), 0);
    assert.equal(heatLevel(5, 0), 0);
    assert.equal(heatLevel(99, 10), 4);
  });
});

describe("percentChange", () => {
  test("is the signed whole-percent change from the previous period", () => {
    assert.equal(percentChange(112, 100), 12);
    assert.equal(percentChange(50, 100), -50);
    assert.equal(percentChange(100, 100), 0);
  });
  test("has no honest answer without a baseline, so it is null, never Infinity or 100%", () => {
    assert.equal(percentChange(5, 0), null);
    assert.equal(percentChange(5, null), null);
    assert.equal(percentChange(null, 5), null);
    assert.equal(percentChange(Number.NaN, 5), null);
  });
});
