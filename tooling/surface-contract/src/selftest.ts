// surface-contract selftest: plant a violation of each rung's evidence rule
// against the real repository and assert the verifier names it. A readiness
// gate nobody has watched fail is indistinguishable from one that prints PASS.
import {
  buildContext,
  isPlaceholder,
  loadAllSurfaces,
  verifySurfaceContract,
  verifySurfaceSuite,
  type SurfaceContract,
} from './verify.ts';

export function runSelftest(root: string): boolean {
  const ctx = buildContext(root);
  let passed = 0;
  const failures: string[] = [];
  const assert = (condition: boolean, what: string): void => {
    if (condition) passed += 1;
    else failures.push(what);
  };
  const rulesOf = (contract: SurfaceContract): readonly string[] =>
    verifySurfaceContract(contract, ctx).findings.filter((f) => f.severity === 'error').map((f) => f.rule);

  const base: SurfaceContract = {
    schemaVersion: 2,
    id: 'selftest.surface',
    title: 'Selftest',
    audience: 'officer',
    owner: 'tooling/surface-contract',
    purpose: 'Planted manifest.',
    routes: [{ path: '/gate', app: 'field-station', source: 'packages/features/field-ops/src/routes/gate.tsx', role: 'station' }],
    operations: ['admitAtGate'],
    ads: [{ name: 'SectionMessage', source: 'packages/features/field-ops/src/routes/gate.tsx', import: '@atlaskit/section-message' }],
    states: [{ surface: 'gate', required: ['idle'], source: 'packages/features/field-ops/src/routes/gate.tsx', evidence: ['isPending'] }],
    accessibility: ['planted'],
    tests: [],
    rules: {},
    readiness: { rung: 'E2E-PROVEN', evidence: { e2e: ['apps/field-station/e2e/gate.spec.ts'] } },
  };
  const variant = (patch: Partial<SurfaceContract>): SurfaceContract => ({ ...base, ...patch });

  // The clean planted manifest passes, so every failure below is caused by its patch.
  assert(rulesOf(base).length === 0, `clean planted manifest passes (got ${rulesOf(base).join(', ')})`);

  // Placeholder detection, both directions.
  assert(isPlaceholder(root, 'packages/features/adjudication/src/routes/amber-queue.tsx'), 'a one-line title screen is a placeholder');
  assert(!isPlaceholder(root, 'packages/features/field-ops/src/routes/gate.tsx'), 'the gate is not a placeholder');
  assert(!isPlaceholder(root, 'apps/applicant-portal/src/routes/applications.tsx'), 'a re-export is judged by its target');

  // Each rung's evidence can fail.
  assert(rulesOf(variant({ readiness: { rung: 'ALMOST-DONE' } })).includes('readiness-rung'), 'off-ladder rung is refused');
  assert(rulesOf(variant({ readiness: { rung: 'DECLARED' } })).includes('blocked-by'), 'DECLARED without blockedBy is refused');
  assert(
    rulesOf(variant({ operations: ['listSomethingTheEdgeNeverServed'], readiness: { rung: 'EDGE-AVAILABLE', blockedBy: ['B-13'] } })).includes('operation-registered'),
    'EDGE-AVAILABLE with an operation the edge does not serve is refused',
  );
  assert(
    rulesOf(variant({ operations: ['resolveFieldSyncConflict'], readiness: { rung: 'CLIENT-WIRED', blockedBy: ['S08'] } })).includes('client-wired'),
    'CLIENT-WIRED with no typed api-client call site is refused',
  );
  assert(
    rulesOf(
      variant({
        routes: [{ path: '/adjudication/amber-queue', app: 'officer-console', source: 'packages/features/adjudication/src/routes/amber-queue.tsx', role: 'queue' }],
        operations: [],
        readiness: { rung: 'SCREEN-BUILT' },
      }),
    ).includes('screen-built'),
    'SCREEN-BUILT on a placeholder route is refused',
  );
  assert(rulesOf(variant({ states: [], readiness: { rung: 'SCREEN-BUILT' } })).includes('states'), 'SCREEN-BUILT without states is refused');
  assert(
    rulesOf(
      variant({
        states: [{ surface: 'x', required: ['loading'], source: 'tooling/surface-contract/fixtures/untranslated-screen.tsx', evidence: ['isLoading'] }],
        readiness: { rung: 'SCREEN-BUILT' },
      }),
    ).includes('locale-parity'),
    'SCREEN-BUILT with an untranslated key is refused',
  );
  assert(
    rulesOf(variant({ readiness: { rung: 'E2E-PROVEN', evidence: { e2e: ['apps/officer-console/e2e/offline-conflict.spec.ts'] } } })).includes('e2e-no-skip'),
    'E2E-PROVEN citing a fixme spec is refused',
  );
  assert(
    rulesOf(variant({ readiness: { rung: 'E2E-PROVEN', evidence: { e2e: ['apps/field-station/e2e/does-not-exist.spec.ts'] } } })).includes('e2e-exists'),
    'E2E-PROVEN citing a missing spec is refused',
  );
  assert(rulesOf(variant({ readiness: { rung: 'E2E-PROVEN' } })).includes('e2e-evidence'), 'E2E-PROVEN with no spec is refused');
  assert(
    rulesOf(variant({ readiness: { rung: 'LOAD-PROVEN', evidence: { e2e: ['apps/field-station/e2e/gate.spec.ts'] } } })).includes('signoff'),
    'LOAD-PROVEN without a sign-off reference is refused',
  );
  assert(
    rulesOf(variant({ readiness: { rung: 'E2E-PROVEN', evidence: { e2e: ['apps/field-station/e2e/gate.spec.ts'], contract: '0'.repeat(40) } } })).includes('contract-sha'),
    'a contract SHA other than the pinned one is refused',
  );
  assert(
    rulesOf(variant({ routes: [{ path: '/nowhere', app: 'field-station', source: 'packages/features/field-ops/src/routes/gate.tsx', role: 'x' }] })).includes('route-mounted'),
    'a manifest route no app mounts is refused',
  );

  // Coverage: drop the manifest that declares a mounted route and the suite must notice.
  const surfaces = loadAllSurfaces(root);
  const withoutGate = surfaces.filter((s) => !s.contract.routes.some((r) => r.app === 'field-station' && r.path === '/gate'));
  assert(withoutGate.length === surfaces.length - 1, 'exactly one manifest declares the field-station gate');
  assert(
    verifySurfaceSuite(root, withoutGate).findings.some((f) => f.rule === 'route-unmanifested' && f.message.includes('/gate')),
    'a mounted route with no manifest is refused',
  );
  const duplicated = [...surfaces, { file: 'planted.json', contract: { ...base, id: 'selftest.duplicate' } }];
  assert(verifySurfaceSuite(root, duplicated).findings.some((f) => f.rule === 'route-claimed-twice'), 'a route claimed by two manifests is refused');

  if (failures.length > 0) {
    console.error(`surface-contract selftest FAILED — ${failures.length} of ${passed + failures.length}`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    return false;
  }
  console.log(`surface-contract selftest OK — ${passed} assertions`);
  return true;
}
