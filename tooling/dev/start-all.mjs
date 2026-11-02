#!/usr/bin/env node
/**
 * `pnpm dev:local` — start the ENTIRE standalone frontend stack in one command.
 *
 * Why this exists: `pnpm dev` runs `turbo run dev --parallel`, which also starts
 * `@usrp/edge-dev`'s `dev` script. That script targets the REAL backend
 * services (ports 4011/4001/4006) and needs the separate `e-recruitment`
 * repository, so a frontend-only checkout shows three live Vite servers with a
 * dead login. This launcher instead starts FIVE processes:
 *
 *   - agency edge-dev (--mocks) on 4021 → officer-console + field-station
 *   - citizen edge-dev (--mocks) on 4031 → applicant-portal
 *   - applicant-portal 3000, officer-console 3001, field-station 3002
 *
 * Two edges are REQUIRED: `edgeRoutes()` registers either the citizen routes or
 * the agency routes, never both. A single agency edge answers the applicant
 * OTP endpoints with 404. Each edge gets its own mock upstream ports in the
 * 494x band via the EDGE_DEV_MOCK_*_PORT overrides (tooling/edge-dev/PORTS.md),
 * because the backend's `pnpm sandbox:full` owns 4901-4911 and 4930-4932. This
 * stack can therefore run beside the sandbox.
 *
 * Zero new dependencies: it spawns the repo's own `node` and `vite` binaries.
 *
 * Optional environment overrides:
 *   USRP_APPLICANT_PORT / USRP_OFFICER_PORT / USRP_FIELD_PORT  (3000/3001/3002)
 *   USRP_EDGE_PORT           agency edge port (default 4021)
 *   USRP_CITIZEN_EDGE_PORT   citizen edge port (default 4031)
 *   USRP_DEV_HOST            Vite bind address (default localhost)
 *   USRP_DEV_ALLOWED_HOST    extra Vite allowedHosts entry (default none)
 *   CORS_ORIGINS             additional exact origins appended to the edge's list
 */
import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { createServer } from 'node:net';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function positivePort(name, fallback) {
  const raw = process.env[name] ?? String(fallback);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    console.error(`[dev:local] ${name} must be a TCP port (1-65535), got ${JSON.stringify(raw)}.`);
    process.exit(2);
  }
  return parsed;
}

const APPS = [
  { label: 'applicant', dir: 'apps/applicant-portal', port: positivePort('USRP_APPLICANT_PORT', 3000), edge: 'citizen' },
  { label: 'officer', dir: 'apps/officer-console', port: positivePort('USRP_OFFICER_PORT', 3001), edge: 'agency' },
  { label: 'field', dir: 'apps/field-station', port: positivePort('USRP_FIELD_PORT', 3002), edge: 'agency' },
];
const FIELD_PORT = APPS.find((app) => app.label === 'field').port;

const EDGES = {
  agency: {
    label: 'edge-agency',
    port: positivePort('USRP_EDGE_PORT', 4021),
    args: ['--deployment=agency', '--agency=RDF'],
    mocks: { iam: 4941, identity: 4942, application: 4943 },
  },
  citizen: {
    label: 'edge-citizen',
    port: positivePort('USRP_CITIZEN_EDGE_PORT', 4031),
    args: ['--deployment=citizen'],
    mocks: { iam: 4944, identity: 4945, application: 4946 },
  },
};

const host = process.env['USRP_DEV_HOST'] ?? 'localhost';
const allowedHost = process.env['USRP_DEV_ALLOWED_HOST'] ?? '';
const edgeBin = join(ROOT, 'tooling', 'edge-dev', 'src', 'main.ts');
const viteBins = APPS.map((app) => join(ROOT, app.dir, 'node_modules', 'vite', 'bin', 'vite.js'));

function assertRuntime() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  // edge-dev runs with --experimental-strip-types, available from 22.6.
  if (major < 22 || (major === 22 && minor < 6)) {
    console.error(
      `[dev:local] Node 24 is pinned by this repo (.node-version). You have ` +
        `${process.versions.node}; the dev edge needs at least 22.6 for --experimental-strip-types.`,
    );
    process.exit(2);
  }
  if (viteBins.some((bin) => !existsSync(bin)) || !existsSync(edgeBin)) {
    console.error('[dev:local] Dependencies are missing. Run `pnpm install` from the repo root first.');
    process.exit(2);
  }
}

function isPortFree(port) {
  return new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(false));
    probe.once('listening', () => probe.close(() => done(true)));
    probe.listen(port, '0.0.0.0');
  });
}

