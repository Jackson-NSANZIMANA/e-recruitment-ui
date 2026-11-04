import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import VisuallyHidden from "@atlaskit/visually-hidden";
import { useTranslation } from "@usrp/i18n";
import { formatCount } from "../format.js";
import { niceCeiling } from "../model.js";
import { ChartLegend, ChartTip, Swatch, useMeasuredWidth } from "./chartParts.js";
import { seriesFill } from "./series.js";

const PAD = { left: 52, right: 8, top: 12, bottom: 8 } as const;

const styles = cssMap({
  frame: { position: "relative", width: "100%", borderRadius: token("radius.small") },
  plot: { display: "flex" },
  yLabel: { position: "absolute", insetInlineStart: token("space.0"), insetBlockStart: token("space.0"), textAlign: "end", pointerEvents: "none" },
  xAxis: { position: "relative", height: "3rem", marginBlockStart: token("space.050") },
  xLabel: { position: "absolute", insetBlockStart: token("space.0"), insetInlineStart: token("space.0"), textAlign: "center", overflow: "hidden", overflowWrap: "break-word" },
  empty: { position: "absolute", insetBlockStart: token("space.0"), insetInlineStart: token("space.0"), insetInlineEnd: token("space.0"), textAlign: "center", pointerEvents: "none" },
});

export interface ColumnSeries { readonly id: string; readonly label: string }
export interface ColumnCategory {
  readonly id: string;
  readonly label: string;
  /** One value per series, in the series' order. */
  readonly values: readonly number[];
}

export interface StackedColumnChartProps {
  readonly categories: readonly ColumnCategory[];
  readonly series: readonly ColumnSeries[];
  /** `stacked` (default) draws one column per category; `grouped` draws one column per series side by side. */
  readonly mode?: "stacked" | "grouped";
  /** Accessible name. Already localised. */
  readonly label: string;
  readonly height?: number;
  /** Printed over the chart when every value is zero. Already localised. */
  readonly emptyText?: string;
  readonly testId?: string;
}

/** A column with only its top corners rounded: the data end is rounded, the baseline end is not. */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/**
 * Stacked or grouped columns for a handful of categories (campaigns, categories)
 * split by a few series (stages). Axis, gridlines, a legend, a hover tooltip that
 * lists every series for the category, keyboard arrows, and a data table for
 * assistive technology.
 */
