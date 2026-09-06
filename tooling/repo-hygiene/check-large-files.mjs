#!/usr/bin/env node
/**
 * GATE: no tracked file may exceed the size ceiling in gates.config.json.
 *
 * This is the gate that would have stopped a 70.45 MiB vendored zip from being
 * committed, and it is why purge-vendor-zip.sh exists as a cure rather than a
 * habit. Git history is append-only in practice: a large blob is a permanent
 * tax on every clone, every CI checkout and every fork, forever, and the only
 * removal is a history rewrite that invalidates every existing clone.
 *
 * Inspects the git INDEX, not the working tree, so an untracked local build
 * artefact can never fail someone's run. Zero dependencies.
 *
 * Usage:
 *   node tooling/repo-hygiene/check-large-files.mjs [--root <dir>] [--max-bytes <n>]
 */
import { execFileSync } from 'node:child_process';
import { statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? join(HERE, '..', '..'));
const config = loadConfig(args.config ?? join(HERE, 'gates.config.json'));
const maxBytes = Number(args['max-bytes'] ?? config?.largeFiles?.maxBytes ?? 5 * 1024 * 1024);
const allow = new Set(config?.largeFiles?.allow ?? []);

let tracked;
try {
  tracked = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
} catch {
  console.error('[large-files] ERROR not a git repository (or git unavailable): ' + root);
  process.exit(2);
}

const offenders = [];
for (const rel of tracked) {
  if (allow.has(rel)) continue;
  const abs = join(root, rel);
  if (!existsSync(abs)) continue; // deleted-but-staged, or a submodule pointer
  let size;
  try {
    const s = statSync(abs);
    if (!s.isFile()) continue;
    size = s.size;
  } catch {
    continue;
  }
  if (size > maxBytes) offenders.push({ rel, size });
}

offenders.sort((a, b) => b.size - a.size);

console.log('[large-files] ceiling ' + mb(maxBytes) + ' | ' + tracked.length + ' tracked file(s) inspected');

if (offenders.length === 0) {
  console.log('[large-files] PASS - no tracked file exceeds the ceiling.');
  process.exit(0);
}

console.error('');
console.error('[large-files] FAIL - ' + offenders.length + ' file(s) over ' + mb(maxBytes) + ':');
for (const o of offenders) console.error('  ' + mb(o.size).padStart(10) + '  ' + o.rel);
console.error('');
console.error('A large blob is permanent: removing it later needs a history rewrite');
console.error('that breaks every existing clone. See tooling/repo-hygiene/PURGE-RUNBOOK.md');
console.error('for what that costs. Options now, in order of preference:');
console.error('  1. Do not commit it. Fetch it at build time, or read the published package.');
console.error('  2. If it is genuinely required, justify it in gates.config.json > largeFiles.allow.');
process.exit(1);

function mb(n) {
  return (n / 1048576).toFixed(2) + ' MiB';
}
function loadConfig(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
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
