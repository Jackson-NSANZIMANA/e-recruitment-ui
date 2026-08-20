#!/usr/bin/env node
/**
 * Ground-truth sweep for Compiled `cssMap` static-analysis violations.
 * Usage: node scan-cssmap.js <rootDir>
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const ROOT = process.argv[2] || 'src';
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);

// Must match vite.config.ts exactly — scanning with a different plugin
// chain than production produces false positives/negatives.
const babelOptions = {
  babelrc: false,
  configFile: false,
  presets: [require.resolve('@babel/preset-typescript'), require.resolve('@babel/preset-react')],
  plugins: [
    require.resolve('@atlaskit/tokens/babel-plugin'),
    [require.resolve('@compiled/babel-plugin'), {
      transformerBabelPlugins: [require.resolve('@atlaskit/tokens/babel-plugin')],
      importSources: ['@compiled/react', '@atlaskit/css'],
    }],
  ],
};

// Only these are genuine cssMap staticness violations. Anything else that
// throws is a different problem and must not be reported — or fixed — as
// if it were a cssMap issue.
const CSSMAP_ERROR_SIGNATURES = [
  'must be statically defined',
  'Spread element is not supported in CSS Map',
  'CSS Map must be declared at the top-most scope',
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const candidates = walk(ROOT).filter((f) => /\bcssMap\s*\(/.test(fs.readFileSync(f, 'utf8')));
const violations = [];
const otherErrors = [];

for (const file of candidates) {
  try {
    babel.transformSync(fs.readFileSync(file, 'utf8'), { filename: file, ...babelOptions });
  } catch (err) {
    const msg = err.message || String(err);
    const line = (msg.match(/\((\d+):(\d+)\)/) || [])[1] || '?';
    const entry = { file, line, message: msg.split('\n').slice(0, 2).join(' ').trim() };
    (CSSMAP_ERROR_SIGNATURES.some((s) => msg.includes(s)) ? violations : otherErrors).push(entry);
  }
}

console.log(`Scanned ${candidates.length} file(s) containing cssMap(...) under "${ROOT}"\n`);
if (violations.length === 0) {
  console.log('No cssMap staticness violations found.');
} else {
  console.log(`${violations.length} cssMap violation(s):\n`);
  violations.forEach((v) => console.log(`  ${v.file}:${v.line}\n    ${v.message}\n`));
}
if (otherErrors.length > 0) {
  console.log(`\n${otherErrors.length} file(s) failed for OTHER reasons (not cssMap — investigate separately):\n`);
  otherErrors.forEach((e) => console.log(`  ${e.file}:${e.line}\n    ${e.message}\n`));
}
process.exit(violations.length > 0 ? 1 : 0);
