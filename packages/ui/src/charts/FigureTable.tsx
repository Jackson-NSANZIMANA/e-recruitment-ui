import React from "react";
import { Box, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";

const styles = cssMap({
  scroll: { overflowX: "auto" },
  table: { width: "100%", minWidth: "max-content", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" },
  nowrap: { whiteSpace: "nowrap" },
  headCell: {
    backgroundColor: token("color.background.accent.blue.subtlest"),
    paddingBlock: token("space.100"),
    paddingInline: token("space.150"),
    borderBlockEndWidth: token("border.width"),
    borderBlockEndStyle: "solid",
    borderBlockEndColor: token("color.border"),
  },
  cell: { paddingBlock: token("space.100"), paddingInline: token("space.150"), borderBlockEndWidth: token("border.width"), borderBlockEndStyle: "solid", borderBlockEndColor: token("color.border") },
  start: { textAlign: "start" },
  end: { textAlign: "end" },
  footCell: { paddingBlock: token("space.100"), paddingInline: token("space.150"), backgroundColor: token("color.background.accent.blue.subtlest") },
});

export interface FigureTableColumn { readonly id: string; readonly label: string }
export interface FigureTableRow { readonly id: string; readonly label: string; readonly cells: readonly string[]; readonly testId?: string }

export interface FigureTableProps {
  /** Heading of the first (row-label) column. */
  readonly rowHeading: string;
  readonly columns: readonly FigureTableColumn[];
  readonly rows: readonly FigureTableRow[];
  /** A closing row, e.g. totals. */
  readonly footer?: { readonly label: string; readonly cells: readonly string[] };
  /** Accessible name. */
  readonly label: string;
  readonly testId?: string;
}

/**
 * A compact numeric table: a tinted header, the row label in bold, the figures in
 * link blue and right-aligned so digits line up, an optional totals row. Cells
 * arrive already formatted, so a ratio and a count can share a column.
 */
export function FigureTable({ rowHeading, columns, rows, footer, label, testId }: FigureTableProps): React.ReactElement {
  return (
    <Box xcss={styles['scroll']} {...(testId !== undefined ? { testId } : {})}>
      <Box as="table" xcss={styles['table']} aria-label={label}>
        <thead>
          <tr>
            <Box as="th" scope="col" xcss={cx(styles['headCell'], styles['start'])}><Text size="large" weight="semibold">{rowHeading}</Text></Box>
            {columns.map((c) => <Box as="th" key={c.id} scope="col" xcss={cx(styles['headCell'], styles['end'], styles['nowrap'])}><Text size="large" weight="semibold">{c.label}</Text></Box>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} {...(r.testId !== undefined ? { "data-testid": r.testId } : {})}>
              <Box as="th" scope="row" xcss={cx(styles['cell'], styles['start'])}><Text size="large" weight="semibold">{r.label}</Text></Box>
              {r.cells.map((cell, i) => <Box as="td" key={columns[i]?.id ?? i} xcss={cx(styles['cell'], styles['end'], styles['nowrap'])}><Text size="large" color="color.link">{cell}</Text></Box>)}
            </tr>
          ))}
        </tbody>
        {footer !== undefined && (
          <tfoot>
            <tr>
              <Box as="th" scope="row" xcss={cx(styles['footCell'], styles['start'])}><Text size="large" weight="bold">{footer.label}</Text></Box>
              {footer.cells.map((cell, i) => <Box as="td" key={columns[i]?.id ?? i} xcss={cx(styles['footCell'], styles['end'])}><Text size="large" weight="bold" color="color.link">{cell}</Text></Box>)}
            </tr>
          </tfoot>
        )}
      </Box>
    </Box>
  );
}
