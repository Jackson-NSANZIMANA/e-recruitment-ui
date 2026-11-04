import React from "react";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";

const styles = cssMap({
  grid: { display: "grid", gap: token("space.150"), gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 8rem), 1fr))", listStyle: "none", margin: token("space.0"), padding: token("space.0") },
  cell: {
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderColor: token("color.border"),
    borderRadius: token("radius.medium"),
    paddingBlock: token("space.150"),
    paddingInline: token("space.200"),
    textAlign: "center",
    backgroundColor: token("elevation.surface"),
  },
  value: {
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography -- the ADS metric face has no allowlisted family
    font: token("font.metric.medium"),
    fontWeight: token("font.weight.bold"),
    fontVariantNumeric: "tabular-nums",
    margin: token("space.0"),
  },
  neutral: { color: token("color.text") },
  success: { color: token("color.text.success") },
  warning: { color: token("color.text.warning") },
  danger: { color: token("color.text.danger") },
});

export type StatTone = "neutral" | "success" | "warning" | "danger";
export interface StatGridItem {
  readonly id: string;
  readonly label: string;
  /** Already formatted, so a ratio can read "10.3%". */
  readonly value: string;
  readonly tone?: StatTone;
  readonly testId?: string;
}

/**
 * A grid of small bordered figures - a count, a ratio - each a label over a bold
 * number whose colour says good, watch or bad. The colour repeats what the
 * caller already decided; the number is always printed.
 */
export function StatGrid({ items, label, testId }: { readonly items: readonly StatGridItem[]; readonly label: string; readonly testId?: string }): React.ReactElement {
  return (
    <Box as="ul" xcss={styles['grid']} aria-label={label} {...(testId !== undefined ? { testId } : {})}>
      {items.map((i) => (
        <Box as="li" key={i.id} xcss={styles['cell']} {...(i.testId !== undefined ? { testId: i.testId } : {})}>
          <Stack space="space.050" alignInline="center">
            <Text as="p" size="large" color="color.text.subtle">{i.label}</Text>
            <Box as="p" xcss={cx(styles['value'], styles[i.tone ?? "neutral"])}>{i.value}</Box>
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
