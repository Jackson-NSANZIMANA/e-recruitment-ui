import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import VisuallyHidden from "@atlaskit/visually-hidden";
import { useTranslation } from "@usrp/i18n";
import { sparklineIsDot, sparklinePath, trendOf, trendTone, type TrendDirection } from "../model.js";

const styles = cssMap({
  frame: { display: "block", margin: token("space.0") },
  /**
   * The table is the real interface and is reachable by assistive tech, but it
   * must not take screen space from the shape it summarises. Standard
   * visually-hidden clip; never `display: none`, which removes it from the
   * accessibility tree and leaves the figure with no data at all.
   */
  table: { borderCollapse: "collapse", font: token("font.body.small") },
});


export interface SparklineDatum {
  /** The x-axis label a screen reader hears, e.g. "Mon 3 Nov". Already localised by the caller. */
  readonly label: string;
  readonly value: number;
}

export interface SparklineProps {
  /** Readings, oldest first. Non-finite values are skipped, never plotted as zero. */
  readonly data: readonly SparklineDatum[];
  /** Accessible name for the figure, e.g. "Applications received, last 7 days". Already localised. */
  readonly label: string;
  readonly width?: number;
  readonly height?: number;
  /**
   * Which direction counts as good. A rising queue is bad; a rising count of
   * completed reviews is good. Required, because the sign of a change says
   * nothing about whether it is news.
   *
   * Deliberately not `TrendDirection`: "flat is good" is not a policy anyone
   * can hold, and a flat series is neutral whatever this says.
   */
  readonly goodDirection: Exclude<TrendDirection, "flat">;
  /** Draw the trend badge above the line. Off inside a small metric tile. */
  readonly showTrend?: boolean;
  readonly testId?: string;
}

/**
 * A trend line for one series, with a text alternative carrying the same data.
 *
 * Hand-drawn SVG over primitives rather than a chart library: `@atlaskit/charts`
 * was last published in 2021 against React 16 peers, and a general-purpose
 * library would add more gzipped bytes than the officer console's field-tablet
 * budget can defend for two shapes. This draws one polyline and, for a
 * single-reading series, one dot.
 *
 * Deliberately absent: axes, tooltips, hover. A sparkline is a shape you read at
 * a glance next to a number. When a reader needs the exact value on a given day,
 * the hidden data table is the interface — which is why every instance ships one.
 *
 * Colour never encodes the number: it encodes whether the movement is good,
 * which the caller declares. The percentage is always printed as text too, so
 * the two cannot disagree and colour is never the only channel.
 */
export function Sparkline({
  data,
  label,
  width = 220,
  height = 48,
  goodDirection,
  showTrend = true,
  testId,
}: SparklineProps): React.ReactElement {
  const { t } = useTranslation();
  const values = data.map((d) => d.value);
  const trend = trendOf(values);
  // trendTone needs a good direction; a flat series has no tone, and
  // trendTone already returns "neutral" for a flat series, so the direction is
  // narrowed here rather than widened in the model.
  const tone: "good" | "bad" | "neutral" =
    trend.direction === "flat" ? "neutral" : trendTone(trend.direction, goodDirection);
  const path = sparklinePath(values, width, height);
  const isDot = sparklineIsDot(values);
  const tableId = React.useId();

  // SVG elements do not accept `xcss`, and the tokens plugin only rewrites
  // `token()` calls with a string literal, so each branch names its token.
  const stroke =
    tone === "good"
      ? token("color.chart.success")
      : tone === "bad"
        ? token("color.chart.danger")
        : token("color.chart.neutral");

  const line: string | null =
    path === null ? null : path.map(([x, y]) => `${String(round2(x))},${String(round2(y))}`).join(" ");
  const area: string | null =
    path === null
      ? null
      : `M0,${String(height)} ${path.map(([x, y]) => `L${String(round2(x))},${String(round2(y))}`).join(" ")} L${String(width)},${String(height)} Z`;
  const last = path?.[path.length - 1];
  const trendColour =
    tone === "good" ? "color.text.success" : tone === "bad" ? "color.text.danger" : "color.text.subtle";

  return (
    <Stack space="space.050" {...(testId !== undefined ? { testId } : {})}>
      {showTrend && (
        <Inline space="space.100" alignBlock="center">
          <Text size="medium" weight="medium" color={trendColour}>
            {trend.percent === null ? "—" : `${trend.percent > 0 ? "+" : ""}${String(trend.percent)}%`}
          </Text>
          <Text size="medium" color="color.text.subtle">{trendGlyph(trend.direction)}</Text>
        </Inline>
      )}
      {/*
        A <figure> with a name, not a bare <div>: the graphic is then reachable
        as "figure, Applications received" instead of being skipped as paint.
        `aria-details` points at the table, which is the real interface.
      */}
      <Box as="figure" xcss={styles['frame']} aria-label={label} aria-details={tableId}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          aria-hidden="true"
          focusable="false"
        >
          <line
            x1={0}
            y1={height - 0.5}
            x2={width}
            y2={height - 0.5}
            stroke={token("color.border")}
            strokeWidth={1}
          />
          {area !== null && <path d={area} fill={stroke} fillOpacity={0.12} stroke="none" />}
          {line !== null && (
            <polyline
              points={line}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {isDot && last !== undefined && <circle cx={last[0]} cy={last[1]} r={3} fill={stroke} />}
        </svg>
        <VisuallyHidden>
          <table id={tableId}>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">{t("chart.period")}</th>
                <th scope="col">{t("chart.value")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.label}</th>
                  <td>{String(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </VisuallyHidden>
      </Box>
    </Stack>
  );
}

/** Direction as a shape, not a word: this glyph is decorative and next to a printed number. */
function trendGlyph(direction: TrendDirection): string {
  if (direction === "up") return "▲";
  if (direction === "down") return "▼";
  return "■";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
