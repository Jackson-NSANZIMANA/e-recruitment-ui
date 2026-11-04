import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import VisuallyHidden from "@atlaskit/visually-hidden";
import { useTranslation } from "@usrp/i18n";
import { formatCount } from "../format.js";
import { nearestIndex, niceCeiling } from "../model.js";
import { ChartLegend, ChartTip, Swatch, useMeasuredWidth } from "./chartParts.js";
import { seriesFill } from "./series.js";

const PAD = { left: 52, right: 16, top: 12, bottom: 8 } as const;

const styles = cssMap({
  frame: { position: "relative", width: "100%", borderRadius: token("radius.small") },
  plot: { display: "flex" },
  yLabel: { position: "absolute", insetInlineStart: token("space.0"), insetBlockStart: token("space.0"), textAlign: "end", pointerEvents: "none" },
  xAxis: { position: "relative", height: "1.75rem", marginBlockStart: token("space.050") },
  xLabel: { position: "absolute", insetBlockStart: token("space.0"), insetInlineStart: token("space.0"), whiteSpace: "nowrap" },
  empty: { position: "absolute", insetBlockStart: token("space.0"), insetInlineStart: token("space.0"), insetInlineEnd: token("space.0"), textAlign: "center", pointerEvents: "none" },
});

export interface SeriesChartSeries { readonly id: string; readonly label: string; readonly values: readonly number[] }

export interface SeriesChartProps {
  /** One label per x position ("4 Nov"). */
  readonly xLabels: readonly string[];
  readonly series: readonly SeriesChartSeries[];
  /** `line` (default): independent lines. `stacked-area`: series add up to a whole. */
  readonly mode?: "line" | "stacked-area";
  readonly label: string;
  readonly height?: number;
  readonly emptyText?: string;
  readonly testId?: string;
}

/**
 * Several series over one shared x axis: two lines to compare (received vs
 * decided) or stacked areas that add up to a whole. Gridlines on whole numbers,
 * a legend, a crosshair with a tooltip listing every series, keyboard arrows and
 * a data table. One y axis only: series of different scale belong in separate
 * charts.
 */
