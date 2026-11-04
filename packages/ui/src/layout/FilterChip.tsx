import React from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { Box, Inline, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";

const styles = cssMap({
  chip: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    minHeight: "3rem",
    paddingInline: token("space.150"),
    borderRadius: token("radius.medium"),
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderColor: token("color.border"),
    backgroundColor: token("elevation.surface"),
    color: token("color.text"),
  },
  on: { borderColor: token("color.border.selected"), backgroundColor: token("color.background.selected"), color: token("color.text.selected") },
  // The native select covers the whole chip, invisible: the browser supplies the
  // menu, the keyboard model and the touch picker; the chip supplies the look.
  select: {
    position: "absolute",
    insetBlockStart: token("space.0"),
    insetInlineStart: token("space.0"),
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
});

export interface FilterChipOption { readonly value: string; readonly label: string }

export interface FilterChipProps {
  /** What the chip filters, e.g. "Campaign". */
  readonly label: string;
  readonly value: string;
  readonly options: readonly FilterChipOption[];
  readonly onChange: (value: string) => void;
  /** The value that means "no filter"; the chip is drawn "on" for any other. */
  readonly neutralValue?: string;
  readonly testId?: string;
}

/**
 * A dashboard filter drawn as a chip: "Campaign: All campaigns  v". It turns
 * brand-blue when it is narrowing the view, so an active filter is visible at a
 * glance. Underneath is a native `<select>`, so it is keyboard-operable, announced
 * with its label, and uses the platform's own picker on a tablet.
 */
export function FilterChip({ label, value, options, onChange, neutralValue, testId }: FilterChipProps): React.ReactElement {
  const id = React.useId();
  const current = options.find((o) => o.value === value);
  const active = neutralValue !== undefined && value !== neutralValue;
  return (
    <Box xcss={cx(styles['chip'], active && styles['on'])} {...(testId !== undefined ? { testId } : {})}>
      <Inline space="space.100" alignBlock="center">
        <Text size="large" color="inherit" weight="medium">{label}{current !== undefined ? `: ${current.label}` : ""}</Text>
        <ChevronDownIcon label="" color="currentColor" size="small" />
      </Inline>
      <Box as="select" id={id} xcss={styles['select']} aria-label={label} value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Box>
    </Box>
  );
}
