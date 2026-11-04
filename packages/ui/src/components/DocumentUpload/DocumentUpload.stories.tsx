import React from "react";
import { Stack, Text } from "@atlaskit/primitives/compiled";
import { DocumentUpload } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/DocumentUpload", parameters: { layout: "padded" } };

/**
 * The upload control with the constraints a real form passes it.
 *
 * `acceptedTypes` and `maxSizeBytes` are not decoration: the component validates
 * in the browser before a byte leaves the device, which is the only place an
 * applicant on a metered connection finds out their 6 MB scan is too large. A
 * story with no accepted types proves the control renders; this one proves the
 * constraint text does.
 */
export const Constrained: Story = {
  render: () => (
    <Stack space="space.200">
      <Text size="large">Attach your national ID scan</Text>
      <DocumentUpload
        acceptedTypes={[".pdf", ".jpg", "image/png"]}
        maxSizeBytes={5 * 1024 * 1024}
        onFilesSelected={() => undefined}
      />
    </Stack>
  ),
};

/** The same control with no stated limits: every type, the 5 MB default. */
export const Unconstrained: Story = {
  render: () => (
    <DocumentUpload onFilesSelected={() => undefined} onValidationError={() => undefined} />
  ),
};
