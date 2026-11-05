import React from "react";
import { Box, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import VisuallyHidden from "@atlaskit/visually-hidden";
import { useTranslation } from "@usrp/i18n";
import { formatCount } from "../format.js";
import { niceCeiling, nearestIndex, trendPoints } from "../model.js";

const HEIGHT = 224;
const PAD = { padX: 28, padTop: 28, padBottom: 12 } as const;
const FALLBACK_WIDTH = 480;

/** `exactOptionalPropertyTypes`: an absent test id is spread away, never passed as undefined. */
const tid = (id: string | undefined): { testId?: string } => (id === undefined ? {} : { testId: id });

const styles = cssMap({
  frame: { position: "relative", width: "100%", outlineWidth: token("border.width.focused"), outlineStyle: "none", borderRadius: token("radius.small") },
  plot: { display: "flex" },
  yLabel: { position: "absolute", insetInlineStart: token("space.0"), insetBlockStart: token("space.0"), pointerEvents: "none" },
  xAxis: { position: "relative", height: "1.75rem", marginBlockStart: token("space.050") },
  xLabel: { position: "absolute", insetBlockStart: token("space.0"), insetInlineStart: token("space.0"), whiteSpace: "nowrap" },
  tip: {
    position: "absolute",
    insetBlockStart: token("space.0"),
    insetInlineStart: token("space.0"),
    pointerEvents: "none",
    whiteSpace: "nowrap",
    backgroundColor: token("elevation.surface.overlay"),
    boxShadow: token("elevation.shadow.overlay"),
    borderRadius: token("radius.small"),
    paddingBlock: token("space.050"),
    paddingInline: token("space.100"),
    zIndex: 1,
  },
  empty: { position: "absolute", insetBlockStart: token("space.0"), insetInlineStart: token("space.0"), insetInlineEnd: token("space.0"), textAlign: "center", pointerEvents: "none" },
});

export interface TrendChartDatum {
  /** The x label, already localised ("4 Nov"). Also the tooltip's heading. */
  readonly label: string;
  readonly value: number;
}

export interface TrendChartProps {
  readonly data: readonly TrendChartDatum[];
  /** Accessible name, e.g. "Arrivals per day, last 7 days". Already localised. */
  readonly label: string;
  /** Noun for the tooltip value, e.g. "arrivals". Already localised. */
  readonly unit?: string;
  /** Printed over the flat line when every reading is zero. Already localised. */
  readonly emptyText?: string;
  readonly testId?: string;
}

/** The container's width, tracked, so SVG geometry is in real pixels and text never scales. */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = React.useState(FALLBACK_WIDTH);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const read = (): void => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setWidth(w); };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * A single-series area chart for a short, regular series (a week of days).
 *
 * What it adds over a sparkline: a scale (gridlines at 0, half and the ceiling,
 * whole numbers only), a labelled x axis, and a hover/keyboard layer - a
 * crosshair, an enlarged marker and a tooltip with the exact reading - so the
 * shape can be checked against the numbers without leaving the chart.
 *
 * All text is HTML at the page's 16px floor, positioned over an SVG that holds
 * only shapes; the SVG is drawn in measured pixels, so nothing is scaled. One
 * series, so no legend and no colour decisions to make: the chart's title names
 * the series. A hidden table carries the same readings for assistive technology.
 * An all-zero series says so in words instead of drawing a flat line that reads
 * as "data, and it is low".
 */