export function StackedColumnChart({ categories, series, mode = "stacked", label, height = 280, emptyText, testId }: StackedColumnChartProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [frameRef, width] = useMeasuredWidth();
  const [active, setActive] = React.useState<number | null>(null);
  const n = categories.length;
  const plotH = height - PAD.top - PAD.bottom;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const band = n > 0 ? innerW / n : innerW;
  const safe = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);
  const peak = Math.max(0, ...categories.map((c) => (mode === "stacked" ? c.values.reduce((s, v) => s + safe(v), 0) : Math.max(0, ...c.values.map(safe)))));
  const ceiling = niceCeiling(peak);
  const yOf = (value: number): number => PAD.top + plotH * (1 - value / ceiling);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const allZero = peak === 0;
  const barW = mode === "stacked" ? Math.min(64, band * 0.52) : Math.min(band * 0.8, 28 * Math.max(1, series.length));
  const groupW = barW;
  const slot = mode === "grouped" && series.length > 0 ? groupW / series.length : barW;

  const onMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left - PAD.left;
    setActive(x < 0 || x > innerW || n === 0 ? null : Math.min(n - 1, Math.floor(x / band)));
  };
  const onKey = (event: React.KeyboardEvent): void => {
    if (n === 0) return;
    if (event.key === "ArrowRight") { event.preventDefault(); setActive((a) => Math.min(n - 1, (a ?? -1) + 1)); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); setActive((a) => Math.max(0, (a ?? n) - 1)); }
    else if (event.key === "Escape") setActive(null);
  };
  const hovered = active !== null ? categories[active] : undefined;
  const hoverTotal = hovered !== undefined ? hovered.values.reduce((s, v) => s + safe(v), 0) : 0;
  const hoverTop = hovered !== undefined ? yOf(mode === "stacked" ? hoverTotal : Math.max(0, ...hovered.values.map(safe))) : 0;

  return (
    <Stack space="space.150" {...(testId !== undefined ? { testId } : {})}>
      {series.length > 1 && <ChartLegend items={series} />}
      <Box>
        <Box ref={frameRef} xcss={styles['frame']} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setActive(null)} onMouseLeave={() => setActive(null)}>
          <Box xcss={styles['plot']}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} onMouseMove={onMove} aria-hidden="true" focusable="false" overflow="visible">
              {ticks.map((f) => (
                <line key={f} x1={PAD.left} x2={width - PAD.right} y1={yOf(ceiling * f)} y2={yOf(ceiling * f)} stroke={token("color.border")} strokeWidth={1} strokeDasharray={f === 0 ? undefined : "3 4"} />
              ))}
              {active !== null && <rect x={PAD.left + active * band} y={PAD.top} width={band} height={plotH} fill={token("color.background.neutral.subtle.hovered")} />}
              {categories.map((c, ci) => {
                const cx = PAD.left + band * ci + band / 2;
                if (mode === "grouped") {
                  return c.values.map((v, si) => {
                    const h = plotH - (yOf(safe(v)) - PAD.top);
                    if (h <= 0) return null;
                    return <path key={`${c.id}-${series[si]?.id ?? si}`} d={topRounded(cx - groupW / 2 + si * slot + 1, yOf(safe(v)), Math.max(2, slot - 2), h, 4)} fill={seriesFill(si)} />;
                  });
                }
                let cum = 0;
                const last = c.values.reduce((idx, v, i) => (safe(v) > 0 ? i : idx), -1);
                return c.values.map((v, si) => {
                  const value = safe(v);
                  if (value <= 0) return null;
                  const top = yOf(cum + value);
                  const h = yOf(cum) - top;
                  cum += value;
                  // A 2px surface stroke is the gap between stacked segments.
                  return si === last
                    ? <path key={`${c.id}-${series[si]?.id ?? si}`} d={topRounded(cx - barW / 2, top, barW, h, 4)} fill={seriesFill(si)} stroke={token("elevation.surface.raised")} strokeWidth={2} />
                    : <rect key={`${c.id}-${series[si]?.id ?? si}`} x={cx - barW / 2} y={top} width={barW} height={h} fill={seriesFill(si)} stroke={token("elevation.surface.raised")} strokeWidth={2} />;
                });
              })}
            </svg>
          </Box>
          {ticks.map((f) => (
            <Box key={f} xcss={styles['yLabel']} style={{ width: `${String(PAD.left - 10)}px`, transform: `translateY(${yOf(ceiling * f) - 12}px)` }} aria-hidden="true">
              <Text size="large" color="color.text.subtle">{formatCount(ceiling * f, i18n.language)}</Text>
            </Box>
          ))}
          {allZero && emptyText !== undefined && <Box xcss={styles['empty']} style={{ transform: `translateY(${PAD.top + plotH / 2 - 14}px)` }}><Text as="p" size="large" color="color.text.subtle">{emptyText}</Text></Box>}
          {hovered !== undefined && active !== null && (
            <ChartTip x={PAD.left + band * active + band / 2} y={Math.max(0, hoverTop - 24 - 28 * (series.length + (mode === "stacked" ? 1 : 0)))} frameWidth={width}>
              <Stack space="space.050">
                <Text as="p" size="large" weight="semibold">{hovered.label}</Text>
                {series.map((s, si) => (
                  <Inline key={s.id} space="space.100" spread="space-between" alignBlock="center">
                    <Inline space="space.075" alignBlock="center"><Swatch index={si} /><Text size="large" color="color.text.subtle">{s.label}</Text></Inline>
                    <Text size="large" weight="semibold">{formatCount(safe(hovered.values[si] ?? 0), i18n.language)}</Text>
                  </Inline>
                ))}
                {mode === "stacked" && (
                  <Inline space="space.100" spread="space-between"><Text size="large" color="color.text.subtle">{t("chart.total")}</Text><Text size="large" weight="bold">{formatCount(hoverTotal, i18n.language)}</Text></Inline>
                )}
              </Stack>
            </ChartTip>
          )}
        </Box>
        <Box xcss={styles['xAxis']} aria-hidden="true">
          {categories.map((c, ci) => (
            <Box key={c.id} xcss={styles['xLabel']} style={{ width: `${String(Math.max(0, band - 6))}px`, transform: `translateX(${PAD.left + band * ci + 3}px)` }}>
              <Text size="large" color={ci === active ? "color.text" : "color.text.subtle"}>{c.label}</Text>
            </Box>
          ))}
        </Box>
      </Box>
      <VisuallyHidden>
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">{t("chart.period")}</th>{series.map((s) => <th key={s.id} scope="col">{s.label}</th>)}</tr></thead>
          <tbody>{categories.map((c) => (<tr key={c.id}><th scope="row">{c.label}</th>{c.values.map((v, i) => <td key={series[i]?.id ?? i}>{formatCount(safe(v), i18n.language)}</td>)}</tr>))}</tbody>
        </table>
      </VisuallyHidden>
    </Stack>
  );
}
