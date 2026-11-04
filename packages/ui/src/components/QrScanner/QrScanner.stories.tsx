import React from "react";
import { QrScanner } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/QrScanner", parameters: { layout: "fullscreen" } };

/**
 * The gate scanner, in its resting state.
 *
 * It renders the manual-entry fallback and a "start scanning" action, not a live
 * camera: `getUserMedia` needs a permission prompt and a real device, neither of
 * which exists in a headless screenshot run. Capturing the resting state is
 * still worth doing, because it is the state a field officer sees when the
 * camera is unavailable - the one where the manual code field is the only way
 * through the gate, and therefore the one that must never lose its label or its
 * 48px targets.
 *
 * The scan path and the camera-error path are covered by unit tests that can
 * stub `getUserMedia`; a story cannot.
 */
export const Resting: Story = {
  render: () => <QrScanner onScan={() => undefined} onError={() => undefined} />,
};
