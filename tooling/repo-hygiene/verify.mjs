#!/usr/bin/env node
/**
 * The local gate. `pnpm verify:hygiene` runs this; so does CI, unmodified.
 *
 * Mirrors the backend's scripts/run-selfchecks.sh: run every proof in order,
 * report pass/fail per proof, exit non-zero on the first failure. The whole
 * point is that CI has no private copy of any of this.
 *
 *   default          - the four zero-dependency gates (no node_modules needed)
 *   --with-build     - adds the gates that require `pnpm build` output
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const withBuild = process.argv.includes('--with-build');

const gates = [
  ['large files (<=5 MiB, tracked)', 'check-large-files.mjs'],
  ['design-system boundaries + hex + 48px', 'check-boundaries.mjs'],
  ['script coverage (anti-hollow)', 'check-script-coverage.mjs'],
];

if (withBuild) {
  gates.push(['compiled build-time extraction', 'verify-compiled-extraction.mjs']);
  gates.push(['bundle size budgets (gzip)', 'check-bundle-size.mjs']);
}

const results = [];
let failedAt = null;

for (const [label, script] of gates) {
  line();
  console.log('== ' + label);
  line();
  const r = spawnSync(
    process.execPath,
    [join(HERE, script), ...process.argv.slice(2).filter((a) => a !== '--with-build')],
    { stdio: 'inherit' },
  );
  const ok = r.status === 0;
  results.push([label, ok, r.status]);
  if (!ok) {
    failedAt = label;
    break;
  }
}

console.log('');
line();
console.log('HYGIENE GATE SUMMARY');
line();
for (const [label, ok, code] of results) {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (ok ? '' : '  (exit ' + code + ')'));
}
const skipped = gates.length - results.length;
if (skipped > 0) console.log('  ....  ' + skipped + ' gate(s) not reached (fail-fast)');
console.log('');

if (failedAt) {
  console.error('GATE RED at: ' + failedAt);
  process.exit(1);
}
console.log(
  'ALL HYGIENE GATES GREEN' +
    (withBuild ? ' (including build-dependent gates)' : ' (static gates; run with --with-build after `pnpm build`)'),
);

function line() {
  console.log('-'.repeat(72));
}