export function TrendChart({ data, label, unit, emptyText, testId }: TrendChartProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const width = useWidth(frameRef);
  const [active, setActive] = React.useState<number | null>(null);

  const values = data.map((d) => d.value);
  const ceiling = niceCeiling(Math.max(0, ...values.filter(Number.isFinite)));
  const box = { width, height: HEIGHT, ...PAD };
  const points = trendPoints(values, box, ceiling);
  const baseY = HEIGHT - PAD.padBottom;
  const yOf = (fraction: number): number => PAD.padTop + (baseY - PAD.padTop) * (1 - fraction);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = first !== undefined && last !== undefined ? `${line} L${last.x},${baseY} L${first.x},${baseY} Z` : "";
  const allZero = values.every((v) => !(v > 0));
  const step = data.length > 4 && width / data.length < 76 ? 2 : 1;
  const current = active !== null ? points[active] : undefined;
  const reading = active !== null ? data[active] : undefined;

  const onMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActive(nearestIndex(points, event.clientX - rect.left));
  };
  const onKey = (event: React.KeyboardEvent): void => {
    if (data.length === 0) return;
    if (event.key === "ArrowRight") { event.preventDefault(); setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1)); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); setActive((a) => Math.max(0, (a ?? data.length) - 1)); }
    else if (event.key === "Escape") setActive(null);
  };

  return (
    <Box {...tid(testId)}>
      <Box
        ref={frameRef}
        xcss={styles['frame']}
        tabIndex={0}
        role="group"
        aria-label={label}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onMouseLeave={() => setActive(null)}
      >
        <Box xcss={styles['plot']}>
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} onMouseMove={onMove} aria-hidden="true" focusable="false" overflow="visible">
          {/* Recessive grid: three hairlines, the baseline solid, the others dashed. */}
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={0} x2={width} y1={yOf(f)} y2={yOf(f)} stroke={token("color.border")} strokeWidth={1} strokeDasharray={f === 0 ? undefined : "3 4"} />
          ))}
          {area !== "" && <path d={area} fill={token("color.chart.blue.bold")} fillOpacity={0.14} />}
          {line !== "" && <path d={line} fill="none" stroke={token("color.chart.blue.bold")} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {current !== undefined && (
            <line x1={current.x} x2={current.x} y1={PAD.padTop - 8} y2={baseY} stroke={token("color.border.bold")} strokeWidth={1} />
          )}
          {points.map((p, i) => (
            // 8px markers with a 2px surface ring, so overlapping marks stay separable.
            <circle key={data[i]?.label ?? i} cx={p.x} cy={p.y} r={i === active ? 6 : 4} fill={token("color.chart.blue.bold")} stroke={token("elevation.surface.raised")} strokeWidth={2} />
          ))}
        </svg>
        </Box>
        {/* The y labels sit just above their gridline, at the left edge. */}
        <Box xcss={styles['yLabel']} style={{ transform: `translateY(${yOf(1) - 22}px)` }} aria-hidden="true"><Text size="large" color="color.text.subtle">{formatCount(ceiling, i18n.language)}</Text></Box>
        <Box xcss={styles['yLabel']} style={{ transform: `translateY(${yOf(0.5) - 22}px)` }} aria-hidden="true"><Text size="large" color="color.text.subtle">{formatCount(ceiling / 2, i18n.language)}</Text></Box>
        {allZero && emptyText !== undefined && (
          <Box xcss={styles['empty']} style={{ transform: `translateY(${yOf(0.5) + 8}px)` }}><Text as="p" size="large" color="color.text.subtle">{emptyText}</Text></Box>
        )}
        {current !== undefined && reading !== undefined && (
          <Box
            xcss={styles['tip']}
            role="status"
            style={{ transform: `translate(calc(${Math.min(Math.max(current.x, 56), Math.max(56, width - 56))}px - 50%), ${Math.max(0, current.y - 66)}px)` }}
          >
            <Text as="p" size="large" color="color.text.subtle">{reading.label}</Text>
            <Text as="p" size="large" weight="semibold">{formatCount(reading.value, i18n.language)}{unit !== undefined ? ` ${unit}` : ""}</Text>
          </Box>
        )}
      </Box>
      <Box xcss={styles['xAxis']} aria-hidden="true">
        {data.map((d, i) => (i % step === 0 || i === data.length - 1) && (points[i] !== undefined) ? (
          <Box key={d.label} xcss={styles['xLabel']} style={{ transform: `translateX(calc(${points[i]?.x ?? 0}px - 50%))` }}>
            <Text size="large" color={i === active ? "color.text" : "color.text.subtle"}>{d.label}</Text>
          </Box>
        ) : null)}
      </Box>
      <VisuallyHidden>
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">{t("chart.period")}</th><th scope="col">{t("chart.value")}</th></tr></thead>
          <tbody>
            {data.map((d) => (<tr key={d.label}><th scope="row">{d.label}</th><td>{formatCount(d.value, i18n.language)}</td></tr>))}
          </tbody>
        </table>
      </VisuallyHidden>
    </Box>
  );
}
