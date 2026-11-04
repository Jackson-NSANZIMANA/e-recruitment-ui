import React from "react";
import { Box, Inline, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { seriesFill } from "./series.js";

const FALLBACK_WIDTH = 480;

/**
 * The container's width, tracked, so SVG geometry is in real pixels and text never
 * scales. Returns a callback ref (what a `Box` accepts) and the current width.
 */
export function useMeasuredWidth(fallback: number = FALLBACK_WIDTH): readonly [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  const [width, setWidth] = React.useState(fallback);
  React.useLayoutEffect(() => {
    if (el === null) return undefined;
    const read = (): void => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setWidth(w); };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

const styles = cssMap({
  legend: { display: "flex", flexWrap: "wrap", columnGap: token("space.200"), rowGap: token("space.050"), listStyle: "none", margin: token("space.0"), padding: token("space.0") },
  item: { margin: token("space.0"), padding: token("space.0") },
  tip: {
    position: "absolute",
    insetBlockStart: token("space.0"),
    insetInlineStart: token("space.0"),
    pointerEvents: "none",
    whiteSpace: "nowrap",
    backgroundColor: token("elevation.surface.overlay"),
    boxShadow: token("elevation.shadow.overlay"),
    borderRadius: token("radius.small"),
    paddingBlock: token("space.075"),
    paddingInline: token("space.100"),
    zIndex: 1,
  },
});

export interface LegendItem { readonly id: string; readonly label: string }

/**
 * One swatch and one label per series, in the same fixed order as the fills.
 * Present for two or more series: identity is never colour alone.
 */
export function ChartLegend({ items, testId }: { readonly items: readonly LegendItem[]; readonly testId?: string }): React.ReactElement {
  return (
    <Box as="ul" xcss={styles['legend']} {...(testId !== undefined ? { testId } : {})}>
      {items.map((item, index) => (
        <Box as="li" key={item.id} xcss={styles['item']}>
          <Inline space="space.075" alignBlock="center">
            <Swatch index={index} />
            <Text size="large" color="color.text.subtle">{item.label}</Text>
          </Inline>
        </Box>
      ))}
    </Box>
  );
}

export function Swatch({ index }: { readonly index: number }): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect width={12} height={12} rx={3} fill={seriesFill(index)} />
    </svg>
  );
}

/** A tooltip anchored at pixel (x, y) inside a `position: relative` frame, kept inside its edges. */
export function ChartTip({ x, y, frameWidth, children }: { readonly x: number; readonly y: number; readonly frameWidth: number; readonly children: React.ReactNode }): React.ReactElement {
  const edge = 90;
  const left = Math.min(Math.max(x, edge), Math.max(edge, frameWidth - edge));
  return (
    <Box xcss={styles['tip']} role="status" style={{ transform: `translate(calc(${left}px - 50%), ${Math.max(0, y)}px)` }}>
      {children}
    </Box>
  );
}
