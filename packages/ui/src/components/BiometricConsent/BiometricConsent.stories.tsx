import React from "react";
import { Text } from "@atlaskit/primitives/compiled";
import { BiometricConsent } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/BiometricConsent", parameters: { layout: "fullscreen" } };

/**
 * The consent gate, open.
 *
 * This is the one dialog in the product that must be readable before it is
 * dismissable: biometric collection is lawful only after an explicit,
 * informed consent, so a clipped paragraph or a decline action that is visually
 * subordinate to the accept one is a legal defect, not a design preference. A
 * snapshot of this story is the cheapest way to notice that it stopped fitting.
 */
export const Open: Story = {
  render: () => (
    <BiometricConsent
      isOpen
      agencyName="Rwanda Defence Force"
      onConsent={() => undefined}
      onDecline={() => undefined}
    />
  ),
};

/**
 * Closed: renders nothing at all. Asserted rather than assumed, because a modal
 * that leaks a stray backdrop when `isOpen` is false traps every click on the
 * page behind it.
 */
export const Closed: Story = {
  render: () => (
    <>
      <Text size="large">The page behind the dialog, fully interactive.</Text>
      <BiometricConsent
        isOpen={false}
        agencyName="Rwanda Defence Force"
        onConsent={() => undefined}
        onDecline={() => undefined}
      />
    </>
  ),
};
