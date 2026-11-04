import { token } from "@atlaskit/tokens";
import { CHART_SERIES_TOKENS, seriesIndexAt } from "../model.js";

/**
 * The eight categorical fills, resolved once. `token()` only rewrites string
 * literals, so each slot is named; the slot ORDER and the wrap at eight come from
 * `CHART_SERIES_TOKENS` / `seriesIndexAt` in model.ts, the one definition shared
 * with StackedBar. A series keeps its slot when another series is added.
 */
const FILLS: readonly string[] = CHART_SERIES_TOKENS.map((name) => {
  switch (name) {
    case "color.chart.categorical.1": return token("color.chart.categorical.1");
    case "color.chart.categorical.2": return token("color.chart.categorical.2");
    case "color.chart.categorical.3": return token("color.chart.categorical.3");
    case "color.chart.categorical.4": return token("color.chart.categorical.4");
    case "color.chart.categorical.5": return token("color.chart.categorical.5");
    case "color.chart.categorical.6": return token("color.chart.categorical.6");
    case "color.chart.categorical.7": return token("color.chart.categorical.7");
    case "color.chart.categorical.8": return token("color.chart.categorical.8");
  }
});

/** The fill for the series at `index`, in fixed order, never cycled by a filter. */
export function seriesFill(index: number): string {
  return FILLS[seriesIndexAt(index)] ?? FILLS[0] ?? "";
}
