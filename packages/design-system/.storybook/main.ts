import type { StorybookConfig } from '@storybook/react-vite';
import react from '@vitejs/plugin-react';

/**
 * Storybook for @usrp/design-system.
 *
 * CRITICAL DETAIL: the babel chain below is a deliberate copy of the one in
 * apps/applicant-portal/vite.config.ts and apps/officer-console/vite.config.ts.
 * Storybook must compile stories through the SAME @compiled + @atlaskit/tokens
 * pipeline as production, or the a11y and visual-regression runs would be
 * testing styles that never ship - which is a green-but-hollow gate with extra
 * steps.
 *
 * If the app pipeline changes, this changes with it. The
 * verify-compiled-extraction proof covers the app side; this comment is the
 * only thing holding the two in sync, so treat it as load-bearing.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    // Renders the axe-core panel in the UI. The BUILD-FAILING enforcement is
    // the test-runner, not this addon - an addon a human has to look at is not
    // a gate.
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: { disableTelemetry: true },
  typescript: {
    // Stories are type-checked by `pnpm typecheck` (tsconfig includes them),
    // so Storybook does not duplicate the work on every reload.
    check: false,
  },
  viteFinal: async (viteConfig) => {
    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      react({
        babel: {
          plugins: [
            '@atlaskit/tokens/babel-plugin',
            [
              '@compiled/babel-plugin',
              {
                transformerBabelPlugins: ['@atlaskit/tokens/babel-plugin'],
                importSources: ['@compiled/react', '@atlaskit/css'],
              },
            ],
          ],
        },
      }),
    ];
    return viteConfig;
  },
};

export default config;
