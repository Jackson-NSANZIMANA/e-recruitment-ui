import React from "react";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { PageShell } from "./PageShell.js";
import { Card } from "./Card.js";
import { SkeletonPanel } from "./SkeletonPanel.js";
import { MetricCard } from "../charts/MetricCard.js";
import { Sparkline, type SparklineDatum } from "../charts/Sparkline.js";
import { StackedBar } from "../charts/StackedBar.js";
import { known, PENDING, FAILED } from "../states/useCount.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies, so the story shape is declared locally.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Layout/S13", parameters: { layout: "fullscreen" } };

// A reading carries its own x label, because the hidden table is the real
// interface: "31" without "w/c 27 Oct" is a number with no referent.
const series = (values: readonly number[]): readonly SparklineDatum[] =>
  values.map((value, index) => ({ label: `Week ${String(index + 1)}`, value }));

const RISING = series([12, 14, 13, 18, 21, 20, 24, 27, 26, 31]);
const FALLING = series([31, 28, 29, 24, 22, 23, 19, 17, 15, 12]);
const FLAT = series([8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);

/**
 * The three answers to "how wide is a page", one after another.
 *
 * `header` aligns with the national header's own content box; `standard` is the
 * 1200px column six feature slices already shipped; `narrow` is reading width.
 * They are the only three widths in the system, and this story is the visual
 * proof that the difference is a decision and not an accident.
 */
export const PageAlignment: Story = {
  render: () => (
    <Stack space="space.400">
      <PageShell align="header" title="align=header" description="1280px: the national header's inner edge. The default.">
        <Card title="The default column">
          <Text size="large" as="p">A page column that lines up with the lockup above it, at every viewport width.</Text>
        </Card>
      </PageShell>
      <PageShell align="standard" title="align=standard" description="1200px: the width six feature slices already use.">
        <Card title="The legacy column" tone="flat">
          <Text size="large" as="p">What already ships. Adopting it changes no existing screen.</Text>
        </Card>
      </PageShell>
      <PageShell align="narrow" title="align=narrow" description="640px: reading width for forms and single-task screens.">
        <Card title="The narrow column" tone="flat">
          <Text size="large" as="p">One task per screen, with a line length a person can actually track.</Text>
        </Card>
      </PageShell>
    </Stack>
  ),
};

/** A raised card against a flat panel: the difference is the plane, not a border. */
export const CardElevation: Story = {
  render: () => (
    <PageShell align="narrow" title="Card" description="Raised is the default; flat is opt-in for content already on a card.">
      <Stack space="space.300">
        <Card title="Raised (default)" description="elevation.surface.raised plus a border.">
          <Text size="large" as="p">The unit of layout on every dashboard and queue screen.</Text>
        </Card>
        <Card title="Flat" description="elevation.surface, for a panel inside a raised surface." tone="flat">
          <Text size="large" as="p">Same padding, same named region, one plane lower.</Text>
        </Card>
        <Card title="Selected" description="A brand border on a brand-tinted surface." selected>
          <Text size="large" as="p">Selection survives colour-blindness because the border weight and the surface change together.</Text>
        </Card>
      </Stack>
    </PageShell>
  ),
};

/**
 * Loading as a shape, not a spinner.
 *
 * Each placeholder is the size of the thing that replaces it, so the page does
 * not reflow when the read resolves. The whole panel is aria-hidden and the
 * announcement is a single polite live region.
 */
export const LoadingShapes: Story = {
  render: () => (
    <PageShell align="standard" title="SkeletonPanel" description="Four shapes: metrics, table, chart, prose.">
      <Stack space="space.300">
        <Card title="Metrics">
          <SkeletonPanel shape="metrics" />
        </Card>
        <Card title="Chart">
          <SkeletonPanel shape="chart" />
        </Card>
        <Card title="Table">
          <SkeletonPanel shape="table" rows={3} />
        </Card>
        <Card title="Prose">
          <SkeletonPanel shape="prose" rows={3} />
        </Card>
      </Stack>
    </PageShell>
  ),
};

/**
 * The metric tile, with and without a history.
 *
 * `goodDirection` is mandatory whenever a series is given: a rising queue is bad
 * news, a rising count of completed reviews is good news, and the arrow cannot
 * work that out on its own.
 */
export const Metrics: Story = {
  render: () => (
    <PageShell align="standard" title="MetricCard" description="28px tabular figure, optional sparkline, urgency never on the border alone.">
      <Inline space="space.300" shouldWrap>
        <MetricCard label="Awaiting adjudication" count={known(128)} urgent testId="story-metric-urgent" />
        <MetricCard label="Open campaigns" count={known(4)} testId="story-metric-plain" />
        <MetricCard label="Applications completed" count={known(1024)} trend={RISING} goodDirection="up" testId="story-metric-up" />
        <MetricCard label="Queue age (minutes)" count={known(42)} trend={FALLING} goodDirection="down" testId="story-metric-down" />
        <MetricCard label="Devices reporting" count={known(19)} trend={FLAT} goodDirection="up" testId="story-metric-flat" />
        <MetricCard label="Tonight\'s walk-ins" count={PENDING} testId="story-metric-pending" />
        <MetricCard label="Erasure requests" count={FAILED} testId="story-metric-failed" />
      </Inline>
    </PageShell>
  ),
};

/** A sparkline whose accessible interface is a table, not a picture of a line. */
export const Sparklines: Story = {
  render: () => (
    <PageShell align="narrow" title="Sparkline" description="Scaled to its own range; a flat series is drawn down the middle, not divided by zero.">
      <Stack space="space.300">
        <Card title="Rising" description="Up is good here.">
          <Sparkline data={RISING} label="Applications completed" goodDirection="up" showTrend />
        </Card>
        <Card title="Falling" description="Down is good here: this is a queue.">
          <Sparkline data={FALLING} label="Queue age" goodDirection="down" showTrend />
        </Card>
        <Card title="Flat" description="No change is not no story, but it is not a trend either.">
          <Sparkline data={FLAT} label="Devices reporting" goodDirection="up" showTrend />
        </Card>
        <Card title="One reading" description="A dot, because a line through a single point is a lie.">
          <Sparkline data={series([7])} label="New this week" goodDirection="up" />
        </Card>
      </Stack>
    </PageShell>
  ),
};

/**
 * Composition, not comparison.
 *
 * The legend repeats every value as text, so the bar is never the only channel;
 * a 1% stage keeps a visible minimum instead of vanishing.
 */
export const StackedBars: Story = {
  render: () => (
    <PageShell align="narrow" title="StackedBar" description="One bar, one total, eight categorical slots that never borrow a status colour.">
      <Stack space="space.300">
        <Card title="Applications by stage">
          <StackedBar
            label="Applications by stage"
            segments={[
              { label: "Received", value: 42 },
              { label: "Screening", value: 31 },
              { label: "Interview", value: 12 },
              { label: "Offer", value: 1 },
            ]}
          />
        </Card>
        <Card title="Fleet by status">
          <StackedBar
            label="Fleet by status"
            segments={[
              { label: "Active", value: 19 },
              { label: "Assigned", value: 6 },
              { label: "Revoked", value: 2 },
            ]}
          />
        </Card>
        <Card title="All zero" description="Draws nothing rather than dividing by zero.">
          <StackedBar
            label="Nothing to report"
            segments={[
              { label: "Received", value: 0 },
              { label: "Screening", value: 0 },
            ]}
          />
        </Card>
      </Stack>
    </PageShell>
  ),
};
