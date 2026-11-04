import React from "react";
import { Box, Inline, Stack } from "@atlaskit/primitives/compiled";
import Skeleton from "@atlaskit/skeleton";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";

const styles = cssMap({
  panel: {
    backgroundColor: token("elevation.surface.raised"),
    borderRadius: token("radius.medium"),
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderColor: token("color.border"),
    padding: token("space.300"),
  },
  row: {
    paddingBlock: token("space.150"),
    borderBlockEndWidth: token("border.width"),
    borderBlockEndStyle: "solid",
    borderBlockEndColor: token("color.border"),
  },
  // The final row drops its rule: a border under the last item of a list reads
  // as a divider against nothing. A separate class rather than a cx() merge so
  // the whole style stays in the module-level map.
  rowLast: {
    paddingBlock: token("space.150"),
    borderBlockEndWidth: "0",
  },
  metrics: { display: "grid", gap: token("space.300"), gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" },
  bars: { display: "flex", alignItems: "flex-end", gap: token("space.100"), height: "9rem" },
  bar: { flex: 1 },
});

export type SkeletonShape = "metrics" | "table" | "chart" | "prose";

export interface SkeletonPanelProps {
  /**
   * What the skeleton is standing in for. The shape must match the content
   * that replaces it, or the first paint is a jump cut - which is the exact
   * defect this exists to remove.
   */
  readonly shape: SkeletonShape;
  /** Row count for `table`; ignored by other shapes. */
  readonly rows?: number;
  readonly testId?: string;
}

/**
 * Layout-stable placeholders for content that has not arrived.
 *
 * Why this exists: `StateBoundary` answered every `loading` state with a
 * centred `Spinner`, so the officer dashboard - which refetches five reads on
 * focus - blanked its whole body and rebuilt it, on a field tablet, over a slow
 * link. A reader cannot tell "loading" from "broken" when the page has no
 * edges. A skeleton holds the edges.
 *
 * It is deliberately dumb: fixed shapes, no shimmer choreography beyond what
 * `@atlaskit/skeleton` provides, and `aria-hidden` on the shapes with the live
 * region announcing the wait to assistive tech once (via `StateBoundary`).
 * Repeating "loading" twelve times would be worse than silence.
 */
export function SkeletonPanel({ shape, rows = 5, testId }: SkeletonPanelProps): React.ReactElement {
  return (
    <Box xcss={styles['panel']} {...(testId !== undefined ? { testId } : {})} aria-hidden="true">
      {shape === "metrics" ? <MetricsShape /> : null}
      {shape === "table" ? <TableShape rows={rows} /> : null}
      {shape === "chart" ? <ChartShape /> : null}
      {shape === "prose" ? <ProseShape /> : null}
    </Box>
  );
}

function MetricsShape(): React.ReactElement {
  return (
    <Box xcss={styles['metrics']}>
      {[0, 1, 2].map((i) => (
        <Stack key={i} space="space.100">
          <Skeleton width="40%" height={12} />
          <Skeleton width="65%" height={32} />
          <Skeleton width="100%" height={8} />
        </Stack>
      ))}
    </Box>
  );
}

function TableShape({ rows }: { readonly rows: number }): React.ReactElement {
  return (
    <Stack space="space.0">
      {/* Header band first, so the column rhythm is established before data. */}
      <Box xcss={styles['row']}>
        <Inline space="space.200" alignBlock="center">
          <Skeleton width="22%" height={12} />
          <Skeleton width="14%" height={12} />
          <Skeleton width="18%" height={12} />
          <Skeleton width="10%" height={12} />
        </Inline>
      </Box>
      {Array.from({ length: Math.max(1, rows) }, (_, i) => (
        <Box key={i} xcss={i === rows - 1 ? styles['rowLast'] : styles['row']}>
          <Inline space="space.200" alignBlock="center">
            <Skeleton width="22%" height={16} />
            <Skeleton width="14%" height={16} />
            <Skeleton width="18%" height={16} />
            <Skeleton width="10%" height={16} />
          </Inline>
        </Box>
      ))}
    </Stack>
  );
}

function ChartShape(): React.ReactElement {
  return (
    <Stack space="space.200">
      <Skeleton width="35%" height={16} />
      <Box xcss={styles['bars']}>
        {/* Fixed bar heights, in rhythm order: a shape, not data. */}
        {[72, 104, 56, 120, 88, 64, 96].map((h, i) => (
          <Box key={i} xcss={styles['bar']}>
            <Skeleton width="100%" height={h} />
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

function ProseShape(): React.ReactElement {
  return (
    <Stack space="space.100">
      <Skeleton width="45%" height={20} />
      <Skeleton width="100%" height={16} />
      <Skeleton width="92%" height={16} />
      <Skeleton width="96%" height={16} />
      <Skeleton width="60%" height={16} />
    </Stack>
  );
}
