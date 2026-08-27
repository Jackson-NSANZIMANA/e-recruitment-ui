#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// tooling/contract-drift self-test — prove the checker can go RED.
//
// A drift checker nobody has watched fail is indistinguishable from a
// no-op that prints "OK". This file plants each kind of drift the tool claims
// to catch and asserts it is caught, WITH THE RIGHT MESSAGE, plus asserts the
// extractor reads every syntactic shape the real backend uses.
//
//   node --experimental-strip-types tooling/contract-drift/src/selftest.ts
// ════════════════════════════════════════════════════════════════

import { extractAll, extractService } from './extract.ts';
import { gateA, gateB, gateC, type Manifest, type RouteFactLike } from './drift.ts';

const FIXTURE_SERVICES = new URL('../fixtures/backend/services', import.meta.url).pathname;

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, what: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(what);
}

function assertEqual(actual: unknown, expected: unknown, what: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  assert(a === b, `${what}\n      expected ${b}\n      actual   ${a}`);
}

// ── 1. The extractor reads every real syntactic shape ──────────────────

const alpha = extractService(FIXTURE_SERVICES, 'alpha-service');
assertEqual(alpha.problems, [], 'alpha: extractor reports no problems');
assertEqual(
  [...alpha.pathConstants.entries()].sort(),
  [
    ['ALPHA_DUAL_PATH', '/v1/alpha/dual'],
    ['ALPHA_OFFICER_PATH', '/v1/alpha/officer'],
    ['ALPHA_PUBLIC_PATH', '/v1/alpha/public'],
  ],
  'alpha: all three exported *_PATH constants resolve to their literals',
);
const alphaByPath = new Map(alpha.routes.map((r) => [r.path, r]));
assertEqual(alphaByPath.get('/v1/alpha/officer')?.auth, ['officer'], 'alpha: single-kind withAuth');
assertEqual(
  alphaByPath.get('/v1/alpha/dual')?.auth,
  ['system', 'officer'],
  'alpha: ARRAY-kind withAuth (the verify-identity shape) reads both kinds',
);
assertEqual(
  alphaByPath.get('/v1/alpha/public')?.auth,
  ['none'],
  'alpha: an unwrapped route is none, not a silently inherited kind from the route above it',
);
assert(alpha.readinessCallback, 'alpha: readiness callback detected');
assert(
  alpha.mountedFactories.includes('alphaRoutes'),
  'alpha: the factory named in main.ts routes[] is picked up',
);

const beta = extractService(FIXTURE_SERVICES, 'beta-service');
assertEqual(beta.problems, [], 'beta: extractor reports no problems');
const betaByKey = new Map(beta.routes.map((r) => [`${r.method} ${String(r.path)}`, r]));
assertEqual(
  betaByKey.get('GET /v1/beta/me')?.auth,
  ['applicant-session'],
  'beta: a route guarded by a local authenticate() is applicant-session, NOT none — mislabelling it none would read as "public" on a route that returns a citizen\'s applications',
);
assert(
  betaByKey.has('POST /v1/beta/thing') && betaByKey.has('GET /v1/beta/thing'),
  'beta: TWO METHODS on one exported constant (the ME_ERASURE_REQUEST_PATH shape) both extracted',
);
assert(
  betaByKey.has('GET /v1/beta/inline-key'),
  'beta: a route declared INLINE in main.ts is extracted (the scheduling-service shape that every adapters/http survey missed)',
);

const gamma = extractService(FIXTURE_SERVICES, 'gamma-service');
assert(
  !gamma.readinessCallback,
  'gamma: a main.ts with NO readiness callback is detected as false (the biometric-service finding)',
);
assert(
  !gamma.routes.some((r) => r.method === 'DELETE'),
  'gamma: a COMMENTED-OUT route registration is not extracted',
);

// ── 2. Gate C catches a built-but-unmounted route ──────────────────────

const extracted = extractAll(FIXTURE_SERVICES);
const c = gateC(extracted);
const orphan = c.findings.filter((f) => f.message.includes('GAMMA_ORPHAN_PATH'));
assert(
  orphan.length === 1,
  `gate C: the orphan controller is caught exactly once (got ${orphan.length})`,
);
assert(
  orphan[0]?.message.includes('never imports it') === true,
  'gate C: the message names the actual failure (main.ts never imports the controller)',
);
assert(
  !c.findings.some((f) => f.message.includes('GAMMA_MOUNTED_PATH')),
  'gate C: a properly mounted route is NOT reported',
);

// ── 3. Gate B catches each drift kind ─────────────────────────────────

const cleanManifest: Manifest = {
  backendSha: 'fixture',
  services: {
    'alpha-service': {
      controllerDir: 'services/alpha-service/src/adapters/http',
      readinessCallback: true,
      routes: [
        { method: 'POST', path: '/v1/alpha/officer', auth: ['officer'], constant: 'ALPHA_OFFICER_PATH', controller: 'one.controller.ts', mounted: true },
        { method: 'POST', path: '/v1/alpha/dual', auth: ['system', 'officer'], constant: 'ALPHA_DUAL_PATH', controller: 'one.controller.ts', mounted: true },
        { method: 'POST', path: '/v1/alpha/public', auth: ['none'], constant: 'ALPHA_PUBLIC_PATH', controller: 'one.controller.ts', mounted: true },
      ],
    },
  },
};

