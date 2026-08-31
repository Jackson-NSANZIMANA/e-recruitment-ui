// ══════════════════════════════════════════════════════════════════
// edge-dev — assert UPSTREAM_ROUTES against @usrp/contracts
//
//   pnpm --filter @usrp/contracts exec tsx ../../tooling/edge-dev/scripts/check-against-contracts.ts
//
// edge-dev declares the upstream routes it may call as DATA, because `tooling/`
// is outside the pnpm workspace and the tool must run from a bare checkout with
// no install. This script is the other half of that bargain: it proves the
// declaration equals the contract. Manifest plus drift gate, the shape the
// backend already uses.
//
// ⚠ NOT RUN IN THE AUTHORING ENVIRONMENT. It needs `@usrp/contracts` resolvable,
// which needs `pnpm install`, which needs a network. Reported as an open gap
// rather than described as green — the same admission Agent 1 made about drift
// gates B and C, for the same reason: an unrun gate that is claimed green is
// worse than one that is honestly named.
// ══════════════════════════════════════════════════════════════════

import { ROUTE_TABLE, BROWSER_ROUTES, SERVICE_INTERNAL_ROUTES } from '@usrp/contracts';
import { REFUSED_UPSTREAM_ROUTES, UPSTREAM_ROUTES } from '../src/upstream-routes.ts';

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail?: string): void {
  if (condition) { passed += 1; return; }
  failures.push(detail === undefined ? label : `${label} — ${detail}`);
}

const byOperationId = new Map(ROUTE_TABLE.map((route) => [route.operationId, route]));

ok('the contract route table is populated', ROUTE_TABLE.length > 0);
ok('the browser/internal partition is populated', BROWSER_ROUTES.length > 0 && SERVICE_INTERNAL_ROUTES.length > 0);

/**
 * `verifyIdentity` is the ONE declared exception: the contract marks it
 * service-internal, and ADR-012 D1 widened `withAuth` to accept officer
 * principals so a field officer can establish identity at a venue. Named here,
 * once, so the exception is auditable code rather than a permissive rule.
 */
const BROKERED = new Set(['verifyIdentity']);

for (const declared of UPSTREAM_ROUTES) {
  const contractRoute = byOperationId.get(declared.operationId);
  ok(`${declared.operationId} exists in the contract`, contractRoute !== undefined);
  if (contractRoute === undefined) continue;

  ok(`${declared.operationId} method matches`, contractRoute.method === declared.method,
    `contract=${contractRoute.method} declared=${declared.method}`);
  ok(`${declared.operationId} path matches EXACTLY`, contractRoute.path === declared.path,
    `contract=${contractRoute.path} declared=${declared.path}`);
  ok(`${declared.operationId} path is not templated`, !contractRoute.path.includes(':'));

  if (declared.reach === 'browser') {
    ok(`${declared.operationId} is browser-reachable in the contract`, contractRoute.reach === 'browser',
      `contract reach=${contractRoute.reach}`);
  }
  if (declared.reach === 'brokered-system') {
    ok(`${declared.operationId} is a NAMED brokered exception`, BROKERED.has(declared.operationId));
  }
  if (contractRoute.reach === 'service-internal' && declared.reach === 'browser') {
    failures.push(`${declared.operationId}: SECURITY — contract says service-internal, edge declares it browser-reachable.`);
  }
}

// Every refusal must be a real route, or the refusal list is decoration.
for (const refused of REFUSED_UPSTREAM_ROUTES) {
  const contractRoute = byOperationId.get(refused.operationId);
  ok(`refused route ${refused.operationId} is a REAL contract operation`, contractRoute !== undefined);
  ok(`refused route ${refused.operationId} is genuinely service-internal`,
    contractRoute?.reach === 'service-internal', `reach=${contractRoute?.reach ?? 'missing'}`);
  ok(`refused route ${refused.operationId} is NOT also declared reachable`,
    !UPSTREAM_ROUTES.some((route) => route.operationId === refused.operationId));
}

/**
 * The sweep that catches the route nobody thought about: every
 * service-internal operation must be either declared brokered or explicitly
 * refused. Silence is not a decision.
 */
for (const internal of SERVICE_INTERNAL_ROUTES) {
  if (internal.path === '/health' || internal.path === '/ready') continue;
  const isBrokered = UPSTREAM_ROUTES.some(
    (route) => route.operationId === internal.operationId && route.reach === 'brokered-system',
  );
  const isRefused = REFUSED_UPSTREAM_ROUTES.some((route) => route.operationId === internal.operationId);
  const isPublicMint = internal.operationId === 'issueServiceToken';
  ok(`service-internal ${internal.operationId} is explicitly brokered or refused`,
    isBrokered || isRefused || isPublicMint,
    'add it to REFUSED_UPSTREAM_ROUTES with a reason, or declare it brokered');
}

const total = passed + failures.length;
if (failures.length > 0) {
  process.stderr.write(`\n  ✗ edge-dev contract check FAILED — ${failures.length} of ${total}\n\n`);
  for (const failure of failures) process.stderr.write(`    ✗ ${failure}\n`);
  process.stderr.write('\n');
  process.exit(1);
}
process.stdout.write(`\n  ✓ edge-dev matches @usrp/contracts — ${passed} assertions\n\n`);
