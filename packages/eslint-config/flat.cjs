// @ts-check
// ESLint 9 flat config — consumed by each app/package via createRequire.
// Bundles TypeScript parser so consumers don't need to wire it themselves.
//
// Plugin / rule isolation:
//   flat_us bundles an older copy of @atlaskit/design-system that is missing
//   rules present in the installed v16.10.0 (e.g. no-css-map-scoped). To avoid
//   the version skew, each plugin is registered from its own preset:
//     @atlaskit/design-system   → flat_ds.plugins  (v16.10.0 — self-consistent)
//     @atlaskit/ui-styling-standard → flat_us.plugins (self-consistent)
//   DS rules come exclusively from flat_ds; US rules come exclusively from
//   flat_us (filtered to @atlaskit/ui-styling-standard/* keys only).

const ds = require("@atlaskit/eslint-plugin-design-system");
const us = require("@atlaskit/eslint-plugin-ui-styling-standard");
const compiled = require("@compiled/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

const flat_ds = ds.configs["recommended/flat"];
const flat_us = us.configs["flat/recommended"];

// Only the US plugin's own rules — drop @atlaskit/design-system/* keys that
// flat_us includes via its bundled (older) DS copy.
const usOwnRules = Object.fromEntries(
  Object.entries(flat_us.rules ?? {}).filter(([key]) =>
    key.startsWith("@atlaskit/ui-styling-standard/"),
  ),
);

/** @type {import('eslint').Linter.Config[]} */
const base = [
  // Single plugin registration — each from its own self-consistent preset.
  {
    plugins: {
      "@atlaskit/design-system": flat_ds.plugins["@atlaskit/design-system"],
      "@atlaskit/ui-styling-standard":
        flat_us.plugins["@atlaskit/ui-styling-standard"],
      "@compiled": compiled,
    },
    rules: {
      ...flat_ds.rules,
      ...usOwnRules,
    },
  },
  // TypeScript parser for .ts / .tsx files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  // USRP overrides — tighten correctness rules; turn off opinionated rules that
  // require deep API/component refactoring beyond the current sprint scope.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // ── Correctness: tighten ──────────────────────────────────────────────
      "@atlaskit/design-system/ensure-design-token-usage": "error",
      "@atlaskit/design-system/no-deprecated-design-token-usage": "warn",
      "@atlaskit/ui-styling-standard/enforce-style-prop": "error",
      "@atlaskit/ui-styling-standard/no-unsafe-values": "warn",
      "@atlaskit/design-system/use-heading": "warn",
      "@compiled/no-js-xcss": "warn",

      // ── Opinionated API preferences: off ─────────────────────────────────
      // These flag working, accessible code for ADS API upgrades that are
      // best tracked as separate product work, not blocking lint CI.
      "@atlaskit/design-system/use-simple-field": "off",
      "@atlaskit/design-system/use-simple-form": "off",
      "@atlaskit/design-system/use-textfield-autocomplete": "off",
      "@atlaskit/design-system/use-character-counter-field": "off",
      "@atlaskit/design-system/no-placeholder": "off",
      "@atlaskit/design-system/use-primitives-text": "off",
      "@atlaskit/design-system/no-html-button": "off",
      "@atlaskit/design-system/no-html-image": "off",
      "@atlaskit/design-system/use-tokens-typography": "off",
    },
  },
];

module.exports = { base };
