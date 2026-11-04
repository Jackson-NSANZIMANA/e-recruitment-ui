// ══════════════════════════════════════════════════════════════════
// @usrp/ui — layout scale and the two sparkline models (pure, testable)
//
// Why this file exists, and why it is pure:
//
// The page-shell width was copied into seven files with three different
// values (1200px in six feature slices and the console host, 80rem in
// NationalHeader, then 640px / 960px in the citizen and field apps). Nobody
// could answer "how wide is a USRP page" without grepping. A layout constant
// that lives in one place and is asserted by a test is the only version of
// that answer that survives a restyle.
//
// The chart geometry is here for the same reason: a sparkline that is correct
// in a story and wrong in production is a screenshot bug, so the argument
// order and the y-mapping are tested without a browser, and the components
// become thin renderers over functions with 100% branch coverage.
// ══════════════════════════════════════════════════════════════════

/**
 * The one page width in USRP.
 *
 * 1200px is what six feature slices already used, so adopting it changes no
 * existing screen; what changes is that it becomes a value with a name
 * instead of a literal in seven files.
 *
 * `NationalHeader` centres its content at 80rem (1280px) with `space.300`
 * (24px) inner padding - see `national/NationalHeader.tsx`. The header and a
 * 1200px page therefore differ by 40px per side at wide viewports. `PageShell`
 * closes that by defaulting `align="header"`, which pads the content box out
 * to the header's inner edge instead of to a narrower arbitrary width. The
 * choice is explicit per screen: full-bleed (`align="bleed"`) and a deliberately
 * narrow column (`align="narrow"`) are the other two answers, and the point of
 * this constant is that there are only three.
 */
export const PAGE_MAX_WIDTH = {
  /** Default content column. Six feature slices already ship this width. */
  standard: "1200px",
  /** The national header's own content box (80rem). Alignment target. */
  header: "1280px",
  /** Reading-width column: the citizen portal's existing 640px pages. */
  narrow: "640px",
} as const;

export type PageAlign = keyof typeof PAGE_MAX_WIDTH;

// There is deliberately NO PAGE_INNER_PADDING constant here. It used to exist,
// exported and unread, while PageShell spelled `space.300` out by hand - a
// "single source of truth" that nothing consulted. It cannot be reintroduced as
// a token argument either: both the tokens babel plugin and
// @atlaskit/design-system/no-unsafe-design-token-usage require the token string
// to be a literal at the call site. The gutter therefore has exactly one
// definition, in PageShell, where it is used.

/**
 * Turn a series of readings into the polyline points of one sparkline.
 *
 * Rules, all of them deliberate:
 *  - The y axis is scaled to the series' own min/max, because a queue count
 *    that moved between 40 and 44 is the story, not the fact that it is far
 *    below 100. A flat series is drawn down the middle rather than divided by
 *    zero.
 *  - The x axis is spread evenly, because readings are periodic samples, not
 *    timestamps. Callers with irregular gaps pre-resample.
 *  - Output is a string of `x,y` pairs rounded to 2dp, so the same input
 *    renders byte-identically on every run and a screenshot diff is a real
 *    signal instead of float noise.
 *
 * Returns "" for fewer than two points; a single point is not a line, and the
 * component draws a dot instead (see `sparklineIsDot`).
 */
export function sparklinePoints(values: readonly number[], width: number, height: number): string {
  const points = sparklinePath(values, width, height);
  return points === null ? "" : points.map(([x, y]) => `${round2(x)},${round2(y)}`).join(" ");
}

/**
 * The same geometry, unrounded, for callers that need coordinates rather than
 * an SVG attribute (area fills, dot markers). Null for fewer than two points.
 */
export function sparklinePath(
  values: readonly number[],
  width: number,
  height: number,
): readonly (readonly [number, number])[] | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min;
  const stepX = width / (finite.length - 1);
  return finite.map((value, index) => {
    // A flat series sits on the centre line: 0/0 is not 0.5, and a line drawn
    // along the top edge would read as "maximum" when nothing moved.
    const ratio = span === 0 ? 0.5 : (value - min) / span;
    return [index * stepX, height - ratio * height] as const;
  });
}

/** True when the series is too short to draw a line and a dot is the honest mark. */
export function sparklineIsDot(values: readonly number[]): boolean {
  return values.filter((v) => Number.isFinite(v)).length === 1;
}

export type TrendDirection = "up" | "down" | "flat";