const clean = gateB(cleanManifest, extracted);
assertEqual(clean.findings, [], 'gate B: a truthful manifest produces no findings');
assert(clean.assertions > 0, 'gate B: a clean run still performs assertions');

const clone = (): Manifest => JSON.parse(JSON.stringify(cleanManifest)) as Manifest;

const missing = clone();
(missing.services['alpha-service']!.routes as unknown[]).push({
  method: 'DELETE', path: '/v1/alpha/gone', auth: ['officer'], constant: null,
  controller: 'one.controller.ts', mounted: true,
});
assert(
  gateB(missing, extracted).findings.some((f) => f.message.includes('no route registration')),
  'gate B goes RED on a manifest route the backend does not serve',
);

const authDrift = clone();
(authDrift.services['alpha-service']!.routes[0] as { auth: string[] }).auth = ['system'];
assert(
  gateB(authDrift, extracted).findings.some((f) => f.message.includes('auth kind drifted')),
  'gate B goes RED on a changed auth kind',
);

const constDrift = clone();
(authDrift.services['alpha-service']!.routes[0] as { auth: string[] }).auth = ['officer'];
(constDrift.services['alpha-service']!.routes[0] as { constant: string }).constant = 'ALPHA_RENAMED_PATH';
assert(
  gateB(constDrift, extracted).findings.some((f) => f.message.includes('no longer exports')),
  'gate B goes RED on a renamed path constant',
);

const readinessDrift = clone();
(readinessDrift.services['alpha-service'] as { readinessCallback: boolean }).readinessCallback = false;
assert(
  gateB(readinessDrift, extracted).findings.some((f) => f.message.includes('readiness callback')),
  'gate B goes RED when a readiness probe stops matching the manifest',
);

const extraBackendRoute = clone();
(extraBackendRoute.services['alpha-service']!.routes as unknown[]).splice(2, 1);
assert(
  gateB(extraBackendRoute, extracted).findings.some((f) => f.message.includes('NEW BACKEND ROUTE')),
  'gate B goes RED on an undocumented new backend route',
);

// ── 4. Gate A catches each drift kind ─────────────────────────────────

const table: RouteFactLike[] = [
  { service: 'alpha-service', operationId: 'alphaOfficer', method: 'POST', path: '/v1/alpha/officer', auth: ['officer'], reach: 'browser' },
  { service: 'alpha-service', operationId: 'alphaDual', method: 'POST', path: '/v1/alpha/dual', auth: ['system', 'officer'], reach: 'service-internal' },
  { service: 'alpha-service', operationId: 'alphaPublic', method: 'POST', path: '/v1/alpha/public', auth: ['none'], reach: 'browser' },
  { service: 'alpha-service', operationId: 'alphaHealth', method: 'GET', path: '/health', auth: ['none'], reach: 'service-internal' },
  { service: 'alpha-service', operationId: 'alphaReady', method: 'GET', path: '/ready', auth: ['none'], reach: 'service-internal' },
];
assertEqual(gateA(table, cleanManifest).findings, [], 'gate A: a truthful route table produces no findings');

assert(
  gateA(table.filter((r) => r.operationId !== 'alphaDual'), cleanManifest).findings.some((f) =>
    f.message.includes('MISSING ROUTE'),
  ),
  'gate A goes RED when the backend serves a route no operation describes',
);
assert(
  gateA(
    [...table, { service: 'alpha-service', operationId: 'invented', method: 'POST', path: '/v1/alpha/invented', auth: ['officer'], reach: 'browser' }],
    cleanManifest,
  ).findings.some((f) => f.message.includes('EXTRA ROUTE')),
  'gate A goes RED on an operation the backend does not serve (a generated client would call a 404)',
);
assert(
  gateA(
    table.map((r) => (r.operationId === 'alphaOfficer' ? { ...r, auth: ['system'] } : r)),
    cleanManifest,
  ).findings.some((f) => f.message.includes('CHANGED AUTH KIND')),
  'gate A goes RED on a changed auth kind',
);
assert(
  gateA(
    table.map((r) => (r.operationId === 'alphaDual' ? { ...r, reach: 'browser' } : r)),
    cleanManifest,
  ).findings.some((f) => f.message.includes('REACH MISMATCH')),
  'gate A goes RED when a system-token route is marked browser-reachable — the security-incident case',
);
assert(
  gateA(
    table.map((r) => (r.operationId === 'alphaOfficer' ? { ...r, method: 'PUT' } : r)),
    cleanManifest,
  ).findings.some((f) => f.message.includes('MISSING ROUTE')),
  'gate A goes RED on a changed method',
);
assert(
  gateA(table.filter((r) => r.path !== '/ready'), cleanManifest).findings.some((f) =>
    f.message.includes('/ready'),
  ),
  'gate A goes RED when a service stops documenting a reserved probe',
);

// ── Report ────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error(`contract-drift selftest FAILED — ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`contract-drift selftest OK — ${passed} assertions`);
