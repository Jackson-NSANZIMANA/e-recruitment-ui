#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// evidence-bundle.mjs — write evidence-<sha>.json for one CI run (W0-04, S00)
//
// WHY THIS EXISTS
//
// frontend-architecture.md still quoted 27 edge operations and 588 drift
// assertions when the registry held 43 and the gate ran 877. Hand-written
// counts and SHAs rot; a bundle CI writes for every commit does not. Docs point
// here instead of restating numbers.
//
// WHAT IT RECORDS
//
//   • the commit tested, and the backend SHA it pins (ci.yml BACKEND_SHA and
//     paths.ts EDGE_BACKEND_SHA, flagged if they disagree);
//   • the edge operation inventory from packages/api-client/src/paths.ts, with
//     each operation marked typed (an operations/ or queries/ call site) or
//     untyped (a registry ID only);
//   • proofs: contract verify against the pinned backend, the surface
//     contract and the static hygiene gates, with their assertion counts;
//   • unit tests from each package's JUnit report and E2E from Playwright's
//     JSON report, every skipped test listed by name;
//   • the lockfile hash, and the result of every other CI job.
//
// DESIGN NOTES
//
//   • Zero dependencies; Node built-ins only.
//   • "Could not measure" is recorded as `not-available`, never as zero. Some
//     packages' `test` scripts run tsx selfchecks, which have no per-case
//     report; they are listed as `unreportedPackages`, not counted as zero.
//   • Exits non-zero when a proof or unit test fails or the inventory cannot be
//     read, after writing the bundle.
//
//   usage: node tooling/ci/evidence-bundle.mjs --out <dir> [--backend <dir>]
//          [--run-tests] [--run-proofs] [--e2e-dir <dir>] [--needs '<json>']
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPO = 'Jackson-NSANZIMANA/e-recruitment-ui';
const PEER = 'Jackson-NSANZIMANA/e-recruitment';
const JUNIT_DIR = 'test-results';
const JUNIT_FILE = 'unit.junit.xml';
const API_CLIENT = 'packages/api-client';
/** Every app with a Playwright suite; a missing report is never "passed". */
export const E2E_APPS = ['applicant-portal', 'officer-console', 'field-station'];

const stripAnsi = stripVTControlCharacters;
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) =>
    e[0] === '#' ? String.fromCodePoint(Number(e[1].toLowerCase() === 'x' ? `0${e.slice(1)}` : e.slice(1))) : ENTITIES[e.toLowerCase()]);

function attributes(text) {
  const out = {};
  for (const [, key, dq, sq] of text.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[key] = decodeXml(dq ?? sq);
  return out;
}

// One element tag. Attribute values are matched as quoted strings, so a raw
// `>` inside one (node:test writes failure messages unescaped there) does not
// end the tag early.
const TAG = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;

/** Parse a JUnit report (node:test or vitest) into leaf test cases. */
export function parseJUnit(xml, root = ROOT) {
  const cases = [];
  const body = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, '');
  let open = null;
  const close = () => {
    const file = open.attrs.file ?? open.attrs.classname ?? '';
    cases.push({
      name: open.attrs.name ?? '',
      file: file.startsWith('/') ? relative(root, file) : file,
      outcome: open.failure ? 'failed' : open.skipped ? 'skipped' : 'passed',
      ...(open.failure ? { reason: open.failure.slice(0, 500) } : open.skipped ? { reason: open.skipped.reason } : {}),
    });
    open = null;
  };
  for (const [, slash, name, attrText, selfClosing] of body.matchAll(TAG)) {
    if (name === 'testcase') {
      if (slash) { if (open) close(); continue; }
      open = { attrs: attributes(attrText), failure: null, skipped: null };
      if (selfClosing) close();
    } else if (open && !slash && (name === 'failure' || name === 'error')) {
      const attrs = attributes(attrText);
      open.failure ??= attrs.message || attrs.type || `<${name}> without a message`;
    } else if (open && !slash && name === 'skipped') {
      const attrs = attributes(attrText);
      open.skipped ??= { reason: attrs.message ?? attrs.type ?? '' };
    }
  }
  return cases;
}

/**
 * Flatten a Playwright JSON report. A test's outcome is Playwright's own
 * verdict: expected, skipped, unexpected (failed) or flaky (passed on retry).
 */
export function parsePlaywright(report, app) {
  const cases = [];
  const walk = (suite, file) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const outcome = { expected: 'passed', skipped: 'skipped', unexpected: 'failed', flaky: 'flaky' }[t.status] ?? t.status;
        const note = (t.annotations ?? []).find((a) => a.type === 'skip' || a.type === 'fixme');
        cases.push({
          app,
          name: spec.title,
          file: spec.file ?? file,
          project: t.projectName ?? null,
          outcome,
          ...(outcome === 'skipped' && note?.description ? { reason: note.description } : {}),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, child.file ?? file);
  };
  for (const suite of report.suites ?? []) walk(suite, suite.file);
  return cases;
}

