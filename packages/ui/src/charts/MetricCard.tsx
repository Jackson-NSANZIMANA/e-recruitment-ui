import React from "react";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { Card } from "../layout/Card.js";
import { Sparkline, type SparklineDatum } from "./Sparkline.js";
import { useTranslation } from "@usrp/i18n";
import { type TrendDirection } from "../model.js";

const styles = cssMap({
  figure: {
    // `font.metric.large` is the ADS metric face: 28px/32px, weight 653. It is
    // a real typography token, not a hardcoded size - but the house rule's
    // allowlist only recognises font.body / font.heading / font.code, so the
    // metric family is disabled here rather than faked with a 32px heading,
    // which would put a second heading level in the card.
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography
    font: token("font.metric.large"),
    fontVariantNumeric: "tabular-nums",
    color: token("color.text"),
    margin: token("space.0"),
  },
  figureUrgentBox: {
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography
    font: token("font.metric.large"),
    fontVariantNumeric: "tabular-nums",
    color: token("color.text.danger"),
    margin: token("space.0"),
  },
  chart: { marginBlockStart: token("space.050") },
});

export interface MetricCardProps {
  /** What the number counts, already localised, e.g. "Awaiting adjudication". */
  readonly label: string;
  readonly value: number;
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
   * Marks the tile as needing action. Colour is a repeat of the label, never
   * the only signal: the count is printed and the label says what it counts.
   * A red tile with a red border was the old treatment and drew the eye to the
   * border rather than the number.
   */
  readonly urgent?: boolean;
  /** Footer link - "View queue", "Open applications". */
  readonly action?: React.ReactNode;
  readonly testId?: string;
}

/**
 * The KPI tile: one number, its label, and (optionally) the shape of its recent
 * history.
 *
 * Replaces `DashboardMetricCard`, which rendered the value as a 24px heading on
 * a `color.background.neutral` tile with a warning border when urgent. A grey
 * tile on a white page reads as disabled, and the border carried the alarm
 * instead of the number. Here the surface stays a raised card, the number is a
 * 32px tabular metric, and urgency is expressed on the figure and the label.
 *
 * It is built on `Card`, so it gains the named-region semantics and the raised
 * plane for free and cannot drift from the other panels on the page.
 */
export function MetricCard({
  label,
  value,
  trend,
  goodDirection = "up",
  urgent = false,
  action,
  testId,
}: MetricCardProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Card
      title={label}
      titleLevel={3}
      {...(action !== undefined ? { footer: action } : {})}
      {...(testId !== undefined ? { testId } : {})}
    >
      <Stack space="space.100">
        <Box
          as="p"
          xcss={urgent ? styles['figureUrgentBox'] : styles['figure']}
        >
          {value.toLocaleString()}
        </Box>
        {urgent && (
          <Text as="p" size="medium" weight="medium" color="color.text.danger">
            {t("chart.needs_attention")}
          </Text>
        )}
        {trend !== undefined && (
          <Box xcss={styles['chart']}>
            <Sparkline
              data={trend}
              label={label}
              goodDirection={goodDirection}
              height={40}
              showTrend
              testId={testId === undefined ? "metric-chart" : `${testId}-chart`}
            />
          </Box>
        )}
      </Stack>
    </Card>
  );
}
