import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { base } = require("@usrp/eslint-config/flat");

export default [
  ...base,
  // TODO: migrate AppShell from @atlaskit/side-navigation (Nav3, deprecated)
  // to @atlaskit/navigation-system (Nav4). Tracked as a separate task.
  {
    files: ["src/components/AppShell/index.tsx"],
    rules: {
      "@atlaskit/design-system/no-deprecated-imports": "off",
    },
  },
  {
    ignores: ["dist/**", "*.tsbuildinfo", "node_modules/**"],
  },
];
