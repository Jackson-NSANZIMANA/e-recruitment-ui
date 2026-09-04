#!/usr/bin/env node
/**
 * GATE: every workspace package declares the scripts the aggregate gate runs.
 *
 * THE POINT. `turbo run test` reports success for a package that has no `test`
 * script. The backend's audit found `pnpm test` printing "6 successful" while
 * running ZERO tests, and concluded that a green-but-hollow gate is worse than
 * no gate. The backend's fix was to delete the hollow jobs. The frontend cannot
 * take that exit: ADS conformance and accessibility ARE the frontend's
 * correctness contract, so `lint` and `test` have to exist and have to be real.
 *
 * So this gate closes the hole from the other side. It asserts that the set of
 * packages `pnpm test` / `pnpm lint` claims to cover equals the set that
 * actually declares those scripts. Known gaps live in gates.config.json as an
 * exemption ledger with a named owner and a reason. A package absent from that
 * ledger is strict by default, which means a NEW package cannot be born hollow.
 *
 * Zero dependencies. Reads pnpm-workspace.yaml with a deliberately tiny parser
 * (the file is a 3-line list; a YAML dependency would be theatre).
 *
 * Usage: node tooling/repo-hygiene/check-script-coverage.mjs [--root <dir>]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? join(HERE, '..', '..'));
const config = JSON.parse(readFileSync(args.config ?? join(HERE, 'gates.config.json'), 'utf8'));
const required = config.scriptCoverage?.required ?? ['typecheck', 'lint', 'test'];
const exempt = config.scriptCoverage?.exempt ?? {};

const globs = readWorkspaceGlobs(join(root, 'pnpm-workspace.yaml'));
if (globs.length === 0) {
  console.error('[script-coverage] ERROR no workspace globs found in pnpm-workspace.yaml');
  process.exit(2);
}

const packages = [];
for (const glob of globs) {
  // Only the `dir/*` shape is used by this repo; anything else is refused
  // loudly rather than silently mis-scanned.
  const m = /^(.*)\/\*$/.exec(glob);
  if (!m) {
    console.error(
      '[script-coverage] ERROR unsupported workspace glob "' +
        glob +
        '" - extend this parser deliberately.',
    );
    process.exit(2);
  }
  const parent = join(root, m[1]);
  if (!existsSync(parent)) continue;
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(parent, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    packages.push({
      name: pkg.name ?? relative(root, dirname(pkgPath)),
      dir: relative(root, dirname(pkgPath)),
      scripts: pkg.scripts ?? {},
    });
  }
}

packages.sort((a, b) => a.dir.localeCompare(b.dir));

const failures = [];
const ledger = [];

for (const pkg of packages) {
  const allowed = new Set(exempt[pkg.name]?.scripts ?? []);
  const missing = required.filter((s) => !pkg.scripts[s]);
  const unexcused = missing.filter((s) => !allowed.has(s));
  const excused = missing.filter((s) => allowed.has(s));

  if (unexcused.length > 0) failures.push({ pkg, missing: unexcused });
  if (excused.length > 0) {
    ledger.push({
      pkg,
      excused,
      reason: exempt[pkg.name]?.reason ?? '(no reason recorded)',
      owner: exempt[pkg.name]?.owner ?? '(unowned)',
    });
  }
  // An exemption for a script that now EXISTS is stale bookkeeping. Say so.
  const stale = [...allowed].filter((s) => pkg.scripts[s]);
  if (stale.length > 0) {
    console.log(
      '[script-coverage] NOTE ' +
        pkg.name +
        ' now declares ' +
        stale.join(', ') +
        ' - drop it from the exemption ledger.',
    );
  }
}

console.log(
  '[script-coverage] ' + packages.length + ' workspace package(s); required scripts: ' + required.join(', '),
);

if (ledger.length > 0) {
  console.log('');
  console.log('  KNOWN GAPS (declared debt, each with an owner - not a pass):');
  for (const l of ledger) {
    console.log(
      '    ' + l.pkg.name.padEnd(24) + ' missing ' + l.excused.join('+').padEnd(12) + ' [' + l.owner + '] ' + l.reason,
    );
  }
  const totalDebt = ledger.reduce((n, l) => n + l.excused.length, 0);
  console.log('');
  console.log('  ' + totalDebt + ' undeclared-script gap(s) remain. `pnpm lint` and `pnpm test` do NOT');
  console.log('  cover these packages. Treat any "all green" claim as covering the rest only.');
}

if (failures.length === 0) {
  console.log('[script-coverage] PASS - no package is hollow beyond the recorded ledger.');
  process.exit(0);
}

console.error('');
console.error(
  '[script-coverage] FAIL - ' + failures.length + ' package(s) silently skipped by the aggregate gate:',
);
for (const f of failures) {
  console.error('  ' + f.pkg.dir + ' (' + f.pkg.name + ') missing: ' + f.missing.join(', '));
}
console.error('');
console.error('`turbo run <task>` reports success for a package with no such script.');
console.error('Either add a real script, or record the gap in gates.config.json >');
console.error('scriptCoverage.exempt with an owner and a reason. Do not add an');
console.error('`echo "no tests"` stub: that is the hollow gate wearing a disguise.');
process.exit(1);

function readWorkspaceGlobs(file) {
  if (!existsSync(file)) return [];
  const out = [];
  let inPackages = false;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '');
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const m = /^\s*-\s*["']?([^"'\s]+)["']?\s*$/.exec(line);
      if (m) {
        out.push(m[1]);
        continue;
      }
      if (line.trim() !== '') break;
    }
  }
  return out;
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
