import React from "react";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { statusLozenge } from "../../tokens/usrp-tokens.js";
import { ApplicationStatusBadge } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies, so the story shape is declared locally - the same convention
// S13.stories.tsx and National.stories.tsx already use.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/ApplicationStatusBadge", parameters: { layout: "centered" } };

/**
 * EVERY status, not a representative three.
 *
 * A status badge is a mapping, and a mapping is only proven by walking its whole
 * domain: the interesting failures are the statuses nobody remembers to look at
 * (WALK_IN_* arrived later than the rest), and a story that shows three of them
 * would stay green while the nineteenth rendered the fallback grey.
 */
export const EveryStatus: Story = {
  render: () => (
    <Stack space="space.200">
      {Object.keys(statusLozenge).map((status) => (
        <Inline key={status} space="space.100" alignBlock="center">
          <ApplicationStatusBadge status={status} />
          <Text size="large" color="color.text.subtle">{status}</Text>
        </Inline>
      ))}
    </Stack>
  ),
};

/**
 * The three shapes a caller actually reaches: a known status, an unknown string
 * (a server that added a status before the client knew it), and null (no
 * application yet). All three must render, and none may render as blank space -
 * an invisible badge reads as "nothing to do here".
 */
export const KnownUnknownAndAbsent: Story = {
  render: () => (
    <Inline space="space.200" alignBlock="center">
      <ApplicationStatusBadge status="ADJUDICATION_REVIEW" />
      <ApplicationStatusBadge status="SOMETHING_NEW_FROM_THE_SERVER" />
      <ApplicationStatusBadge status={null} />
    </Inline>
  ),
};
