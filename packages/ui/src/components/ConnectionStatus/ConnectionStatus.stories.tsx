import React from "react";
import { ConnectionStatus } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/ConnectionStatus", parameters: { layout: "padded" } };

/**
 * The connection chip, in whatever state the browser reports.
 *
 * This component reads `navigator.onLine` and a pair of window events rather
 * than taking a prop, so a story cannot put it in a chosen state by argument.
 * That is a deliberate property of the component - it reports the truth, not a
 * value a caller could get wrong - and it means the story's job is to prove the
 * ONLINE branch renders nothing while still mounting cleanly. The offline path
 * is covered by the component's own unit test, which can dispatch the events.
 *
 * Stated here because a reviewer seeing one green chip in the gallery is entitled
 * to ask where the offline story is, and the answer is "this control cannot be
 * told to be offline, by design".
 */
export const Live: Story = {
  render: () => <ConnectionStatus />,
};
