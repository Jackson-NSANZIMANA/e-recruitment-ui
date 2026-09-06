import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSER_ROUTES, ROUTE_TABLE, SERVICE_INTERNAL_ROUTES } from '../src/generated/routes.js';
import { auditRoutes } from '../scripts/lint/route-invariants.ts';

// This binds the pure predicates in scripts/lint/route-invariants.ts to the
// SHIPPED table. route-invariants.test.ts proves each predicate goes red; this
// proves the real contract obeys every one of them.

test('the shipped route table satisfies every platform invariant', () => {
  const problems = auditRoutes(ROUTE_TABLE);
  assert.deepEqual(
    problems.map((problem) => `${problem.rule}/${problem.operationId}: ${problem.message}`),
    [],
  );
});

test('the table is not empty — an empty table would pass every check above', () => {
  assert.ok(ROUTE_TABLE.length > 0);
  assert.ok(
    ROUTE_TABLE.some((route) => route.path !== '/health' && route.path !== '/ready'),
    'a table of nothing but probes proves nothing',
  );
});

test('browser and service-internal partition the table exactly', () => {
  assert.equal(BROWSER_ROUTES.length + SERVICE_INTERNAL_ROUTES.length, ROUTE_TABLE.length);
  assert.ok(BROWSER_ROUTES.every((route) => route.reach === 'browser'));
  assert.ok(SERVICE_INTERNAL_ROUTES.every((route) => route.reach === 'service-internal'));
});

test('every operation carries provenance — a route with no source is a guess', () => {
  for (const route of ROUTE_TABLE) {
    assert.ok(route.source.length > 0, `${route.operationId} has no x-usrp-source`);
    assert.ok(route.verified.length > 0, `${route.operationId} has no x-usrp-verified`);
    assert.ok(
      ['controller-verbatim', 'proxy-derived'].includes(route.verified),
      `${route.operationId}: unknown provenance kind "${route.verified}"`,
    );
  }
});

test('operationIds are unique across every service', () => {
  const ids = ROUTE_TABLE.map((route) => route.operationId);
  assert.equal(new Set(ids).size, ids.length);
});

test('every operation documents at least one status, and probes document 200', () => {
  for (const route of ROUTE_TABLE) {
    assert.ok(route.statuses.length > 0, `${route.operationId} documents no status`);
    if (route.path === '/health' || route.path === '/ready') {
      assert.ok(route.statuses.includes('200'), `${route.operationId} must document 200`);
    }
  }
});

test('no browser-reachable route accepts a system client-credentials token', () => {
  for (const route of BROWSER_ROUTES) {
    assert.ok(
      !route.auth.includes('system'),
      `${route.operationId} would put a system token in a browser`,
    );
  }
});

test('every authenticated browser route names exactly one credential kind', () => {
  for (const route of BROWSER_ROUTES) {
    if (route.auth.includes('none')) continue;
    assert.equal(route.auth.length, 1, `${route.operationId}: ${route.auth.join('|')}`);
  }
});
