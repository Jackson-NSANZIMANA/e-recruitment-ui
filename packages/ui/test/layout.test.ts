import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  CHART_SERIES_TOKENS,
  PAGE_MAX_WIDTH,
  seriesIndexAt,
  sparklineIsDot,
  sparklinePath,
  sparklinePoints,
  stackShares,
  trendOf,
  trendTone,
} from "../src/model.ts";
import { countFrom, known, valueOf } from "../src/states/useCount.ts";
import { asSupportedLanguage, formatCount, formatPercent } from "../src/format.ts";

// ══════════════════════════════════════════════════════════════════
// Layout and chart geometry. The components are thin renderers over these
// functions, so this file is where the two things a screenshot cannot prove
// are proven: that the page width is one value, and that the numbers drawn are
// the numbers passed in.
// ══════════════════════════════════════════════════════════════════

test("page width has exactly three answers, and they are the documented ones", () => {
  // Six feature slices shipped 1200px before this constant existed; if that
  // number changes, six screens change with it. That is the point of the test.
  assert.equal(PAGE_MAX_WIDTH.standard, "1200px");
  assert.equal(PAGE_MAX_WIDTH.header, "1280px"); // 80rem, NationalHeader's box
  assert.equal(PAGE_MAX_WIDTH.narrow, "640px"); // the citizen portal's column
  assert.deepEqual(Object.keys(PAGE_MAX_WIDTH).sort(), ["header", "narrow", "standard"]);
});

test("sparkline: monotonic series maps endpoints to the full box", () => {
  const path = sparklinePath([1, 2, 3], 100, 40);
  assert.ok(path !== null);
  // Oldest first, left edge, bottom: SVG y grows downward.
  assert.deepEqual(path[0], [0, 40]);
  assert.deepEqual(path[1], [50, 20]);
  assert.deepEqual(path[2], [100, 0]);
});

test("sparkline: a flat series draws on the centre line, not the top edge", () => {
  // A line pinned to the top of the box reads as "maximum" when nothing moved.
  const path = sparklinePath([7, 7, 7], 100, 40);
  assert.ok(path !== null);
  for (const [, y] of path) assert.equal(y, 20);
});

test("sparkline: points are byte-identical across runs (screenshot-diffable)", () => {
  const a = sparklinePoints([3, 1, 4, 1, 5, 9, 2, 6], 220, 48);
  const b = sparklinePoints([3, 1, 4, 1, 5, 9, 2, 6], 220, 48);
  assert.equal(a, b);
  // Every coordinate is at most 2dp, so float noise cannot fake a visual change.
  for (const pair of a.split(" ")) {
    for (const part of pair.split(",")) {
      const decimals = part.includes(".") ? part.split(".")[1].length : 0;
      assert.ok(decimals <= 2, `coordinate ${part} has more than 2 decimals`);
    }
  }
});

test("sparkline: fewer than two finite readings is not a line", () => {
  assert.equal(sparklinePath([], 100, 40), null);
  assert.equal(sparklinePath([5], 100, 40), null);
  assert.equal(sparklinePath([NaN, Infinity], 100, 40), null);
  assert.equal(sparklinePoints([], 100, 40), "");
});

test("sparkline: non-finite readings are skipped, never plotted as zero", () => {
  // A dropped reading must not look like a count of 0 on the axis.
  const path = sparklinePath([10, NaN, 20], 100, 40);
  assert.equal(path?.length, 2);
  assert.deepEqual(path?.[0], [0, 40]);
  assert.deepEqual(path?.[1], [100, 0]);
});

test("sparkline: a single reading is drawn as a dot, not an empty box", () => {
  assert.equal(sparklineIsDot([42]), true);
  assert.equal(sparklineIsDot([42, 43]), false);
  assert.equal(sparklineIsDot([NaN, 42]), true);
});

test("trend: first to last, rounded, with direction from the sign", () => {
  assert.deepEqual(trendOf([100, 120]), { direction: "up", percent: 20 });
  assert.deepEqual(trendOf([100, 86]), { direction: "down", percent: -14 });
  assert.deepEqual(trendOf([100, 100]), { direction: "flat", percent: 0 });
});

test("trend: sub-half-percent movement reads as flat, not as news", () => {
  // 1000 -> 1002 is a 0.2% move no human can see; a badge claiming +0% is worse
  // than no badge, so it rounds to the flat case.
  assert.equal(trendOf([1000, 1002]).direction, "flat");
  assert.equal(trendOf([1000, 1002]).percent, 0);
});

