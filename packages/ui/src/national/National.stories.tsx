import React from "react";
import { Stack, Text } from "@atlaskit/primitives/compiled";
import { FlagRule } from "./FlagRule.js";
import { HandlingMarking } from "./HandlingMarking.js";
import { ImigongoBand } from "./ImigongoBand.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { NationalFooter } from "./NationalFooter.js";
import { NationalFrame } from "./NationalFrame.js";
import { NationalHeader } from "./NationalHeader.js";
import { OfficialBanner } from "./OfficialBanner.js";
import { OfficialDocument } from "./OfficialDocument.js";

// Types come from the Storybook host (design-system); ui stays free of Storybook dependencies.
interface Story { readonly name?: string; readonly parameters?: Record<string, unknown>; readonly render: () => React.ReactElement }
export default { title: "National/Identity", parameters: { layout: "fullscreen" } };

/** The citizen frame: official-site banner, national lockup, language switch, statutory footer. */
export const PublicFrame: Story = {
  render: () => (
    <NationalFrame audience="public">
      <Stack space="space.200">
        <Text>Page content</Text>
      </Stack>
    </NationalFrame>
  ),
};

/** The staff frame used by sign-in and activation, with the handling marking. */
export const StaffFrame: Story = {
  render: () => (
    <NationalFrame audience="staff" agency="RDF" serviceName="Officer Console">
      <Text>Sign-in form</Text>
    </NationalFrame>
  ),
};

export const Header: Story = {
  render: () => <NationalHeader agency="RNP" end={<LanguageSwitcher />} />,
};

export const Banner: Story = { render: () => <OfficialBanner /> };

export const Marking: Story = { render: () => <HandlingMarking /> };

export const Footer: Story = { render: () => <NationalFooter /> };

export const Ornament: Story = {
  render: () => (
    <Stack space="space.200">
      <FlagRule />
      <FlagRule weight="thick" />
      <ImigongoBand />
    </Stack>
  ),
};

/** The exam pass anatomy with example values: RCS, serial RCS-26-HYE-000412. */
export const ExamPassDocument: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <OfficialDocument title="Exam pass" agency="RCS" serial="RCS-26-HYE-000412" verificationFields={["261114"]}>
      <Stack space="space.100">
        <Text>Venue: example venue</Text>
        <Text>Date: 2026-11-14 · Reporting: 06:00</Text>
      </Stack>
    </OfficialDocument>
  ),
};
