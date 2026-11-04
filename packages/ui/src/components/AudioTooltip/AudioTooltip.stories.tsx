import React from "react";
import { Stack, Text } from "@atlaskit/primitives/compiled";
import { AudioTooltip } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/AudioTooltip", parameters: { layout: "padded" } };

/**
 * Kinyarwanda voice guidance, the affordance that makes this service usable by
 * someone who reads Kinyarwanda more comfortably than they read instructions.
 *
 * The audio source is a tiny silent data URI rather than a fixture file: the
 * story proves the control's shape, label and 48px target, and a real recording
 * in the repository would be an asset with a licence question attached to a
 * screenshot baseline. `play()` will fail harmlessly here and the control is
 * still assertable - the a11y sweep is what checks its label and its pressed
 * state, neither of which needs audio to decode.
 */
export const WithLabel: Story = {
  render: () => (
    <Stack space="space.150">
      <Text size="large">Not sure what this asks for?</Text>
      <AudioTooltip audioSrc="data:audio/wav;base64,UklGRiQAAABXQVZF" label="Listen to this instruction" />
    </Stack>
  ),
};

/** Icon-only: the accessible name is the only thing that says what pressing it does. */
export const IconOnly: Story = {
  render: () => <AudioTooltip audioSrc="data:audio/wav;base64,UklGRiQAAABXQVZF" />,
};