/** Read an assertion count from a proof's own output, when it states one. */
export function assertionCount(raw) {
  const text = stripAnsi(raw);
  const total = text.match(/ALL GATES GREEN — ([\d,]+) assertions/) ?? text.match(/^\s*assertions: (\d+)$/m);
  return total ? Number(total[1].replace(/,/g, '')) : null;
}

/** Operation IDs the api-client wraps in a typed function (operations/, queries/). */
export function typedOperationIds(sources) {
  const ids = new Set();
  for (const source of sources) {
    for (const m of source.matchAll(/\.call(?:<[^(]*>)?\(\s*'([A-Za-z]+)'/g)) ids.add(m[1]);
  }
  return ids;
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function workspacePackages() {
  const listed = JSON.parse(execFileSync('pnpm', ['-r', 'ls', '--depth', '-1', '--json'], { cwd: ROOT, encoding: 'utf8' }));
  return listed
    .filter((p) => p.path !== ROOT)
    .map((p) => ({ name: p.name, dir: p.path, scripts: JSON.parse(readFileSync(join(p.path, 'package.json'), 'utf8')).scripts ?? {} }))
    .filter((p) => typeof p.scripts.test === 'string')
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Run every package's `test` script with a JUnit reporter beside its own output. */
function runTests() {
  const packages = [];
  for (const pkg of workspacePackages()) {
    const outDir = join(pkg.dir, JUNIT_DIR);
    const report = join(outDir, JUNIT_FILE);
    rmSync(report, { force: true });
    mkdirSync(outDir, { recursive: true });
    // vitest takes reporters as arguments; node:test (also under tsx) reads
    // them from NODE_OPTIONS, which vitest and plain scripts ignore.
    const extra = /^vitest\b/.test(pkg.scripts.test)
      ? ['--reporter=default', '--reporter=junit', `--outputFile.junit=${JUNIT_DIR}/${JUNIT_FILE}`]
      : [];
    console.log(`\n── ${pkg.name}: ${pkg.scripts.test}`);
    const started = Date.now();
    const result = spawnSync('pnpm', ['run', 'test', ...extra], {
      cwd: pkg.dir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS ?? '', '--test-reporter=spec', '--test-reporter-destination=stdout',
          '--test-reporter=junit', `--test-reporter-destination=${JUNIT_DIR}/${JUNIT_FILE}`].join(' ').trim(),
      },
    });
    const cases = existsSync(report) ? parseJUnit(readFileSync(report, 'utf8')) : null;
    const count = (outcome) => (cases === null ? null : cases.filter((c) => c.outcome === outcome).length);
    packages.push({
      name: pkg.name,
      exitCode: result.status,
      durationMs: Date.now() - started,
      tests: cases === null ? null : cases.length,
      passed: count('passed'),
      failed: count('failed'),
      skipped: count('skipped'),
      cases,
    });
  }
  return packages;
}

function summariseUnit(packages) {
  if (packages === null) return { status: 'not-available', reason: 'tests were not run (--run-tests not passed)' };
  const all = packages.flatMap((p) => (p.cases ?? []).map((c) => ({ package: p.name, ...c })));
  const sum = (key) => packages.reduce((n, p) => n + (p[key] ?? 0), 0);
  const failedPackages = packages.filter((p) => p.exitCode !== 0).map((p) => p.name);
  // tsx selfchecks have no per-case report: listed, never counted as zero.
  const unreportedPackages = packages.filter((p) => p.cases === null).map((p) => p.name);
  return {
    status: failedPackages.length > 0 ? 'failed' : unreportedPackages.length > 0 ? 'passed-with-unreported' : 'passed',
    source: `each workspace package's \`test\` script, JUnit via vitest or node --test-reporter (${JUNIT_DIR}/${JUNIT_FILE})`,
    totals: { packages: packages.length, reportedPackages: packages.length - unreportedPackages.length, tests: sum('tests'), passed: sum('passed'), failed: sum('failed'), skipped: sum('skipped') },
    failedPackages,
    unreportedPackages,
    skippedTests: all.filter((c) => c.outcome === 'skipped').map(({ outcome, ...c }) => c),
    failedTests: all.filter((c) => c.outcome === 'failed').map(({ outcome, ...c }) => c),
    packages: packages.map(({ cases, ...p }) => p),
  };
}

function findFiles(dir, name) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? findFiles(path, name) : entry === name ? [path] : [];
  });
}

/**
 * Summarise Playwright reports, one per app. Not passed unless every expected
 * app reported, no test failed and Playwright itself logged no error (a
 * config or global-setup error leaves `errors` set and the specs empty).
 */
