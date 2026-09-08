// ESLint 9 discovers config by walking upward from each workspace package.
// The package manifests intentionally keep their lint scripts small; this root
// entrypoint is the one config every workspace consumes.
const { base } = require('./packages/eslint-config/flat.cjs');

module.exports = base;
