import React from "react";
import { Text } from "@atlaskit/primitives/compiled";
import { ErrorBoundary } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/ErrorBoundary", parameters: { layout: "padded" } };

function Explodes(): React.ReactElement {
  throw new Error("A component in this region failed to render.");
}

/**
 * The caught state, rendered deliberately.
 *
 * An error boundary is the one component whose interesting branch cannot be
 * reached by passing props - it needs a child that actually throws. The story
 * supplies one so the fallback is visible in the gallery, in the a11y sweep and
 * in a snapshot. Without this, the fallback is the only screen in the product
 * nobody has ever looked at, and it is the screen a citizen sees when something
 * goes wrong.
 *
 * `onError` is wired to a no-op rather than left off so the story cannot print a
 * React console error that a reviewer would learn to ignore.
 */
export const Caught: Story = {
  render: () => (
    <ErrorBoundary onError={() => undefined}>
      <Explodes />
    </ErrorBoundary>
  ),
};

/** The fallback's own copy, when the caller wants to say what failed. */
export const CustomMessage: Story = {
  render: () => (
    <ErrorBoundary
      title="The queue could not be drawn"
      fallbackMessage="Refresh the page. Nothing you have saved will be lost."
      onError={() => undefined}
    >
      <Explodes />
    </ErrorBoundary>
  ),
};

/** The happy path: children pass straight through and nothing is added. */
export const Healthy: Story = {
  render: () => (
    <ErrorBoundary>
      <Text size="large">Everything rendered.</Text>
    </ErrorBoundary>
  ),
};
