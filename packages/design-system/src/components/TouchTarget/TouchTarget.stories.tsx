import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Inline, Text } from '@atlaskit/primitives/compiled';
import { TouchTarget } from './index.js';
import { MIN_TOUCH_TARGET_PX } from '../../a11y/index.js';

const meta = {
  title: 'Primitives/TouchTarget',
  component: TouchTarget,
  parameters: {
    a11y: { config: { rules: [{ id: 'target-size', enabled: true }] } },
  },
} satisfies Meta<typeof TouchTarget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A deliberately small glyph - the exact case this wrapper exists to rescue. */
function SmallGlyph(): React.ReactElement {
  return <Text weight="bold">x</Text>;
}

export const WrapsASmallControl: Story = {
  args: { children: <SmallGlyph /> },
};

export const InARow: Story = {
  name: 'Several targets in a row stay independently tappable',
  render: () => (
    <Inline space="space.100">
      <TouchTarget testId="t1">
        <SmallGlyph />
      </TouchTarget>
      <TouchTarget testId="t2">
        <SmallGlyph />
      </TouchTarget>
      <TouchTarget testId="t3">
        <SmallGlyph />
      </TouchTarget>
    </Inline>
  ),
};

export const TheFloorIsDocumented: Story = {
  name: 'Floor is ' + String(MIN_TOUCH_TARGET_PX) + 'px',
  render: () => (
    <Text>
      Interactive targets never go below {MIN_TOUCH_TARGET_PX} CSS pixels. WCAG 2.1 AA asks
      for 44; this service adds 4 for outdoor, one-handed, gloved use.
    </Text>
  ),
};
