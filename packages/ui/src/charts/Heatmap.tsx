import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import { formatCount } from "../format.js";
import { heatLevel } from "../model.js";

const styles = cssMap({
  scroll: { overflowX: "auto" },
  table: { width: "100%", minWidth: "28rem", borderCollapse: "separate", borderSpacing: token("space.025") },
  corner: { textAlign: "start", paddingInline: token("space.100"), width: "5.5rem" },
  colHead: { textAlign: "center", paddingBlock: token("space.050"), whiteSpace: "nowrap" },
  rowHead: { textAlign: "start", paddingInline: token("space.100"), paddingBlock: token("space.075"), whiteSpace: "nowrap" },
  cell: { textAlign: "center", paddingBlock: token("space.100"), borderRadius: token("radius.small"), fontVariantNumeric: "tabular-nums" },
  l0: { backgroundColor: token("color.background.neutral.subtle"), color: token("color.text.subtlest") },
  l1: { backgroundColor: token("color.background.accent.blue.subtlest"), color: token("color.text") },
  l2: { backgroundColor: token("color.background.accent.blue.subtler"), color: token("color.text") },
  l3: { backgroundColor: token("color.background.accent.blue.subtle"), color: token("color.text") },
  l4: { backgroundColor: token("color.background.accent.blue.bolder"), color: token("color.text.inverse") },
  total: { textAlign: "center", fontVariantNumeric: "tabular-nums", paddingInline: token("space.100") },
  keyCell: { display: "block", width: "1.25rem", height: "0.75rem", borderRadius: token("radius.small") },
});

export interface HeatmapProps {
  readonly rows: readonly { readonly id: string; readonly label: string }[];
  readonly cols: readonly { readonly id: string; readonly label: string }[];
  /** `values[r][c]`. `null` is "no reading yet" (a day that has not happened), drawn as a dash, never as 0. */
  readonly values: readonly (readonly (number | null)[])[];
  readonly label: string;
  /** Show a total column / row. */
  readonly totals?: boolean;
  /** The two ends of the key, already localised ("Fewer", "More"). */
  readonly keyLabels?: readonly [string, string];
  readonly testId?: string;
}

/**
 * A matrix with the count in every cell and four steps of one blue behind it.
 * The number is the answer and the shade is the pre-attentive overview, so the
 * chart still reads in greyscale and for a reader who cannot tell the steps apart.
 * A real table: headers are `th scope`, so a screen reader announces row and column.
 */
export function Heatmap({ rows, cols, values, label, totals = true, keyLabels, testId }: HeatmapProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const safe = (v: number | null | undefined): number => (v !== undefined && v !== null && Number.isFinite(v) && v > 0 ? v : 0);
  const max = Math.max(0, ...values.flatMap((r) => r.map(safe)));
  const rowTotal = (r: number): number => (values[r] ?? []).reduce<number>((s, v) => s + safe(v), 0);
  const colTotal = (c: number): number => values.reduce<number>((s, r) => s + safe(r[c]), 0);
  return (
    <Stack space="space.150" {...(testId !== undefined ? { testId } : {})}>
      <Box xcss={styles['scroll']}>
        <Box as="table" xcss={styles['table']} aria-label={label}>
          <thead>
            <tr>
              <Box as="th" xcss={styles['corner']} scope="col"><Text size="large" color="color.text.subtle">{" "}</Text></Box>
              {cols.map((c) => <Box as="th" key={c.id} xcss={styles['colHead']} scope="col"><Text size="large" color="color.text.subtle">{c.label}</Text></Box>)}
              {totals && <Box as="th" xcss={styles['colHead']} scope="col"><Text size="large" weight="semibold">{t("chart.total")}</Text></Box>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.id}>
                <Box as="th" xcss={styles['rowHead']} scope="row"><Text size="large" weight="medium">{r.label}</Text></Box>
                {cols.map((c, ci) => {
                  const v = safe(values[ri]?.[ci]);
                  return <Box as="td" key={c.id} xcss={cx(styles['cell'], heatLevel(v, max) === 0 && styles['l0'], heatLevel(v, max) === 1 && styles['l1'], heatLevel(v, max) === 2 && styles['l2'], heatLevel(v, max) === 3 && styles['l3'], heatLevel(v, max) === 4 && styles['l4'])}><Text size="large" color="inherit" weight={v > 0 ? "semibold" : "regular"}>{values[ri]?.[ci] === null ? "–" : formatCount(v, i18n.language)}</Text></Box>;
                })}
                {totals && <Box as="td" xcss={styles['total']}><Text size="large" weight="bold">{formatCount(rowTotal(ri), i18n.language)}</Text></Box>}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr>
                <Box as="th" xcss={styles['rowHead']} scope="row"><Text size="large" weight="semibold">{t("chart.total")}</Text></Box>
                {cols.map((c, ci) => <Box as="td" key={c.id} xcss={styles['total']}><Text size="large" weight="bold">{formatCount(colTotal(ci), i18n.language)}</Text></Box>)}
                <Box as="td" xcss={styles['total']}><Text size="large" weight="bold">{formatCount(values.reduce<number>((s, r) => s + r.reduce<number>((a, v) => a + safe(v), 0), 0), i18n.language)}</Text></Box>
              </tr>
            </tfoot>
          )}
        </Box>
      </Box>
      {keyLabels !== undefined && (
        <Inline space="space.075" alignBlock="center">
          <Text size="large" color="color.text.subtle">{keyLabels[0]}</Text>
          <Box xcss={cx(styles['keyCell'], styles['l0'])} aria-hidden="true" />
          <Box xcss={cx(styles['keyCell'], styles['l1'])} aria-hidden="true" />
          <Box xcss={cx(styles['keyCell'], styles['l2'])} aria-hidden="true" />
          <Box xcss={cx(styles['keyCell'], styles['l3'])} aria-hidden="true" />
          <Box xcss={cx(styles['keyCell'], styles['l4'])} aria-hidden="true" />
          <Text size="large" color="color.text.subtle">{keyLabels[1]}</Text>
        </Inline>
      )}
    </Stack>
  );
}