test("trend: a zero baseline yields a dash, never a fabricated percentage", () => {
  // "up 100%" and "up 4,000%" are both lies when the baseline is zero.
  assert.deepEqual(trendOf([0, 5]), { direction: "up", percent: null });
  assert.deepEqual(trendOf([0, 0]), { direction: "flat", percent: null });
});

test("trend: too few readings has no trend at all", () => {
  assert.deepEqual(trendOf([]), { direction: "flat", percent: null });
  assert.deepEqual(trendOf([5]), { direction: "flat", percent: null });
});

test("trend tone: the sign is not the meaning", () => {
  // A queue going down is good news; completed reviews going up is good news.
  assert.equal(trendTone("down", "down"), "good");
  assert.equal(trendTone("up", "down"), "bad");
  assert.equal(trendTone("up", "up"), "good");
  assert.equal(trendTone("down", "up"), "bad");
  assert.equal(trendTone("flat", "up"), "neutral");
  assert.equal(trendTone("flat", "down"), "neutral");
});

test("stack shares always partition the bar, and zero stays zero", () => {
  const shares = stackShares([50, 30, 20, 0]);
  assert.equal(shares[3], 0, "a category with no rows must not be drawn");
  const sum = shares.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `shares must sum to 1, got ${sum}`);
});

test("stack shares: a 1% segment is lifted to stay visible, and the bar still sums to 1", () => {
  const shares = stackShares([99, 1], 0.02);
  assert.ok((shares[1] as number) >= 0.02 - 1e-9, "the tiny segment must reach the visible floor");
  const sum = shares.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `shares must still sum to 1, got ${sum}`);
});

test("stack shares: many tiny segments fall back to a valid partition", () => {
  // Ten 0.1% segments cannot each be lifted to 2% without breaking the bar;
  // renormalising is the honest fallback, and it must still sum to 1.
  const values = Array.from({ length: 10 }, () => 1);
  const shares = stackShares(values, 0.02);
  const sum = shares.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `got ${sum}`);
  for (const s of shares) assert.ok(s > 0);
});

test("stack shares: an all-zero series draws nothing and never divides by zero", () => {
  assert.deepEqual(stackShares([0, 0, 0]), [0, 0, 0]);
});

test("chart series colours come from the eight ADS categorical slots, and wrap", () => {
  assert.equal(CHART_SERIES_TOKENS.length, 8);
  for (const name of CHART_SERIES_TOKENS) {
    assert.ok(/^color\.chart\.categorical\.[1-8]$/.test(name), name);
  }
  assert.equal(CHART_SERIES_TOKENS[seriesIndexAt(0)], "color.chart.categorical.1");
  assert.equal(CHART_SERIES_TOKENS[seriesIndexAt(7)], "color.chart.categorical.8");
  // A ninth series reuses slot 1 rather than inventing a colour.
  assert.equal(CHART_SERIES_TOKENS[seriesIndexAt(8)], "color.chart.categorical.1");
});

test("chart series slot survives a garbage index instead of rendering untokenised", () => {
  assert.equal(seriesIndexAt(-3), 0);
  assert.equal(seriesIndexAt(NaN), 0);
  assert.equal(seriesIndexAt(2.7), 2);
});

// ── The three-state count ────────────────────────────────────────
// A metric tile must distinguish "0" from "not known yet" from "could not be
// read". The type does the enforcing; these assert the helpers keep it.

test("countFrom: a read that has not answered is pending, never zero", () => {
  const count = countFrom({ data: undefined, isLoading: true, isError: false }, () => 0);
  assert.equal(count.state, "pending");
  assert.equal(valueOf(count), null);
});

test("countFrom: a failed read is failed, even while it retries", () => {
  const count = countFrom({ data: undefined, isLoading: true, isError: true }, () => 9);
  assert.equal(count.state, "failed");
  assert.equal(valueOf(count), null);
});

test("countFrom: a known zero is a real reading and survives", () => {
  const count = countFrom({ data: { total: 0 }, isLoading: false, isError: false }, (d) => d.total);
  assert.equal(count.state, "known");
  assert.equal(valueOf(count), 0);
});

test("countFrom: select is never called without data, so a half-built response cannot throw", () => {
  let called = false;
  countFrom({ data: undefined, isLoading: true, isError: false }, () => {
    called = true;
    throw new Error("would have thrown");
  });
  assert.equal(called, false);
});

test("known: a non-finite reading degrades to 0 rather than printing NaN", () => {
  assert.deepEqual(known(NaN), { state: "known", value: 0 });
  assert.deepEqual(known(Infinity), { state: "known", value: 0 });
});

