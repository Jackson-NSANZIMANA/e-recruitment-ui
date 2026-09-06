#!/usr/bin/env node
/**
 * GATE: the design-system layer stays domain-free, token-pure and thumb-sized.
 *
 * Enforces four rules over the configured roots:
 *   1. no imports from domain packages          (the split, made structural)
 *   2. no domain vocabulary at all              (incl. nationalId / nationalIdHash)
 *   3. no raw hex colour literals               (brief invariant 5)
 *   4. no interactive dimension below 48px      (WCAG 2.1 AA + field-use floor)
 *
 * Same predicates the ESLint rules use (lib/predicates.mjs), so editor and CI
 * can never disagree. Zero dependencies: runs before `pnpm install`.
 *
 * Usage:
 *   node tooling/repo-hygiene/check-boundaries.mjs [--root <repoDir>] [--config <file>]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, extname, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findForbiddenImports,
  findDomainIdentifiers,
  findRawHexColors,
  findUndersizedTouchTargets,
  MIN_TOUCH_TARGET_PX,
} from './lib/predicates.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? join(HERE, '..', '..'));
const config = JSON.parse(readFileSync(args.config ?? join(HERE, 'gates.config.json'), 'utf8'));

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.turbo',
  'coverage',
  'storybook-static',
]);

/** @type {{rule: string, file: string, line: number, detail: string}[]} */
const violations = [];
let filesScanned = 0;

// 1 + 2 + 4 --- the design-system boundary itself
const bRoots = config.boundaries?.roots ?? [];
const bExts = new Set(config.boundaries?.extensions ?? ['.ts', '.tsx']);
const minPx = Number(config.touchTargets?.minPx ?? MIN_TOUCH_TARGET_PX);

for (const r of bRoots) {
  for (const file of walk(join(root, r), bExts)) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(root, file);
    filesScanned += 1;

    for (const v of findForbiddenImports(text)) {
      violations.push({
        rule: 'no-domain-imports',
        file: rel,
        line: v.line,
        detail:
          'imports "' +
          v.specifier +
          '" - the domain-free layer may not know this package exists',
      });
    }
    for (const v of findDomainIdentifiers(text)) {
      violations.push({
        rule: 'no-domain-vocabulary',
        file: rel,
        line: v.line,
        detail: 'mentions "' + v.identifier + '" - domain vocabulary belongs in a feature slice',
      });
    }
    for (const v of findUndersizedTouchTargets(text, minPx)) {
      violations.push({
        rule: 'min-touch-target',
        file: rel,
        line: v.line,
        detail:
          v.property +
          ': ' +
          v.px +
          'px is below the ' +
          minPx +
          'px interactive floor (WCAG 2.1 AA SC 2.5.5)',
      });
    }
  }
}

// 3 --- raw hex, over a wider net than the ADS lint rule can reach
const hRoots = config.hexScan?.roots ?? [];
const hExts = new Set(config.hexScan?.extensions ?? ['.ts', '.tsx']);
const hAllow = new Set(config.hexScan?.allowPaths ?? []);

for (const r of hRoots) {
  for (const file of walk(join(root, r), hExts)) {
    const rel = relative(root, file);
    if (hAllow.has(rel)) continue;
    const text = readFileSync(file, 'utf8');
    filesScanned += 1;
    for (const v of findRawHexColors(text)) {
      violations.push({
        rule: 'no-raw-hex',
        file: rel,
        line: v.line,
        detail: 'raw colour "' + v.value + '" - use an @atlaskit/tokens token instead',
      });
    }
  }
}

console.log(
  '[boundaries] ' + filesScanned + ' file scan(s) across ' + (bRoots.length + hRoots.length) + ' root(s)',
);

if (violations.length === 0) {
  console.log('[boundaries] PASS - domain-free, token-pure, 48px floor held.');
  process.exit(0);
}

const byRule = violations.reduce((acc, v) => {
  (acc[v.rule] ??= []).push(v);
  return acc;
}, /** @type {Record<string, typeof violations>} */ ({}));

console.error('');
console.error('[boundaries] FAIL - ' + violations.length + ' violation(s)');
for (const [rule, list] of Object.entries(byRule)) {
  console.error('');
  console.error('  ' + rule + ' (' + list.length + ')');
  for (const v of list) console.error('    ' + v.file + ':' + v.line + '  ' + v.detail);
}
console.error('');
console.error('These are the same rules your editor enforces via @usrp/eslint-config.');
console.error('If a violation is genuinely correct, mark the line with one of:');
console.error('  hygiene-allow-hex | hygiene-allow-small-target | hygiene-allow-domain');
console.error('and say why in the comment. An unexplained exemption is a review failure.');
process.exit(1);

function* walk(dir, exts) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full, exts);
    else if (exts.has(extname(entry.name))) yield full;
  }
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
