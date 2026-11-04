import React from "react";
import Button from "@atlaskit/button/new";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { WizardLayout } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/WizardLayout", parameters: { layout: "fullscreen" } };

const STEPS = ["Personal details", "Documents", "Review"] as const;

/**
 * A wizard mid-way through, which is the state that matters: the step indicator
 * has to say both "where am I" and "how much is left" without a colour alone
 * carrying either answer.
 *
 * The footer is a slot rather than an internal implementation because the
 * buttons belong to the form's own submit logic - a wizard that owned its Next
 * button would have to know how to validate a step it cannot see.
 */
export const MidStep: Story = {
  render: () => (
    <WizardLayout
      title="Apply for enlistment"
      currentStep={1}
      steps={STEPS}
      footer={
        <Inline space="space.100">
          <Button appearance="default">Back</Button>
          <Button appearance="primary">Continue</Button>
        </Inline>
      }
    >
      <Stack space="space.150">
        <Text size="large">Upload the two documents the checklist names.</Text>
        <Text size="large" color="color.text.subtle">
          Nothing is submitted until the final step.
        </Text>
      </Stack>
    </WizardLayout>
  ),
};

/**
 * The first step, where the indicator has no completed segment yet. Included
 * because "step 1 of 3" with a zero-width progress bar is the easiest state to
 * render wrong and the first one every applicant sees.
 */
export const FirstStep: Story = {
  render: () => (
    <WizardLayout
      title="Apply for enlistment"
      currentStep={0}
      steps={STEPS}
      footer={<Button appearance="primary">Continue</Button>}
    >
      <Text size="large">Tell us who you are.</Text>
    </WizardLayout>
  ),
};
