import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { base, designSystemPackage } = require('@usrp/eslint-config/flat');

/**
 * The design-system package is linted more strictly than anything else in the
 * repo: the shared ADS baseline PLUS the boundary rules that make "domain-free"
 * a mechanical property instead of a promise in a README.
 */
export default [
  ...base,
  ...designSystemPackage,
  // NOTE: no per-file relaxations, deliberately. An override here that
  // check-boundaries.mjs does not also know about would mean the editor and CI
  // disagree, which is the exact drift this repo's doctrine exists to prevent.
  // Stories live under src/ and are held to the same boundary as components.
  {
    ignores: ['dist/**', 'storybook-static/**', '*.tsbuildinfo', 'node_modules/**'],
  },
];
