import type { StorybookConfig } from "@storybook/react-vite";
import compiled from "@compiled/vite-plugin";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  typescript: { check: false },
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    plugins: [
      compiled({
        transformerBabelPlugins: [["@atlaskit/tokens/babel-plugin"]],
        importSources: ["@compiled/react", "@atlaskit/css"],
        extract: true,
        sortShorthand: true,
      }),
      ...(viteConfig.plugins ?? []),
    ],
  }),
};

export default config;
