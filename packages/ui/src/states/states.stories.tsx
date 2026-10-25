import React from "react";
import { Stack, Text } from "@atlaskit/primitives/compiled";
import { StateBoundary } from "./StateBoundary.js";
import { QueueTable } from "./QueueTable.js";
import { Timeline } from "./Timeline.js";
import { MaskedValue } from "./MaskedValue.js";
import { FreshnessStamp } from "./FreshnessStamp.js";
import { ConfirmAction } from "./ConfirmAction.js";
import { UI_STATE_KINDS, type UiStateKind } from "./model.js";

const NOW = new Date("2026-10-22T12:00:00Z");

// Types come from the Storybook host (design-system); ui stays free of Storybook dependencies.
interface Story { readonly name?: string; readonly render: () => React.ReactElement }
export default { title: "States/Patterns", parameters: { layout: "padded" } };

function AllStates(): React.ReactElement {
  return (
    <Stack space="space.300">
      {UI_STATE_KINDS.map((s: UiStateKind) => (
        <StateBoundary key={s} state={s} onRetry={() => undefined} onClearFilters={() => undefined} {...(s === "conflict" ? { detail: "RNP" } : {})} testId={`story-${s}`}>
          <Text>Ready content</Text>
        </StateBoundary>
      ))}
    </Stack>
  );
}
export const EveryState: Story = { render: () => <AllStates /> };

export const Queue: Story = {
  render: () => (
    <QueueTable
      caption="Amber documents"
      now={NOW}
      onTransition={() => undefined}
      onOpen={() => undefined}
      rows={[
        { id: "a", primary: "RDF-2026-0001", secondary: "Soldier", status: "Documents held", since: "2026-10-18T12:00:00Z", lastAction: { label: "Held by forensics", at: "2026-10-18T12:00:00Z" }, transitions: [{ id: "clear", label: "Clear hold", appearance: "primary" }, { id: "reject", label: "Reject", appearance: "danger" }] },
        { id: "b", primary: "RDF-2026-0002", status: "Held for adjudication", since: "2026-10-22T11:00:00Z", transitions: [], result: { ok: true, text: "Cleared" } },
      ]}
    />
  ),
};

export const TimelineStory: Story = {
  name: "Timeline",
  render: () => <Timeline emptyLabel="No history" entries={[{ id: "1", at: "2026-10-18T12:00:00Z", title: "Submitted" }, { id: "2", at: "2026-10-19T09:30:00Z", title: "Documents cleared", detail: "System" }]} />,
};

export const Masked: Story = { render: () => <MaskedValue label="National ID" value="1199880012345678" onReveal={() => true} /> };
export const Freshness: Story = { render: () => <Stack space="space.100"><FreshnessStamp updatedAt="2026-10-22T11:58:00Z" now={NOW} /><FreshnessStamp updatedAt="2026-10-22T11:00:00Z" now={NOW} /></Stack> };
export const Confirm: Story = {
  render: () => (
    <ConfirmAction isOpen title="Disable this officer?" body="Their access ends now." consequences={["This officer will be signed out now."]} confirmLabel="Disable" appearance="danger" onCancel={() => undefined} onConfirm={() => undefined} />
  ),
};
