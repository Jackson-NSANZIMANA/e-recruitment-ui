import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import { formatCount, formatShare } from "../format.js";
import { barFill } from "../model.js";

/**
 * What a bar MEANS, not what colour it is. Colour is chosen here, once, from
 * ADS background tokens, so a theme change recolours every chart together.
 *
 *  - `brand`    work in progress / the default magnitude (one hue, per the
 *               sequential rule: magnitude is length, not a rainbow)
 *  - `success`  a good end state
 *  - `warning`  needs a look soon (a campaign nearly full)
 *  - `danger`   needs action now
 *  - `neutral`  closed, archived, or not a verdict
 */
export type BarTone = "brand" | "success" | "warning" | "danger" | "neutral";

const tones = cssMap({
  brand: { backgroundColor: token("color.background.brand.bold") },
  success: { backgroundColor: token("color.background.success.bold") },
  warning: { backgroundColor: token("color.background.warning.bold") },
  danger: { backgroundColor: token("color.background.danger.bold") },
  neutral: { backgroundColor: token("color.background.accent.gray.subtle") },
});

/** `exactOptionalPropertyTypes`: an absent test id is spread away, never passed as undefined. */
const tid = (id: string | undefined): { testId?: string } => (id === undefined ? {} : { testId: id });

const styles = cssMap({
  list: { listStyle: "none", margin: token("space.0"), padding: token("space.0"), display: "flex", flexDirection: "column", gap: token("space.200") },
  row: { margin: token("space.0"), padding: token("space.0") },
  track: {
    width: "100%",
    height: "0.625rem",
    // A track is the bar's full scale. It is a neutral SURFACE, so an empty bar
    // still shows how far it could go - an empty chart must keep its shape.
    backgroundColor: token("color.background.neutral"),
    borderRadius: token("radius.small"),
    overflow: "hidden",
  },
  bar: { height: "100%", borderRadius: token("radius.small"), minWidth: "0" },
  value: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 },
  empty: { paddingBlock: token("space.200") },
});

export interface BarChartItem {
  readonly id: string;
  /** Localised label, drawn on the left above its bar. */
  readonly label: string;
  readonly value: number;
  /** Replaces the printed value, e.g. "95 of 100". The bar still uses `value`. */
  readonly display?: string;
  /** A second figure printed after the value, e.g. a share. Drawn in subtle ink. */
  readonly detail?: string;
  readonly tone?: BarTone;
  /** This bar's own full scale (e.g. a campaign's capacity). Defaults to the chart's. */
  readonly max?: number;
  /** Lands on the row. */
  readonly testId?: string;
  /** Lands on the printed value alone, so a test can read the bare number. */
  readonly valueTestId?: string;
}

export interface BarChartProps {
  readonly items: readonly BarChartItem[];
  /** Accessible name for the list, e.g. "Applications by stage". Already localised. */
  readonly label: string;
  /** The shared full scale. Defaults to the largest value, so the longest bar fills its track. */
  readonly max?: number;
  /** Print each item's share of the total after its value. */
  readonly showShare?: boolean;
  /** Shown instead of the bars when there are no items. */
  readonly emptyText?: string;
  readonly testId?: string;
}

/**
 * A horizontal bar chart drawn as a list: label and value on one line, the bar
 * under them.
 *
 * Why a list and not an SVG. Every label and value is real text at the page's
 * 16px floor, wrapping and reflowing with the card; an SVG would scale its text
 * down with the card width. Why labels on every bar. A bar chart answers "how
 * much", and the number is the answer; printing it directly means a reader never
 * has to estimate a length against an axis, and colour never carries meaning
 * alone.
 *
 * The data is the markup: a screen reader gets `list > listitem > "Label 42 (12%)"`
 * with no separate table to keep in sync.
 */
export function BarChart({ items, label, max, showShare = false, emptyText, testId }: BarChartProps): React.ReactElement {
  const { i18n } = useTranslation();
  const total = items.reduce((sum, i) => sum + (Number.isFinite(i.value) ? Math.max(0, i.value) : 0), 0);
  const scale = max ?? Math.max(1, ...items.map((i) => (Number.isFinite(i.value) ? i.value : 0)));

  if (items.length === 0) {
    return emptyText === undefined ? <Box {...tid(testId)} /> : (
      <Box xcss={styles['empty']} {...tid(testId)}><Text as="p" size="large" color="color.text.subtle">{emptyText}</Text></Box>
    );
  }

  return (
    <Box as="ul" xcss={styles['list']} aria-label={label} {...tid(testId)}>
      {items.map((item) => {
        const own = item.max ?? scale;
        const share = total > 0 ? item.value / total : null;
        const pct = Math.round(barFill(item.value, own) * 10_000) / 100;
        return (
          <Box as="li" key={item.id} xcss={styles['row']} {...tid(item.testId)}>
            <Stack space="space.075">
              <Inline spread="space-between" alignBlock="end" space="space.150">
                <Text size="large" color="color.text.subtle">{item.label}</Text>
                <Box xcss={styles['value']}><Inline space="space.100" alignBlock="end">
                  <Text size="large" weight="semibold" {...tid(item.valueTestId)}>{item.display ?? formatCount(item.value, i18n.language)}</Text>
                  {item.detail !== undefined && <Text size="large" color="color.text.subtle">{item.detail}</Text>}
                  {item.detail === undefined && showShare && share !== null && (
                    <Text size="large" color="color.text.subtle">{formatShare(share, i18n.language)}</Text>
                  )}
                </Inline></Box>
              </Inline>
              <Box xcss={styles['track']} aria-hidden="true">
                <Box xcss={cx(styles['bar'], (item.tone ?? "brand") === "brand" && tones.brand, item.tone === "success" && tones.success, item.tone === "warning" && tones.warning, item.tone === "danger" && tones.danger, item.tone === "neutral" && tones.neutral)} style={{ width: `${String(pct)}%` }} />
              </Box>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