export function summariseE2eReports(reports, expectedApps = E2E_APPS) {
  const cases = reports.flatMap(({ app, report }) => parsePlaywright(report, app));
  const errors = reports.flatMap(({ app, report }) => (report.errors ?? []).map((e) => ({ app, message: stripAnsi(String(e.message ?? e.value ?? e)).slice(0, 500) })));
  const reported = new Set(reports.map((r) => r.app));
  const missingApps = expectedApps.filter((app) => !reported.has(app));
  const count = (outcome) => cases.filter((c) => c.outcome === outcome).length;
  return {
    status: count('failed') > 0 || errors.length > 0 ? 'failed' : missingApps.length > 0 ? 'incomplete' : 'passed',
    source: 'Playwright JSON reporter (apps/*/playwright-report/results.json, Playwright E2E job)',
    totals: { tests: cases.length, passed: count('passed'), flaky: count('flaky'), failed: count('failed'), skipped: count('skipped') },
    missingApps,
    errors,
    skippedTests: cases.filter((c) => c.outcome === 'skipped').map(({ outcome, ...c }) => c),
    failedTests: cases.filter((c) => c.outcome === 'failed').map(({ outcome, ...c }) => c),
    flakyTests: cases.filter((c) => c.outcome === 'flaky').map(({ outcome, ...c }) => c),
  };
}

function summariseE2e(dir) {
  if (dir === null) return { status: 'not-available', reason: 'no Playwright report directory supplied' };
  const files = findFiles(dir, 'results.json');
  if (files.length === 0) return { status: 'not-available', reason: `no Playwright results.json under ${dir} (the E2E job did not finish)` };
  return summariseE2eReports(files.map((file) => ({
    app: relative(dir, file).split('/').find((part) => part !== 'apps') ?? 'unknown',
    report: JSON.parse(readFileSync(file, 'utf8')),
  })));
}

function runProofs(backend) {
  const proofs = [
    backend === null
      ? null
      : { name: 'contract verify vs pinned backend (determinism, drift, fixtures, zod parity, isolation)', cmd: ['pnpm', '--filter', '@usrp/contracts', 'run', 'verify', '--', '--backend', backend] },
    { name: 'surface contract', cmd: ['node', '--experimental-strip-types', 'tooling/surface-contract/src/cli.ts'] },
    { name: 'static hygiene gates', cmd: ['node', 'tooling/repo-hygiene/verify.mjs'] },
  ].filter(Boolean);
  const results = proofs.map(({ name, cmd }) => {
    console.log(`\n── proof: ${name}`);
    const result = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding: 'utf8' });
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    return { name, command: cmd.join(' '), status: result.status === 0 ? 'passed' : 'failed', assertions: assertionCount(`${result.stdout}${result.stderr}`) };
  });
  return {
    status: results.some((r) => r.status === 'failed') ? 'failed' : 'passed',
    notRun: backend === null ? ['contract verify (no --backend checkout supplied)'] : [],
    results,
  };
}

