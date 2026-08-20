import React from "react";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import type { BackgroundColor } from "@atlaskit/primitives/compiled";

interface DashboardMetricCardProps {
  readonly label: string;
  readonly value: number;
  /** When true the card is visually highlighted — use for "requires action". */
  readonly urgent?: boolean;
  readonly testId?: string;
}

// cssMap at module scope — build-time extraction, no runtime conditional in css()
const containerStyles = cssMap({
  base: {
    padding: token("space.300"),
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderRadius: token("radius.medium"),
    minWidth: "160px",
  },
  normal: {
    borderColor: token("color.border"),
  },
  urgent: {
    borderColor: token("color.border.warning"),
  },
});

/**
 * A single KPI tile used in the officer exception-based dashboard.
 *
 * HCI mandate: Critical KPIs (requiresAction) are visually differentiated to
 * break the officer's "inattentional blindness" pattern — Gestalt preattentive
 * attributes (colour) are used, NOT a second red icon that blends into noise.
 *
 * Uses Box `backgroundColor` prop (not xcss) for surface-aware background —
 * this is the canonical ADS pattern per the mirror source.
 */
export function DashboardMetricCard({
  label,
  value,
  urgent = false,
  testId,
}: DashboardMetricCardProps): React.ReactElement {
  const bg: BackgroundColor = urgent
    ? "color.background.warning"
    : "color.background.neutral";

  return (
    <Box
      backgroundColor={bg}
      xcss={cx(containerStyles['base'], urgent ? containerStyles['urgent'] : containerStyles['normal'])}
      {...(testId !== undefined ? { testId } : {})}
    >
      <Stack space="space.100" alignInline="start">
        <Heading size="xlarge">
          {value.toLocaleString()}
        </Heading>
        <Text
          size="small"
          color={urgent ? "color.text.warning" : "color.text.subtle"}
          weight="medium"
        >
          {label}
        </Text>
      </Stack>
    </Box>
  );
}
