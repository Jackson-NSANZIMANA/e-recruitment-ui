import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { base } = require("@usrp/eslint-config/flat");

export default [
  ...base,
  {
    ignores: ["dist/**", "*.tsbuildinfo", "node_modules/**"],
  },
];
