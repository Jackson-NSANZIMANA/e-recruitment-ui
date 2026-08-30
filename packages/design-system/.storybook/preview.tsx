import React from 'react';
import type { Preview } from '@storybook/react';
import '@atlaskit/css-reset';
import { COLOR_MODE } from '../src/a11y/index.js';

/**
 * Global story context.
 *
 * The theme is pinned to positive polarity (light) and there is no dark-mode
 * toggle, on purpose. See src/a11y/index.ts: dark surfaces lose contrast on
 * cheap LCD panels in direct sunlight, which is the actual environment this
 * service is used in. A dark theme needs a field-readability study, not a
 * preference toggle in Storybook.
 */
const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: { disable: true },
    a11y: {
      // WCAG 2.1 AA is the floor for a government service, so the rule tags
      // are pinned rather than left at the addon default.
      config: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      },
      options: {},
    },
  },
  globals: { colorMode: COLOR_MODE },
  decorators: [
    (Story) => (
      <div data-color-mode={COLOR_MODE}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
