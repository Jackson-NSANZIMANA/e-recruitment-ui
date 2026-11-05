import React from "react";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import { formatCount, formatShare } from "../format.js";
import { shareOf } from "../model.js";

/** `exactOptionalPropertyTypes`: an absent test id is spread away, never passed as undefined. */
const tid = (id: string | undefined): { testId?: string } => (id === undefined ? {} : { testId: id });

const styles = cssMap({
  frame: { position: "relative", display: "inline-block", flexShrink: 0 },
  centre: {
    position: "absolute",
    inset: token("space.0"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
  },
  figure: {
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography -- the ADS metric face has no allowlisted family
    font: token("font.metric.medium"),
    fontWeight: token("font.weight.bold"),
    fontVariantNumeric: "tabular-nums",
    color: token("color.text"),
    margin: token("space.0"),
  },
});

export type GaugeTone = "brand" | "success" | "warning" | "danger";

/** `token()` only rewrites string literals, so each tone is named once here. */
function toneStroke(tone: GaugeTone): string {
  switch (tone) {
    case "success": return token("color.chart.green.bold");
    case "warning": return token("color.chart.orange.bold");
    case "danger": return token("color.chart.danger.bold");
    case "brand": return token("color.chart.blue.bold");
  }
}

export interface RingGaugeProps {
  /** The part, e.g. tablets seen today. */
  readonly value: number;
  /** The whole, e.g. active tablets. */
  readonly total: number;
  /** Accessible name and visible caption, e.g. "Seen in the last 24 hours". Already localised. */
  readonly label: string;
  readonly tone?: GaugeTone;
  readonly size?: number;
  readonly testId?: string;
}

/**
 * One part of one whole, as a ring with the share printed in the middle.
 *
 * A ring answers a single question - "how much of this is done?" - which is the
 * one job a pie-shaped form is good at. It is never used to compare categories.
 * The value and total are printed beside it ("3 of 5") so the arc is a repeat of
 * the words, not the only carrier.
 */
export function RingGauge({ value, total, label, tone = "brand", size = 112, testId }: RingGaugeProps): React.ReactElement {
  const { i18n } = useTranslation();
  const share = shareOf(value, total);
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = share === null ? 0 : share * circumference;
  return (
    <Stack space="space.100" alignInline="center" {...tid(testId)}>
      <Box xcss={styles['frame']} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(total, 0)} aria-valuenow={Math.min(Math.max(value, 0), Math.max(total, 0))} aria-valuetext={`${formatCount(value, i18n.language)} / ${formatCount(total, i18n.language)}`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={token("color.border")} strokeWidth={stroke} />
          {filled > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={toneStroke(tone)}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference - filled}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>
        <Box xcss={styles['centre']}>
          <Box as="p" xcss={styles['figure']}>{share === null ? "—" : formatShare(share, i18n.language)}</Box>
        </Box>
      </Box>
      <Text as="p" size="large" color="color.text.subtle" align="center">{label}</Text>
    </Stack>
  );
}