/**
 * Change between the first and last reading, as a signed integer percent.
 *
 * `previous` of 0 returns `null`: "up 100%" and "up 4,000%" are both lies when
 * the baseline is zero, and a dash is the honest rendering. A change smaller
 * than 0.5% rounds to 0 and is reported as `flat`, so a badge never claims
 * movement the eye cannot see.
 */
export function trendOf(values: readonly number[]): {
  readonly direction: TrendDirection;
  readonly percent: number | null;
} {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return { direction: "flat", percent: null };
  const first = finite[0] as number;
  const last = finite[finite.length - 1] as number;
  if (first === 0) return { direction: last === 0 ? "flat" : "up", percent: null };
  const percent = Math.round(((last - first) / Math.abs(first)) * 100);
  const direction: TrendDirection = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  return { direction, percent };
}

/**
 * A trend's meaning is not its sign.
 *
 * For a queue of applications waiting on an officer, "up" is bad. For a count
 * of completed reviews, "up" is good. The colour therefore comes from the
 * caller's `goodDirection`, never from arithmetic - the one place this file
 * refuses to have an opinion.
 */
export function trendTone(direction: TrendDirection, goodDirection: "up" | "down"): "good" | "bad" | "neutral" {
  if (direction === "flat") return "neutral";
  return direction === goodDirection ? "good" : "bad";
}

/**
 * Split a total into segments that each get a minimum visible share.
 *
 * A stacked bar with one category at 1% renders a 1px sliver that reads as a
 * rendering artefact. This lifts every non-zero segment to `minShare` and takes
 * the difference proportionally from the segments that can afford it, so the
 * bar still sums to 1 and no segment disappears. Zero stays zero: a category
 * with no rows must not be drawn.
 */
export function stackShares(values: readonly number[], minShare = 0.02): readonly number[] {
  const total = values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
  if (total === 0) return values.map(() => 0);
  const raw = values.map((v) => (v > 0 ? v / total : 0));
  const lifted = raw.map((share) => (share > 0 && share < minShare ? minShare : share));
  const lift = lifted.reduce((sum, s, i) => sum + (s - (raw[i] as number)), 0);
  if (lift === 0) return raw;
  // Take the lift back from segments above the floor, in proportion to how
  // much room they have above it. If that cannot cover the lift (many tiny
  // segments), fall back to renormalising, which is always a valid partition.
  const headroom = lifted.reduce((sum, s) => sum + Math.max(0, s - minShare), 0);
  if (headroom <= 0) {
    const sum = lifted.reduce((a, b) => a + b, 0);
    return sum === 0 ? lifted : lifted.map((s) => s / sum);
  }
  const scaled = lifted.map((s) => (s > minShare ? s - ((s - minShare) / headroom) * lift : s));
  const sum = scaled.reduce((a, b) => a + b, 0);
  return sum === 0 ? scaled : scaled.map((s) => s / sum);
}

/**
 * The eight categorical accent slots ADS ships for charts, in a stable order.
 * A series' colour is its index, so adding a campaign cannot recolour the
 * campaigns beside it.
 */
export const CHART_SERIES_TOKENS = [
  "color.chart.categorical.1",
  "color.chart.categorical.2",
  "color.chart.categorical.3",
  "color.chart.categorical.4",
  "color.chart.categorical.5",
  "color.chart.categorical.6",
  "color.chart.categorical.7",
  "color.chart.categorical.8",
] as const;

/**
 * The slot a series at `index` occupies, wrapped into the eight categorical
 * positions.
 *
 * This is the ONLY definition of the wrap. StackedBar used to carry its own
 * `index % SERIES_FILL.length` while this function sat here with no caller -
 * two copies of one rule, which is how a legend swatch and the bar it labels
 * end up different colours after an edit. Bad indices land on slot 0 rather
 * than throwing: a chart is not a place to fail a render.
 */
export function seriesIndexAt(index: number): number {
  const safe = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  return safe % CHART_SERIES_TOKENS.length;
}

/**
 * The token NAME for slot `index`; wraps after 8 because there is no slot 9.
 *
 * Note it returns a name, not a resolved value: `token()` only rewrites calls
 * whose argument is a string literal at the call site, so a component that
 * needs a colour writes `token("color.chart.categorical.1")` itself. This
 * function is what tells it WHICH literal to write, and it is what the
 * StackedBar fill table is keyed on.
 */
export function seriesTokenAt(index: number): (typeof CHART_SERIES_TOKENS)[number] {
  return CHART_SERIES_TOKENS[seriesIndexAt(index)] as (typeof CHART_SERIES_TOKENS)[number];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