export function SeriesChart({ xLabels, series, mode = "line", label, height = 260, emptyText, testId }: SeriesChartProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [frameRef, width] = useMeasuredWidth();
  const [active, setActive] = React.useState<number | null>(null);
  const n = xLabels.length;
  const safe = (v: number | undefined): number => (v !== undefined && Number.isFinite(v) && v > 0 ? v : 0);
  const totals = xLabels.map((_, i) => series.reduce((sum, s) => sum + safe(s.values[i]), 0));
  const peak = mode === "stacked-area" ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((s) => s.values.map(safe)));
  const ceiling = niceCeiling(peak);
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const xAt = (i: number): number => PAD.left + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const plotH = height - PAD.top - PAD.bottom;
  const yOf = (value: number): number => PAD.top + plotH * (1 - value / ceiling);
  const baseY = yOf(0);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const allZero = peak === 0;
  const points = xLabels.map((_, i) => ({ x: xAt(i), y: 0 }));

  const layers = React.useMemo(() => {
    const out: { id: string; index: number; top: readonly number[]; bottom: readonly number[] }[] = [];
    const running = xLabels.map(() => 0);
    series.forEach((s, si) => {
      const bottom = [...running];
      const top = xLabels.map((_, i) => { running[i] = (running[i] ?? 0) + safe(s.values[i]); return running[i] ?? 0; });
      out.push({ id: s.id, index: si, top, bottom });
    });
    return out;
  }, [series, xLabels]);

  const onMove = (event: React.MouseEvent<SVGSVGElement>): void => setActive(nearestIndex(points, event.clientX - event.currentTarget.getBoundingClientRect().left));
  const onKey = (event: React.KeyboardEvent): void => {
    if (n === 0) return;
    if (event.key === "ArrowRight") { event.preventDefault(); setActive((a) => Math.min(n - 1, (a ?? -1) + 1)); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); setActive((a) => Math.max(0, (a ?? n) - 1)); }
    else if (event.key === "Escape") setActive(null);
  };
  const step = n > 1 ? Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 84)))) : 1;
  const showDots = n <= 16;

  return (
    <Stack space="space.150" {...(testId !== undefined ? { testId } : {})}>
      <Box>
        <Box ref={frameRef} xcss={styles['frame']} tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onBlur={() => setActive(null)} onMouseLeave={() => setActive(null)}>
          <Box xcss={styles['plot']}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} onMouseMove={onMove} aria-hidden="true" focusable="false" overflow="visible">
              {ticks.map((f) => (
                <line key={f} x1={PAD.left} x2={width - PAD.right} y1={yOf(ceiling * f)} y2={yOf(ceiling * f)} stroke={token("color.border")} strokeWidth={1} strokeDasharray={f === 0 ? undefined : "3 4"} />
              ))}
              {mode === "stacked-area" && [...layers].reverse().map((l) => {
                const up = l.top.map((v, i) => `${xAt(i)},${yOf(v)}`).join(" L");
                const down = [...l.bottom].map((v, i) => `${xAt(i)},${yOf(v)}`).reverse().join(" L");
                return n > 1 ? <path key={l.id} d={`M${up} L${down} Z`} fill={seriesFill(l.index)} fillOpacity={0.85} stroke={token("elevation.surface.raised")} strokeWidth={1.5} /> : null;
              })}
              {mode === "line" && series.map((s, si) => (
                <g key={s.id}>
                  <path d={xLabels.map((_, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yOf(safe(s.values[i]))}`).join(" ")} fill="none" stroke={seriesFill(si)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {(showDots || active !== null) && xLabels.map((_, i) => (showDots || i === active) && (
                    <circle key={xLabels[i] ?? i} cx={xAt(i)} cy={yOf(safe(s.values[i]))} r={i === active ? 6 : 4} fill={seriesFill(si)} stroke={token("elevation.surface.raised")} strokeWidth={2} />
                  ))}
                </g>
              ))}
              {active !== null && <line x1={xAt(active)} x2={xAt(active)} y1={PAD.top} y2={baseY} stroke={token("color.border.bold")} strokeWidth={1} />}
            </svg>
          </Box>
          {ticks.map((f) => (
            <Box key={f} xcss={styles['yLabel']} style={{ width: `${String(PAD.left - 10)}px`, transform: `translateY(${yOf(ceiling * f) - 12}px)` }} aria-hidden="true">
              <Text size="large" color="color.text.subtle">{formatCount(ceiling * f, i18n.language)}</Text>
            </Box>
          ))}
          {allZero && emptyText !== undefined && <Box xcss={styles['empty']} style={{ transform: `translateY(${PAD.top + plotH / 2 - 14}px)` }}><Text as="p" size="large" color="color.text.subtle">{emptyText}</Text></Box>}
          {active !== null && n > 0 && (
            <ChartTip x={xAt(active)} y={Math.max(0, yOf(mode === "stacked-area" ? (totals[active] ?? 0) : Math.max(0, ...series.map((s) => safe(s.values[active])))) - 34 - 30 * (series.length + 1))} frameWidth={width}>
              <Stack space="space.050">
                <Text as="p" size="large" weight="semibold">{xLabels[active]}</Text>
                {series.map((s, si) => (
                  <Inline key={s.id} space="space.150" spread="space-between" alignBlock="center">
                    <Inline space="space.075" alignBlock="center"><Swatch index={si} /><Text size="large" color="color.text.subtle">{s.label}</Text></Inline>
                    <Text size="large" weight="semibold">{formatCount(safe(s.values[active]), i18n.language)}</Text>
                  </Inline>
                ))}
              </Stack>
            </ChartTip>
          )}
        </Box>
        <Box xcss={styles['xAxis']} aria-hidden="true">
          {xLabels.map((l, i) => (n - 1 - i) % step === 0 ? (
            <Box key={`${l}-${String(i)}`} xcss={styles['xLabel']} style={{ transform: `translateX(calc(${xAt(i)}px - 50%))` }}>
              <Text size="large" color={i === active ? "color.text" : "color.text.subtle"}>{l}</Text>
            </Box>
          ) : null)}
        </Box>
      </Box>
      {series.length > 1 && <ChartLegend items={series} />}
      <VisuallyHidden>
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">{t("chart.period")}</th>{series.map((s) => <th key={s.id} scope="col">{s.label}</th>)}</tr></thead>
          <tbody>{xLabels.map((l, i) => (<tr key={`${l}-${String(i)}`}><th scope="row">{l}</th>{series.map((s) => <td key={s.id}>{formatCount(safe(s.values[i]), i18n.language)}</td>)}</tr>))}</tbody>
        </table>
      </VisuallyHidden>
    </Stack>
  );
}
