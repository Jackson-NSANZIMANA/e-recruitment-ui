import type { StorybookConfig } from "@storybook/react-vite";
import compiled from "@compiled/vite-plugin";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)", "../../ui/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  typescript: { check: false },
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    // Pre-bundle every story's dependencies at startup. Without this, the first
    // story that imports a not-yet-optimised package (the @usrp/ui state stories
    // pull in empty-state, dynamic-table, modal-dialog...) makes Vite re-optimise
    // and RELOAD the page mid-test, which the test-runner reports as
    // "globalThis.__getContext is not a function".
    optimizeDeps: {
      ...viteConfig.optimizeDeps,
      entries: ["src/**/*.stories.@(ts|tsx)", "../ui/src/**/*.stories.@(ts|tsx)"],
    },
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
