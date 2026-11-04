import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import { formatCount } from "../format.js";
import { ChartLegend } from "./chartParts.js";
import { seriesFill } from "./series.js";

const styles = cssMap({
  list: { listStyle: "none", margin: token("space.0"), padding: token("space.0"), display: "flex", flexDirection: "column", gap: token("space.150") },
  row: { margin: token("space.0"), padding: token("space.0") },
  svg: { display: "flex" },
});

export interface StackedRowsProps {
  readonly rows: readonly { readonly id: string; readonly label: string; readonly values: readonly number[]; readonly testId?: string }[];
  readonly series: readonly { readonly id: string; readonly label: string }[];
  readonly label: string;
  readonly emptyText?: string;
  readonly testId?: string;
}

/**
 * One horizontal bar per row, split into the series it is made of, all on one
 * shared scale so row lengths are comparable. The total is printed at the end of
 * each row; a segment's value is in the legend-keyed tooltip text of the row and
 * the visible total, never left to be estimated from a length alone.
 */
export function StackedRows({ rows, series, label, emptyText, testId }: StackedRowsProps): React.ReactElement {
  const { i18n } = useTranslation();
  const safe = (v: number | undefined): number => (v !== undefined && Number.isFinite(v) && v > 0 ? v : 0);
  const totals = rows.map((r) => r.values.reduce((s, v) => s + safe(v), 0));
  const scale = Math.max(1, ...totals);
  if (rows.length === 0) return emptyText === undefined ? <Box /> : <Text as="p" size="large" color="color.text.subtle">{emptyText}</Text>;
  return (
    <Stack space="space.200" {...(testId !== undefined ? { testId } : {})}>
      <Box as="ul" xcss={styles['list']} aria-label={label}>
        {rows.map((r, ri) => {
          let x = 0;
          return (
            <Box as="li" key={r.id} xcss={styles['row']} {...(r.testId !== undefined ? { testId: r.testId } : {})}>
              <Stack space="space.050">
                <Inline spread="space-between" alignBlock="end" space="space.150">
                  <Text size="large" color="color.text.subtle">{r.label}</Text>
                  <Text size="large" weight="semibold">{formatCount(totals[ri] ?? 0, i18n.language)}</Text>
                </Inline>
                <Box xcss={styles['svg']} aria-hidden="true">
                  <svg width="100%" height={14} focusable="false">
                    <rect x="0" y="0" width="100%" height={14} rx={3} fill={token("color.background.neutral")} />
                    {r.values.map((v, si) => {
                      const w = (safe(v) / scale) * 100;
                      if (w <= 0) return null;
                      const seg = <rect key={series[si]?.id ?? si} x={`${x}%`} y="0" width={`${w}%`} height={14} fill={seriesFill(si)} stroke={token("elevation.surface.raised")} strokeWidth={1.5}><title>{`${series[si]?.label ?? ""}: ${formatCount(safe(v), i18n.language)}`}</title></rect>;
                      x += w;
                      return seg;
                    })}
                  </svg>
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Box>
      <ChartLegend items={series} />
    </Stack>
  );
}
