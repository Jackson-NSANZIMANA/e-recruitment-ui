import React from "react";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { OfflineIndicator } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/OfflineIndicator", parameters: { layout: "fullscreen" } };

/**
 * All three sync states, side by side.
 *
 * The component is `position: fixed` over the viewport bottom, so a story that
 * renders one state renders one bar and nothing to compare it with - and the
 * states are the whole point. "offline" is a warning a field officer acts on,
 * "syncing" is a fact they ignore, and "synced" must be quiet enough to stay
 * ignorable. A snapshot of this story catches the day one of them stops looking
 * different from another.
 */
export const AllSyncStates: Story = {
  render: () => (
    <Stack space="space.200">
      {(["offline", "syncing", "synced"] as const).map((status) => (
        <Stack key={status} space="space.050">
          <Text size="large" color="color.text.subtle">status=&quot;{status}&quot;</Text>
          <Inline alignBlock="center">
            <OfflineIndicator status={status} />
          </Inline>
        </Stack>
      ))}
    </Stack>
  ),
};