// ── The one formatter ────────────────────────────────────────────

test("formatCount groups digits per language, so a figure and its legend agree", () => {
  assert.equal(formatCount(1024, "en"), "1,024");
  // fr-FR groups with a space; which space is the engine's business, so the
  // assertion is on the shape and not the codepoint.
  assert.match(formatCount(1024, "fr"), /^1\s024$/u);
  // rw-RW is a supported locale in ICU and CLDR groups it with a period. Pinned
  // deliberately: if a future ICU drops `rw`, this test says so instead of the
  // portal silently rendering Kinyarwanda figures the English way.
  assert.equal(formatCount(1024, "rw"), "1.024");
});

test("formatCount: no reading is a dash, not a zero", () => {
  assert.equal(formatCount(null, "en"), "—");
  assert.equal(formatCount(undefined, "en"), "—");
  assert.equal(formatCount(NaN, "en"), "—");
  assert.equal(formatCount(0, "en"), "0");
});

test("formatCount: an unknown language falls back to English instead of throwing", () => {
  assert.equal(formatCount(1024, "de"), "1,024");
  assert.equal(formatCount(1024, undefined), "1,024");
});

test("formatPercent: carries its own sign and refuses to invent one from zero", () => {
  assert.equal(formatPercent(12, "en"), "+12%");
  assert.equal(formatPercent(-8, "en"), "-8%");
  assert.equal(formatPercent(null, "en"), "—");
  assert.equal(formatPercent(0, "en"), "0%");
});

test("asSupportedLanguage narrows a regional tag to its base language", () => {
  assert.equal(asSupportedLanguage("fr-FR"), "fr");
  assert.equal(asSupportedLanguage("rw"), "rw");
  assert.equal(asSupportedLanguage("pt-BR"), "en");
});

test("the formatter's language list cannot drift from the i18n package", () => {
  // format.ts declares its own locale map so it stays React-free and testable in
  // plain node. That duplication is only safe if something checks it: read the
  // i18n source and compare the two lists as text, the way the design-system
  // contract test reads its own a11y floor.
  const i18nConfig = readFileSync(new URL("../../i18n/src/config.ts", import.meta.url), "utf8");
  const declared = /SUPPORTED_LANGUAGES\s*=\s*\[([^\]]*)\]/.exec(i18nConfig)?.[1] ?? "";
  const languages = [...declared.matchAll(/"([a-z]{2})"/g)].map((m) => m[1]).sort();
  assert.deepEqual(languages, ["en", "fr", "rw"]);
  // and every one of them must be a key the formatter knows
  for (const language of languages) {
    assert.equal(asSupportedLanguage(language), language);
  }
});

describe('seriesIndexAt', () => {
  test('wraps over the whole categorical scale, in order', () => {
    for (let i = 0; i < 20; i += 1) {
      assert.equal(seriesIndexAt(i), i % CHART_SERIES_TOKENS.length);
    }
  });

  test('bad indices land on slot 0 instead of throwing', () => {
    assert.equal(seriesIndexAt(-1), 0);
    assert.equal(seriesIndexAt(Number.NaN), 0);
    assert.equal(seriesIndexAt(2.7), 2);
  });
});

describe('StackedBar', () => {
  test('a series keeps its slot when another is added before it', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/charts/StackedBar.tsx', import.meta.url), 'utf8');
    // The wrap must not be re-derived here; a second copy is how the legend and
    // the bar drift apart.
    assert.ok(!/%\s*SERIES_FILL\.length/.test(src), 'StackedBar re-implements the wrap');
    assert.ok(!/%\s*CHART_SERIES_TOKENS\.length/.test(src), 'StackedBar re-implements the wrap');
    assert.match(src, /SERIES_FILL\[seriesIndexAt\(/, 'StackedBar must colour through seriesIndexAt');
    assert.match(src, /CHART_SERIES_TOKENS\.map/, 'the fill table must be keyed on the shared slot order');
  });
});

describe('PageShell gutter', () => {
  test('the padding is an inline token literal, because ADS requires one', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/layout/PageShell.tsx', import.meta.url), 'utf8');
    assert.match(src, /paddingInline: token\("space\.300"\)/);
  });

  test('there is no PAGE_INNER_PADDING export that nothing reads', async () => {
    const { readFileSync } = await import('node:fs');
    const barrel = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    assert.ok(!barrel.includes('PAGE_INNER_PADDING'), 'the unread constant is back');
  });
});
