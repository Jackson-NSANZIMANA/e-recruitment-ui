#!/usr/bin/env node
/**
 * GATE: per-app gzipped payload ceilings.
 *
 * Measured GZIPPED, because gzip is what a recruit on a metered Rwandan mobile
 * connection actually downloads; raw byte counts flatter the ADS chunk by 3-4x
 * and would make the budget decorative.
 *
 * Two ceilings per app: total shipped JS+CSS, and the single largest chunk.
 * The per-chunk ceiling is the one that matters for cold start, since a 900 KB
 * "atlaskit" chunk blocks first paint no matter how well the total looks.
 *
 * Zero dependencies (node:zlib is built in). Requires a build first.
 *
 * Usage: node tooling/repo-hygiene/check-bundle-size.mjs [--root <dir>]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? join(HERE, '..', '..'));
const config = JSON.parse(readFileSync(args.config ?? join(HERE, 'gates.config.json'), 'utf8'));

const apps = Object.entries(config.bundles ?? {}).filter(([k]) => !k.startsWith('$'));
if (apps.length === 0) {
  console.error('[bundle-size] ERROR no budgets configured.');
  process.exit(2);
}

const COUNTED = new Set(['.js', '.mjs', '.css']);
let failed = false;
let anyMeasured = false;

for (const [appPath, budget] of apps) {
  const dist = join(root, appPath, budget.distDir ?? 'dist');
  if (!existsSync(dist)) {
    console.error('[bundle-size] FAIL ' + appPath + ' - no build output at ' + relative(root, dist));
    console.error('              Run `pnpm build` first. A budget gate that skips a missing');
    console.error('              build is a budget gate that passes when the app is broken.');
    failed = true;
    continue;
  }

  const files = [...walk(dist)].filter((f) => COUNTED.has(extname(f)));
  if (files.length === 0) {
    console.error('[bundle-size] FAIL ' + appPath + ' - build output contains no JS/CSS assets.');
    failed = true;
    continue;
  }

  anyMeasured = true;
  const measured = files
    .map((f) => ({ rel: relative(dist, f), gzip: gzipSync(readFileSync(f)).length }))
    .sort((a, b) => b.gzip - a.gzip);

  const totalKb = measured.reduce((n, m) => n + m.gzip, 0) / 1024;
  const largest = measured[0];
  const largestKb = largest.gzip / 1024;
  const maxTotal = Number(budget.maxTotalGzipKb);
  const maxChunk = Number(budget.maxChunkGzipKb);

  const totalOver = totalKb > maxTotal;
  const chunkOver = largestKb > maxChunk;

  console.log('');
  console.log('  ' + appPath);
  console.log('    total gzip   ' + fmt(totalKb) + ' / ' + fmt(maxTotal) + '   ' + verdict(!totalOver));
  console.log(
    '    largest      ' + fmt(largestKb) + ' / ' + fmt(maxChunk) + '   ' + verdict(!chunkOver) + '   (' + largest.rel + ')',
  );
  console.log('    assets       ' + measured.length);
  for (const m of measured.slice(0, 5)) {
    console.log('      ' + fmt(m.gzip / 1024).padStart(12) + '  ' + m.rel);
  }

  if (totalOver || chunkOver) failed = true;
}

console.log('');
if (failed) {
  console.error('[bundle-size] FAIL - at least one app is over budget.');
  console.error('Raising a ceiling is a decision with a user cost attached; make it');
  console.error('explicitly in gates.config.json with a comment, or cut the payload');
  console.error('(route-level lazy imports and a narrower @atlaskit surface first).');
  process.exit(1);
}
if (!anyMeasured) {
  console.error('[bundle-size] ERROR nothing measured.');
  process.exit(2);
}
console.log('[bundle-size] PASS - every app within its gzipped budget.');
process.exit(0);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}
function fmt(kb) {
  return kb.toFixed(1) + ' KB';
}
function verdict(ok) {
  return ok ? 'OK' : 'OVER';
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : 'true';
      out[k] = v;
    }
  }
  return out;
}
