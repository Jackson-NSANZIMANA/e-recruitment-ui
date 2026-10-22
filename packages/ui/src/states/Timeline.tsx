import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { sortTimeline, type TimelineEntry } from "./model.js";

const styles = cssMap({
  item: {
    paddingInlineStart: token("space.200"),
    borderInlineStartWidth: token("border.width"),
    borderInlineStartStyle: "solid",
    borderInlineStartColor: token("color.border"),
  },
});

export interface TimelineProps {
  readonly entries: readonly TimelineEntry[];
  /** Locale-aware formatting of an instant; defaults to Intl. */
  readonly formatAt?: (iso: string) => string;
  readonly emptyLabel: string;
}

const defaultFormat = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
};

/** A vertical, newest-first record of what happened. Titles are already translated. */
export function Timeline({ entries, formatAt = defaultFormat, emptyLabel }: TimelineProps): React.ReactElement {
  if (entries.length === 0) return <Text color="color.text.subtle">{emptyLabel}</Text>;
  return (
    <Stack space="space.150" testId="timeline">
      {sortTimeline(entries).map((e) => (
        <Box key={e.id} xcss={styles["item"]}>
          <Inline space="space.150" alignBlock="start" shouldWrap>
            <Text size="small" color="color.text.subtle">{formatAt(e.at)}</Text>
            <Stack space="space.050">
              <Text weight="medium">{e.title}</Text>
              {e.detail !== undefined && <Text size="small">{e.detail}</Text>}
            </Stack>
          </Inline>
        </Box>
      ))}
    </Stack>
  );
}
