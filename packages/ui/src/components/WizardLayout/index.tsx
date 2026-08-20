import React from "react";
import { Box, Inline, Stack } from "@atlaskit/primitives/compiled";
import { ProgressTracker, type Stages } from "@atlaskit/progress-tracker";
import Heading from "@atlaskit/heading";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";

// cssMap at module scope — xcss prop only accepts cssMap output, not css().
const containerStyles = cssMap({
  base: {
    maxWidth: "640px",
    marginInline: "auto",
    paddingBlock: token("space.600"),
    paddingInline: token("space.400"),
  },
});

interface WizardLayoutProps {
  readonly title: string;
  /** Current 0-based step index. */
  readonly currentStep: number;
  readonly steps: readonly string[];
  readonly children: React.ReactNode;
  /** Rendered in the footer row (Back / Next buttons). */
  readonly footer: React.ReactNode;
  readonly testId?: string;
}

/**
 * One-thing-per-page wizard shell.
 *
 * HCI mandate (from research doc):
 *  - "One-Thing-Per-Page Rule": each screen shows only one question / step,
 *    reducing cognitive load and allowing frequent "Save Points".
 *  - Progress Tracker gives applicants a sense of how far they've come,
 *    countering "tunnel vision" anxiety.
 *  - Large, high-contrast layout is sunlight-safe (positive polarity).
 */
export function WizardLayout({
  title,
  currentStep,
  steps,
  children,
  footer,
  testId,
}: WizardLayoutProps): React.ReactElement {
  const trackerStages: Stages = steps.map((label, i) => ({
    id: `step-${i}`,
    label,
    status:
      i < currentStep
        ? "visited"
        : i === currentStep
          ? "current"
          : "unvisited",
    percentageComplete: i < currentStep ? 100 : 0,
    href: "#",
  }));

  return (
    <Box xcss={containerStyles.base} {...(testId !== undefined ? { testId } : {})}>
      <Stack space="space.500">
        <ProgressTracker items={trackerStages} />
        <Stack space="space.300">
          <Heading size="large">
            {title}
          </Heading>
          <Box>{children}</Box>
        </Stack>
        <Inline space="space.200" alignInline="end">
          {footer}
        </Inline>
      </Stack>
    </Box>
  );
}