function operationInventory() {
  const script = "import('./src/paths.ts').then((m) => process.stdout.write(JSON.stringify({ sha: m.EDGE_BACKEND_SHA, ops: m.EDGE_OPERATIONS })))";
  const result = spawnSync('pnpm', ['exec', 'tsx', '-e', script], { cwd: join(ROOT, API_CLIENT), encoding: 'utf8' });
  let loaded = null;
  if (result.status === 0) {
    try { loaded = JSON.parse(result.stdout); } catch { /* reported below */ }
  }
  if (loaded === null) {
    const why = result.error?.message ?? (result.stderr || result.stdout || `exit ${result.status}`);
    return { inventory: { status: 'not-available', reason: `could not load paths.ts: ${String(why).slice(0, 300)}` }, pin: null };
  }
  const { sha, ops } = loaded;
  const sources = ['operations', 'queries'].flatMap((d) => {
    const dir = join(ROOT, API_CLIENT, 'src', d);
    return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(dir, f), 'utf8')) : [];
  });
  const typed = typedOperationIds(sources);
  const items = ops
    .map((op) => ({ id: op.id, method: op.method, path: op.edgePath, session: op.session, composition: op.composition ?? null, upstream: op.upstreamOperationId, typed: typed.has(op.id) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    inventory: {
      status: 'available',
      source: `${API_CLIENT}/src/paths.ts; typed = a call site in ${API_CLIENT}/src/{operations,queries}`,
      count: items.length,
      typed: items.filter((i) => i.typed).length,
      untypedIds: items.filter((i) => !i.typed).map((i) => i.id),
      sha256: sha256(JSON.stringify(items)),
      items,
    },
    pin: sha,
  };
}

/**
 * Do the backend pins agree? ci.yml BACKEND_SHA and paths.ts EDGE_BACKEND_SHA
 * must both be readable and equal; OpenAPI SHAs, where present, must match
 * them. An unreadable pin is a disagreement, never silently dropped.
 */
export function pinAgreement({ ciBackendSha, edgeBackendSha, openapiShas }) {
  if (ciBackendSha === null || edgeBackendSha === null) return false;
  return [edgeBackendSha, ...openapiShas].every((sha) => sha === ciBackendSha);
}

function peerPin(pathsSha) {
  const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8').match(/^\s*BACKEND_SHA:\s*([0-9a-f]{40})\s*$/m)?.[1] ?? null;
  const openapiDir = join(ROOT, 'packages/contracts/openapi');
  const openapi = existsSync(openapiDir)
    ? [...new Set(readdirSync(openapiDir).filter((f) => f.endsWith('.yaml')).flatMap((f) => [...readFileSync(join(openapiDir, f), 'utf8').matchAll(/\b([0-9a-f]{40})\b/g)].map((m) => m[1])))]
    : [];
  const sources = { ciBackendSha: ci, edgeBackendSha: pathsSha ?? null, openapiShas: openapi };
  return { repo: PEER, pinnedSha: ci, sources, agree: pinAgreement(sources) };
}

function parseArgs(argv) {
  const args = { out: null, backend: null, runTests: false, runProofs: false, e2eDir: null, needs: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--backend') args.backend = resolve(argv[++i]);
    else if (arg === '--e2e-dir') args.e2eDir = resolve(argv[++i]);
    else if (arg === '--needs') args.needs = argv[++i];
    else if (arg === '--run-tests') args.runTests = true;
    else if (arg === '--run-proofs') args.runProofs = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.out) throw new Error('--out <dir> is required');
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = process.env;
  const head = env.EVIDENCE_HEAD_SHA || git('rev-parse', 'HEAD');

  const { inventory, pin } = operationInventory();
  const proofs = args.runProofs ? runProofs(args.backend) : { status: 'not-available', reason: 'proofs were not run (--run-proofs not passed)' };
  const unit = summariseUnit(args.runTests ? runTests() : null);
  const e2e = summariseE2e(args.e2eDir);

  const bundle = {
    schema: 'usrp-evidence/v1',
    repo: REPO,
    commit: {
      sha: head,
      testedSha: env.GITHUB_SHA || head,
      ref: env.GITHUB_REF || git('rev-parse', '--abbrev-ref', 'HEAD'),
      event: env.GITHUB_EVENT_NAME || 'local',
      run: env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null,
    },
    peer: peerPin(pin),
    lockfile: { path: 'pnpm-lock.yaml', sha256: sha256(readFileSync(join(ROOT, 'pnpm-lock.yaml'))) },
    operations: inventory,
    proofs,
    tests: { unit, e2e },
    jobs: args.needs === null ? null : Object.fromEntries(Object.entries(JSON.parse(args.needs)).map(([k, v]) => [k, v.result])),
    generatedAt: new Date().toISOString(),
  };

  mkdirSync(args.out, { recursive: true });
  const file = join(args.out, `evidence-${head}.json`);
  writeFileSync(file, `${JSON.stringify(bundle, null, 2)}\n`);

  const totals = (t) => (t.totals ? ` (${Object.entries(t.totals).map(([k, v]) => `${v} ${k}`).join(', ')})` : '');
  console.log(`\nevidence: ${relative(process.cwd(), file)}`);
  console.log(`  peer pin:   ${bundle.peer.pinnedSha ?? 'none'}${bundle.peer.agree ? '' : '  ⚠ pins disagree'}`);
  console.log(`  operations: ${inventory.count ?? inventory.status}${inventory.untypedIds ? ` (${inventory.untypedIds.length} untyped: ${inventory.untypedIds.join(', ')})` : ''}`);
  console.log(`  proofs:     ${proofs.status}`);
  for (const r of proofs.results ?? []) console.log(`    ${r.status}: ${r.name}${r.assertions === null ? '' : ` — ${r.assertions} assertions`}`);
  console.log(`  unit:       ${unit.status}${totals(unit)}`);
  for (const t of unit.skippedTests ?? []) console.log(`    skipped: ${t.package} › ${t.name}`);
  console.log(`  e2e:        ${e2e.status}${totals(e2e)}`);
  for (const t of e2e.skippedTests ?? []) console.log(`    skipped: ${t.app} › ${t.name}`);
  for (const app of e2e.missingApps ?? []) console.log(`    missing report: ${app}`);
  for (const e of e2e.errors ?? []) console.log(`    playwright error (${e.app}): ${e.message.split('\n')[0]}`);

  if (inventory.status !== 'available' || !bundle.peer.agree) process.exitCode = 1;
  if (proofs.status === 'failed' || unit.status === 'failed') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.error(`evidence-bundle: ${error.message}`);
    process.exit(1);
  }
}
