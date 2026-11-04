import React from "react";
import { Stack, Text } from "@atlaskit/primitives/compiled";
import { MemoryRouter } from "react-router-dom";
import { RouterLink } from "./index.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook
// dependencies.
interface Story {
  readonly name?: string;
  readonly parameters?: Record<string, unknown>;
  readonly render: () => React.ReactElement;
}
export default { title: "Components/RouterLink", parameters: { layout: "padded" } };

/**
 * The adapter that makes every ADS `href` a client-side navigation.
 *
 * It is wired into `AppProvider.routerLinkComponent`, so it is invisible in
 * production - which is exactly why it needs a story: the day the branch
 * between `<Link>` and `<a>` inverts, every internal link in the product becomes
 * a full page reload and nothing else in the suite notices.
 *
 * Wrapped in a `MemoryRouter` because the internal branch renders react-router's
 * `<Link>`, which requires a router context. That requirement IS the behaviour
 * under test: if the internal branch ever stopped using the router, this story
 * would still render, and the anchors below would still point at the right
 * hrefs - but the client-side navigation would be gone, and the spec beside this
 * file in the officer console asserts that it is not.
 */
export const InternalAndExternal: Story = {
  render: () => (
    <MemoryRouter>
      <Stack space="space.150">
        <Text size="large" color="color.text.subtle">Internal - routed in the app</Text>
        <RouterLink href="/applications">Applications</RouterLink>
        <Text size="large" color="color.text.subtle">External - falls through to a plain anchor</Text>
        <RouterLink href="https://www.gov.rw">gov.rw</RouterLink>
      </Stack>
    </MemoryRouter>
  ),
};
