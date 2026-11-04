import React from "react";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import { Card } from "../layout/Card.js";
import { Sparkline, type SparklineDatum } from "./Sparkline.js";
import { formatCount } from "../format.js";
import { type Count, valueOf } from "../states/useCount.js";
import { type TrendDirection } from "../model.js";

const styles = cssMap({
  /**
   * `font.metric.large` is the ADS metric face: 28px/32px, weight 653. It is a
   * real typography token, not a hardcoded size - but the house rule's allowlist
   * only recognises font.body / font.heading / font.code, so the metric family
   * is disabled at these declarations rather than faked with a 32px heading,
   * which would put a second heading level inside the card.
   */
  figure: {
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography
    font: token("font.metric.large"),
    fontVariantNumeric: "tabular-nums",
    color: token("color.text"),
    margin: token("space.0"),
  },
  figureUrgent: {
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography
    font: token("font.metric.large"),
    fontVariantNumeric: "tabular-nums",
    color: token("color.text.danger"),
    margin: token("space.0"),
  },
  /**
   * The same box the figure occupies, drawn at body size. A missing reading must
   * not be the same shape as a small one: if "—" collapsed the tile, the row
   * would reflow every time a read resolved.
   */
  absent: {
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography
    font: token("font.metric.large"),
    fontVariantNumeric: "tabular-nums",
    color: token("color.text.subtlest"),
    margin: token("space.0"),
  },
  chart: { marginBlockStart: token("space.050") },
  /** The strip that carries a pending or failed read, so the tile keeps its height. */
  note: { minHeight: "1rem" },
});

export interface MetricCardProps {
  /** What the number counts, already localised, e.g. "Awaiting adjudication". */
  readonly label: string;
  /**
   * The reading. A `Count`, not a number: `known(0)` and "not yet known" are
   * different facts and the tile must not print the same thing for both.
   */
  readonly count: Count;
  /**
   * Optional readings behind the number. When present the card draws a
   * sparkline and a delta; when absent it is a plain figure tile.
   */
  readonly trend?: readonly SparklineDatum[];
  /**
   * Which direction is good news for THIS metric, e.g. "down" for a queue.
   * Required whenever `trend` is given: the sign of a change is not its meaning.
   */
  readonly goodDirection?: Exclude<TrendDirection, "flat">;
  /**
   * One visible line explaining what the history counts, already localised.
   * A sparkline under a number is read as that number's own past unless the
   * tile says otherwise; this is where it says otherwise.
   */
  readonly trendCaption?: string;
  /**
   * Marks the tile as needing action. Colour is a repeat of the label, never
   * the only signal: the count is printed and the label says what it counts.
   */
  readonly urgent?: boolean;
  /** Footer link - "View queue", "Open applications". */
  readonly action?: React.ReactNode;
  readonly testId?: string;
}

/**
 * The KPI tile: one number, its label, and optionally the shape of its history.
 *
 * Three readings, three treatments, and they are deliberately not interchangeable:
 *
 *  - **known** - the figure in the 28px metric face. `0` is printed as `0`,
 *    because a known zero is news.
 *  - **pending** - an em dash where the figure goes, plus an announced
 *    "Loading". The tile keeps its height so the row does not reflow when the
 *    read lands.
 *  - **failed** - an em dash plus "Unavailable". Silence here was the old bug:
 *    a failed read rendered 0 and read as an all-clear.
 *
 * Built on `Card`, so it gains a named region and the raised plane for free and
 * cannot drift from the panels beside it.
 */
export function MetricCard({
  label,
  count,
  trend,
  goodDirection = "up",
  trendCaption,
  urgent = false,
  action,
  testId,
}: MetricCardProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const value = valueOf(count);
  const isUrgent = urgent && value !== null && value > 0;

  return (
    <Card
      title={label}
      titleLevel={3}
      {...(action !== undefined ? { footer: action } : {})}
      {...(testId !== undefined ? { testId } : {})}
    >
      <Stack space="space.100">
        <Box as="p" xcss={isUrgent ? styles['figureUrgent'] : value === null ? styles['absent'] : styles['figure']}>
          {formatCount(value, i18n.language)}
        </Box>
        <Box xcss={styles['note']}>
          {count.state === "pending" && (
            // The live region is a Box, because Text forwards a curated prop
            // list that drops `role` - so a role on <Text> would look right in
            // the source and be absent from the DOM. Announcing once, politely,
            // is the point: a reader must not mistake "still loading" for
            // "nothing to do".
            <Box role="status" aria-live="polite">
              <Text as="p" size="large" color="color.text.subtle">{t("metric.loading")}</Text>
            </Box>
          )}
          {count.state === "failed" && (
            <Text as="p" size="large" color="color.text.danger">
              {t("metric.unavailable")}
            </Text>
          )}
          {count.state === "known" && isUrgent && (
            <Text as="p" size="large" weight="medium" color="color.text.danger">
              {t("chart.needs_attention")}
            </Text>
          )}
        </Box>
        {/* The history is drawn only for a known reading: a line whose last
            point is "unknown" is read as a drop to zero, which is a worse lie
            than no line at all. */}
        {trend !== undefined && count.state === "known" && (
          <Box xcss={styles['chart']}>
            <Sparkline
              data={trend}
              label={label}
              goodDirection={goodDirection}
              height={40}
              showTrend
              {...(trendCaption !== undefined ? { caption: trendCaption } : {})}
              testId={testId === undefined ? "metric-chart" : `${testId}-chart`}
            />
          </Box>
        )}
      </Stack>
    </Card>
  );
}
