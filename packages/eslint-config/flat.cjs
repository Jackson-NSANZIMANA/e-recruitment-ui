// @ts-check
// ESLint 9 flat config - consumed by each app/package via createRequire.
// Bundles the TypeScript parser so consumers do not wire it themselves.
//
// PLUGIN / RULE ISOLATION (unchanged, still load-bearing):
//   flat_us bundles an older copy of @atlaskit/design-system missing rules
//   present in the installed v16.10.0 (e.g. no-css-map-scoped). To avoid the
//   version skew, each plugin is registered from its own preset:
//     @atlaskit/design-system         -> flat_ds.plugins  (v16.10.0, self-consistent)
//     @atlaskit/ui-styling-standard   -> flat_us.plugins  (self-consistent)
//   DS rules come exclusively from flat_ds; US rules exclusively from flat_us
//   (filtered to @atlaskit/ui-styling-standard/* keys only).
//
// WHY ADS LINT IS AN ERROR HERE WHEN THE BACKEND DEFERRED ESLINT ENTIRELY
// ----------------------------------------------------------------------
// docs/architecture/ci-quality-gate.md records a deliberate backend decision:
// "No eslint revival." That was correct there. The backend's correctness lives
// in types, RLS policies and runnable selfchecks; a lint pass would have added
// ceremony, not proof.
//
// The frontend does not inherit that pass, because the frontend's correctness
// contract IS design-system conformance. There is no runtime assertion that
// catches a hardcoded #0052CC, a styled raw <div>, or a colour that fails
// contrast in high-contrast mode. TypeScript happily compiles all three. The
// only mechanism that catches them before a citizen meets them is lint, so lint
// is the frontend's equivalent of the backend's selfchecks - and a selfcheck
// that reports "warning" is not a selfcheck.
//
// Hence: every ADS/US rule the plugins ship is promoted to "error", with a
// short, named, justified list of exceptions below. No opinion is expressed
// rule-by-rule, which matters for a second reason - when the plugin version
// bumps and adds rules, the new rules arrive as ERRORS by default instead of
// silently landing as warnings nobody reads.

const ds = require('@atlaskit/eslint-plugin-design-system');
const us = require('@atlaskit/eslint-plugin-ui-styling-standard');
const compiled = require('@compiled/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const usrp = require('./rules/index.cjs');

const flat_ds = ds.configs['recommended/flat'];
const flat_us = us.configs['flat/recommended'];

// Only the US plugin's own rules - drop @atlaskit/design-system/* keys that
// flat_us includes via its bundled (older) DS copy.
const usOwnRules = Object.fromEntries(
  Object.entries(flat_us.rules ?? {}).filter(([key]) =>
    key.startsWith('@atlaskit/ui-styling-standard/'),
  ),
);

/**
 * Promote every rule in a preset to "error", preserving any options array.
 *
 * Written as a transform rather than a hand-typed rule list on purpose. A
 * hand-typed list (a) goes stale the moment the plugin version changes, and
 * (b) hard-fails ESLint on a single typo'd rule name. This cannot do either.
 *
 * @param {Record<string, unknown>} rules
 * @returns {Record<string, unknown>}
 */
function toError(rules) {
  return Object.fromEntries(
    Object.entries(rules).map(([name, setting]) => {
      if (Array.isArray(setting)) return [name, ['error', ...setting.slice(1)]];
      if (setting === 'off' || setting === 0) return [name, setting];
      return [name, 'error'];
    }),
  );
}

/**
 * The ONLY rules allowed to be softer than "error", each with a reason.
 *
 * Every entry is a debt with an exit condition, not a preference. Anything not
 * listed here is an error, including rules that do not exist yet.
 */
const JUSTIFIED_EXCEPTIONS = {
  // Deprecated tokens still render correctly; a token migration is a tracked
  // piece of product work, and breaking every build the day ADS deprecates a
  // token would make upgrades hostile. Warn, migrate, then delete this line.
  '@atlaskit/design-system/no-deprecated-design-token-usage': 'warn',

  // Flags working, accessible code in order to push an ADS component-API
  // upgrade (Field -> SimpleField and friends). Real work, separately scoped;
  // not a correctness defect, so not a build failure.
  '@atlaskit/design-system/use-simple-field': 'warn',
  '@atlaskit/design-system/use-simple-form': 'warn',
  '@atlaskit/design-system/use-character-counter-field': 'warn',
  '@atlaskit/design-system/use-textfield-autocomplete': 'warn',

  // no-placeholder is an a11y improvement that needs copy decisions per field
  // (a label is not a placeholder rewritten). Warn until the forms are revised.
  '@atlaskit/design-system/no-placeholder': 'warn',
};

/** @type {import('eslint').Linter.Config[]} */
const base = [
  // Single plugin registration - each from its own self-consistent preset.
  {
    plugins: {
      '@atlaskit/design-system': flat_ds.plugins['@atlaskit/design-system'],
      '@atlaskit/ui-styling-standard': flat_us.plugins['@atlaskit/ui-styling-standard'],
      '@compiled': compiled,
      usrp,
    },
    rules: {
      ...toError(flat_ds.rules ?? {}),
      ...toError(usOwnRules),
      ...JUSTIFIED_EXCEPTIONS,
    },
  },

  // TypeScript parser for .ts / .tsx files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // Repo-wide correctness, above and beyond the ADS presets.
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // The invariant, stated twice on purpose: ensure-design-token-usage
      // covers styles, usrp/no-raw-hex covers everywhere else a colour can
      // hide (a manifest object, an inline SVG string, a chart config).
      '@atlaskit/design-system/ensure-design-token-usage': 'error',
      '@atlaskit/ui-styling-standard/enforce-style-prop': 'error',
      '@atlaskit/ui-styling-standard/no-unsafe-values': 'error',
      '@compiled/no-js-xcss': 'error',
      'usrp/no-raw-hex': 'error',

      // Accessibility floor, applied to every package rather than only the
      // design system: a 40px target in a feature slice is just as unusable.
      'usrp/min-touch-target': 'error',
    },
  },
];

/**
 * EXTRA rules for @usrp/design-system only. Appended by that package's
 * eslint.config.js. This is what makes "domain-free" mechanical.
 */
const designSystemPackage = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'usrp/no-domain-imports': 'error',
      'usrp/no-domain-vocabulary': 'error',
    },
  },
];

module.exports = { base, designSystemPackage, toError, JUSTIFIED_EXCEPTIONS };
