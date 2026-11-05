import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import VisuallyHidden from "@atlaskit/visually-hidden";
import { useTranslation } from "@usrp/i18n";
import { Card } from "../layout/Card.js";
import { formatCount, formatPercent } from "../format.js";
import { percentChange, trendTone, niceCeiling, trendPoints } from "../model.js";
import { type Count, valueOf } from "../states/useCount.js";
import { useMeasuredWidth } from "./chartParts.js";

const styles = cssMap({
  figure: {
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography -- the ADS metric face has no allowlisted family
    font: token("font.metric.large"),
    fontWeight: token("font.weight.bold"),
    fontVariantNumeric: "tabular-nums",
    color: token("color.text"),
    margin: token("space.0"),
  },
  figureAbsent: {
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography -- the ADS metric face has no allowlisted family
    font: token("font.metric.large"),
    fontWeight: token("font.weight.bold"),
    color: token("color.text.subtlest"),
    margin: token("space.0"),
  },
  badge: { display: "inline-flex", alignItems: "center", gap: token("space.050"), paddingBlock: token("space.025"), paddingInline: token("space.075"), borderRadius: token("radius.small"), fontVariantNumeric: "tabular-nums" },
  good: { backgroundColor: token("color.background.success"), color: token("color.text.success") },
  bad: { backgroundColor: token("color.background.danger"), color: token("color.text.danger") },
  neutral: { backgroundColor: token("color.background.neutral"), color: token("color.text.subtle") },
  chart: { display: "flex" },
});

export interface HeroMetricProps {
  readonly label: string;
  /** The reading for the period. A `Count`, so "not yet known" is never printed as 0. */
  readonly count: Count;
  /** The same measure for the period before, for the change badge. Null: no baseline, no badge. */
  readonly previous?: number | null;
  /** Readings across the period, oldest first. Drawn as an area under the figure. */
  readonly series?: readonly { readonly label: string; readonly value: number }[];
  /** Which direction is good news for THIS measure: a growing queue is bad. */
  readonly goodDirection: "up" | "down";
  /** What the badge compares against, already localised ("vs previous 7 days"). */
  readonly caption?: string;
  /** Shown in place of the area when there is no series (a progress bar, say). */
  readonly children?: React.ReactNode;
  readonly testId?: string;
}

const HEIGHT = 64;

/**
 * The headline KPI of a data dashboard: a label, the figure in the bold metric
 * face, a coloured change badge, and the period's shape as a filled area.
 *
 * The badge's colour is its meaning, not its sign (`goodDirection`), and it is
 * also a glyph and a number, so it survives greyscale. With no baseline it prints
 * nothing rather than a percentage that cannot be true. The area carries no axis:
 * its job is shape, and the exact day-by-day readings are in the hidden table.
 */
export function HeroMetric({ label, count, previous = null, series, goodDirection, caption, children, testId }: HeroMetricProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [plotRef, width] = useMeasuredWidth(260);
  const value = valueOf(count);
  const change = percentChange(value, previous);
  const direction = change === null || change === 0 ? "flat" : change > 0 ? "up" : "down";
  const tone = trendTone(direction, goodDirection);
  const values = (series ?? []).map((d) => d.value);
  const ceiling = niceCeiling(Math.max(0, ...values));
  const pts = trendPoints(values, { width, height: HEIGHT, padX: 4, padTop: 8, padBottom: 6 }, ceiling);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  const area = first !== undefined && last !== undefined && pts.length > 1 ? `${line} L${last.x},${HEIGHT - 6} L${first.x},${HEIGHT - 6} Z` : "";
  const stroke = tone === "good" ? token("color.chart.green.bold") : tone === "bad" ? token("color.chart.danger.bold") : token("color.chart.blue.bold");
  const gradientId = React.useId();

  return (
    <Card title={label} titleLevel={3} {...(testId !== undefined ? { testId } : {})}>
      <Stack space="space.100">
        <Inline space="space.150" alignBlock="center" shouldWrap>
          <Box as="p" xcss={value === null ? styles['figureAbsent'] : styles['figure']}>{formatCount(value, i18n.language)}</Box>
          {change !== null && (
            <Box xcss={cx(styles['badge'], tone === "good" && styles['good'], tone === "bad" && styles['bad'], tone === "neutral" && styles['neutral'])} {...(testId !== undefined ? { testId: `${testId}-delta` } : {})}>
              <Text size="large" weight="semibold" color="inherit">{direction === "up" ? "▲" : direction === "down" ? "▼" : "▬"} {formatPercent(change, i18n.language).replace(/^\+/, "")}</Text>
            </Box>
          )}
        </Inline>
        {caption !== undefined && <Text as="p" size="large" color="color.text.subtle">{caption}</Text>}
        {series === undefined && children}
        {series !== undefined && count.state === "known" && (
          <Box ref={plotRef} xcss={styles['chart']}>
            <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              {area !== "" && <path d={area} fill={`url(#${gradientId})`} />}
              {line !== "" && pts.length > 1 && <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
              {last !== undefined && <circle cx={last.x} cy={last.y} r={4} fill={stroke} stroke={token("elevation.surface.raised")} strokeWidth={2} />}
            </svg>
          </Box>
        )}
        {series !== undefined && (
          <VisuallyHidden>
            <table>
              <caption>{label}</caption>
              <thead><tr><th scope="col">{t("chart.period")}</th><th scope="col">{t("chart.value")}</th></tr></thead>
              <tbody>{series.map((d, i) => (<tr key={`${d.label}-${String(i)}`}><th scope="row">{d.label}</th><td>{formatCount(d.value, i18n.language)}</td></tr>))}</tbody>
            </table>
          </VisuallyHidden>
        )}
      </Stack>
    </Card>
  );
}