async function assertPortsFree() {
  const owners = [
    ...APPS.map((app) => ({ port: app.port, label: app.label, override: `USRP_${app.label.toUpperCase()}_PORT` })),
    ...Object.entries(EDGES).map(([kind, edge]) => ({
      port: edge.port,
      label: edge.label,
      override: kind === 'agency' ? 'USRP_EDGE_PORT' : 'USRP_CITIZEN_EDGE_PORT',
    })),
    ...Object.values(EDGES).flatMap((edge) =>
      Object.entries(edge.mocks).map(([service, port]) => ({
        port,
        label: `${edge.label} mock ${service}`,
        override: null,
      })),
    ),
  ];
  const busy = [];
  for (const owner of owners) {
    if (!(await isPortFree(owner.port))) busy.push(owner);
  }
  if (busy.length === 0) return;
  console.error('[dev:local] These ports are already in use:');
  for (const owner of busy) {
    const remedy = owner.override === null ? 'free it' : `free it or set ${owner.override}=<other port>`;
    console.error(`  :${owner.port} (${owner.label}) — ${remedy}`);
  }
  process.exit(2);
}

// Exact-match allow-list for CSRF origin pinning AND CORS. Both localhost
// spellings are included so a developer can isolate the two session cookies by
// using different hostnames (cookies ignore the port on a single hostname).
const origins = new Set();
for (const app of APPS) {
  origins.add(`http://localhost:${app.port}`);
  origins.add(`http://127.0.0.1:${app.port}`);
}
for (const origin of (process.env['CORS_ORIGINS'] ?? '').split(',')) {
  if (origin.trim() !== '') origins.add(origin.trim());
}

// Never inherit a stale production VITE_EDGE_URL: each Vite server gets the
// local edge for its own audience, and nothing else.
const baseEnv = { ...process.env };
delete baseEnv['VITE_EDGE_URL'];
if (allowedHost !== '') baseEnv['__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS'] = allowedHost;

const children = [];
let stopping = false;

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => {
    for (const { child } of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    process.exit(exitCode);
  }, 2500);
}

function launch(label, args, options) {
  const child = spawn(process.execPath, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? baseEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tag = `[${label}]`.padEnd(15);
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    let pending = '';
    stream.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) process.stdout.write(`${tag} ${line}\n`);
    });
    stream.on('end', () => {
      if (pending !== '') process.stdout.write(`${tag} ${pending}\n`);
    });
  }
  child.on('error', (error) => {
    process.stderr.write(`${tag} failed to spawn: ${String(error)}\n`);
    stopAll(1);
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    process.stderr.write(`${tag} exited (code=${code} signal=${signal}); stopping the stack.\n`);
    stopAll(code ?? 1);
  });
  children.push({ label, child });
}

async function main() {
  assertRuntime();
  await assertPortsFree();

  for (const edge of Object.values(EDGES)) {
    const env = {
      ...baseEnv,
      EDGE_DEV_PORT: String(edge.port),
      CORS_ORIGINS: [...origins].join(','),
      EDGE_DEV_MOCK_IAM_PORT: String(edge.mocks.iam),
      EDGE_DEV_MOCK_IDENTITY_PORT: String(edge.mocks.identity),
      EDGE_DEV_MOCK_APPLICATION_PORT: String(edge.mocks.application),
    };
    launch(edge.label, ['--experimental-strip-types', edgeBin, ...edge.args, '--mocks'], { env });
  }

  // pnpm's generated `node_modules/.bin/vite` shell wrapper exports NODE_PATH
  // with the virtual-store directories. We launch vite's JS entry directly (so
  // the launcher works on Windows too), so we must reproduce that NODE_PATH:
  // @compiled/vite-plugin resolves `@compiled/babel-plugin` through Babel's
  // resolver from a virtual file in the app directory, and WITHOUT this path the
  // very first `/src/main.tsx` request returns a 500 "Cannot find package".
  const pnpmHoisted = join(ROOT, 'node_modules', '.pnpm', 'node_modules');

  for (const [index, app] of APPS.entries()) {
    const viteBin = viteBins[index];
    const viteStore = dirname(dirname(dirname(realpathSync(viteBin))));
    const env = {
      ...baseEnv,
      VITE_EDGE_URL: `http://localhost:${EDGES[app.edge].port}`,
      VITE_FIELD_STATION_URL: `http://localhost:${FIELD_PORT}`,
      NODE_PATH: [viteStore, pnpmHoisted, process.env['NODE_PATH'] ?? '']
        .filter((part) => part !== '')
        .join(delimiter),
    };
    launch(app.label, [viteBin, '--host', host, '--port', String(app.port)], {
      cwd: join(ROOT, app.dir),
      env,
    });
  }

  process.stdout.write(
    [
      '',
      '  USRP frontend — full local stack (Ctrl+C stops all five processes)',
      `  agency edge   http://localhost:${EDGES.agency.port}/edge/health   → officer + field`,
      `  citizen edge  http://localhost:${EDGES.citizen.port}/edge/health  → applicant`,
      ...APPS.map((app) => `  ${app.label.padEnd(13)} http://localhost:${app.port}`),
      '  officer login : rdf.officer / Officer#2026   (or rnp.officer)',
      '  citizen OTP   : 123456  (NID 1199180000000001, DOB 2002-05-14)',
      '',
    ].join('\n'),
  );

  process.on('SIGINT', () => stopAll(0));
  process.on('SIGTERM', () => stopAll(0));
}

main().catch((error) => {
  console.error(`[dev:local] ${String(error)}`);
  process.exit(1);
});
