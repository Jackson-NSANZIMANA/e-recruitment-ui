// ESLint 9 discovers config by walking upward from each workspace package.
// The package manifests intentionally keep their lint scripts small; this root
// entrypoint is the one config every workspace consumes.
const { base } = require('./packages/eslint-config/flat.cjs');

/**
 * Generated output is not source, and linting it is not a finding.
 *
 * WHY THIS LIST DID NOT EXIST BEFORE. Every package lints `src` (`eslint src`),
 * and a bare directory argument is enough to keep ESLint inside it. The moment a
 * repo-wide pass arrived (`eslint .` in CI, added to catch the .tsx files that
 * six non-ESLint packages never linted) that assumption broke: the run started
 * reporting raw-colour and token errors inside minified bundles in `dist/`.
 *
 * The list is the SAME set of directories every other gate skips
 * (tooling/repo-hygiene/check-boundaries.mjs `SKIP_DIRS`), because two gates that
 * disagree about what counts as source will eventually disagree about what
 * passes.
 */
const GENERATED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.turbo/**',
  // Storybook's static build: a compiled bundle of everything above.
  '**/storybook-static/**',
  // Playwright writes failure artefacts here (traces, screenshots, DOM dumps).
  '**/test-results/**',
  '**/playwright-report/**',
];

module.exports = [{ ignores: GENERATED }, ...base];
