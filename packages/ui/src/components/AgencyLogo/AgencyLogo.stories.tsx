import React from "react";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { AgencyLogo } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/AgencyLogo", parameters: { layout: "padded" } };

/**
 * The identity layer at all three sizes: the 24px mark that sits in a page
 * breadcrumb, the 40px one in a header, the 64px one on a document.
 *
 * All three together, because the thing worth seeing is that they scale as one
 * lockup - if the type beside the emblem stopped tracking the symbol's height,
 * this row is where it shows.
 */
export const AllSizes: Story = {
  render: () => (
    <Stack space="space.400">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Stack key={size} space="space.100">
          <Text size="large" color="color.text.subtle">size=&quot;{size}&quot;</Text>
          <Inline space="space.400" alignBlock="center">
            <AgencyLogo agency="RDF" size={size} />
            <AgencyLogo agency="RNP" size={size} />
            <AgencyLogo agency="RCS" size={size} />
          </Inline>
        </Stack>
      ))}
    </Stack>
  ),
};

/**
 * Emblem only, for chrome that already names the agency in words. This variant
 * is `alt=""` on purpose: the name beside it is the accessible name, and a
 * second copy would be announced twice.
 */
export const EmblemOnly: Story = {
  render: () => (
    <Inline space="space.300" alignBlock="center">
      <AgencyLogo agency="RDF" size="md" compact />
      <AgencyLogo agency="RNP" size="md" compact />
      <AgencyLogo agency="RCS" size="md" compact />
    </Inline>
  ),
};
