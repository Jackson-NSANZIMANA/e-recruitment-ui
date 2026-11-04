import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import { stackShares } from "../model.js";

const styles = cssMap({
  track: {
    display: "block",
    width: "100%",
    height: "0.75rem",
    borderRadius: token("radius.small"),
    overflow: "hidden",
    // The empty track is a neutral surface. The filled spans are drawn as SVG
    // rects because `color.chart.*` is typed as an SVG fill, not a CSS
    // background: using it as a background would bypass the token types that
    // are the only thing keeping an untokenised colour out of this file.
    backgroundColor: token("color.background.neutral"),
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: token("space.150"),
    listStyle: "none",
    margin: token("space.0"),
    padding: token("space.0"),
  },
  swatch: { display: "block", flexShrink: 0 },
});

/**
 * The eight categorical fills, resolved once at module scope.
 *
 * `token()` only rewrites calls whose first argument is a string literal, so
 * each slot is named individually. Indexing this table by position keeps a
 * series' colour stable when another series is added - the whole point of a
 * categorical scale - and it is why no category ever borrows a status colour:
 * a category is not a verdict.
 */
const SERIES_FILL: readonly string[] = [
  token("color.chart.categorical.1"),
  token("color.chart.categorical.2"),
  token("color.chart.categorical.3"),
  token("color.chart.categorical.4"),
  token("color.chart.categorical.5"),
  token("color.chart.categorical.6"),
  token("color.chart.categorical.7"),
  token("color.chart.categorical.8"),
];

export interface StackedBarSegment {
  /** Localised label, also used as the legend entry. */
  readonly label: string;
  readonly value: number;
}

export interface StackedBarProps {
  /** Segments in stable order. Order decides colour, so adding one never recolours the rest. */
  readonly segments: readonly StackedBarSegment[];
  /** Accessible name, e.g. "Applications by stage". Already localised. */
  readonly label: string;
  /** Show the legend under the bar. */
  readonly showLegend?: boolean;
  /** Show the total to the right of the bar. */
  readonly showTotal?: boolean;
  readonly testId?: string;
}

/**
 * A proportional single bar plus its legend.
 *
 * This replaces the pattern in the officer dashboard where each pipeline stage
 * was its own full-width track scaled to the largest stage. That renders one
 * honest fact (comparison against the biggest stage) and hides another
 * (composition, and the total). A stacked bar answers "how much is in the
 * pipeline, and how is it distributed" with one shape, which is the question an
 * officer actually has.
 *
 * The easy-to-get-wrong parts live in `stackShares` and are tested there: every
 * non-zero segment keeps a visible minimum so a 1% stage never vanishes, the
 * shares always sum to 1, and a zero segment is not drawn. The legend repeats
 * every value as text, so colour is never the only channel.
 */
export function StackedBar({
  segments,
  label,
  showLegend = true,
  showTotal = true,
  testId,
}: StackedBarProps): React.ReactElement {
  const { t } = useTranslation();
  const total = segments.reduce((sum, s) => sum + (s.value > 0 ? s.value : 0), 0);
  const shares = stackShares(segments.map((s) => s.value));

  let cursor = 0;
  const spans = segments.map((segment, index) => {
    const share = shares[index] ?? 0;
    if (segment.value <= 0 || share <= 0) return null;
    const x = cursor;
    cursor += share;
    return { label: segment.label, x, width: share, fill: SERIES_FILL[index % SERIES_FILL.length] as string };
  });

  return (
    <Stack space="space.150" {...(testId !== undefined ? { testId } : {})}>
      {/*
        A named <figure>, for the same reason as the sparkline: role="img" on a
        layout div announces an image where a figure with a caption is meant, and
        the caption is the composition itself.
      */}
      <Box
        as="figure"
        aria-label={`${label}: ${segments.map((s) => `${s.label} ${String(s.value)}`).join(", ")}`}
        xcss={styles['track']}
      >
        <svg width="100%" height="100%" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {spans.map((span) =>
            span === null ? null : (
              <rect key={span.label} x={span.x * 100} y={0} width={span.width * 100} height={1} fill={span.fill} />
            ),
          )}
        </svg>
      </Box>
      {(showLegend || showTotal) && (
        <Inline spread="space-between" alignBlock="start" space="space.200" shouldWrap>
          {showLegend && (
            <Box as="ul" xcss={styles['legend']}>
              {segments.map((segment, index) => (
                <Box as="li" key={segment.label}>
                  <Inline space="space.075" alignBlock="center">
                    <Box as="span" xcss={styles['swatch']}>
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                        <rect x={0} y={0} width={12} height={12} rx={2} fill={SERIES_FILL[index % SERIES_FILL.length]} />
                      </svg>
                    </Box>
                    <Text size="medium" color="color.text.subtle">
                      {segment.label}{" "}
                      <Text as="span" weight="semibold" color="color.text">
                        {String(segment.value)}
                      </Text>
                    </Text>
                  </Inline>
                </Box>
              ))}
            </Box>
          )}
          {showTotal && (
            <Text size="medium" color="color.text.subtle">
              {t("chart.total")}{" "}
              <Text as="span" weight="semibold" color="color.text">
                {String(total)}
              </Text>
            </Text>
          )}
        </Inline>
      )}
    </Stack>
  );
}
