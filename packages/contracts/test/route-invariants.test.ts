import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANONYMOUS_BROWSER_OPERATIONS,
  auditRoutes,
  type RouteLike,
} from '../scripts/lint/route-invariants.ts';

const base: readonly RouteLike[] = [
  { service: 's', operationId: 'sHealth', method: 'GET', path: '/health', auth: ['none'], reach: 'service-internal' },
  { service: 's', operationId: 'sReady', method: 'GET', path: '/ready', auth: ['none'], reach: 'service-internal' },
  { service: 's', operationId: 'officerLogin', method: 'POST', path: '/v1/auth/officer/login', auth: ['none'], reach: 'browser' },
  { service: 's', operationId: 'requestApplicantOtp', method: 'POST', path: '/v1/applicants/auth/otp/request', auth: ['none'], reach: 'browser' },
  { service: 's', operationId: 'verifyApplicantOtp', method: 'POST', path: '/v1/applicants/auth/otp/verify', auth: ['none'], reach: 'browser' },
  { service: 's', operationId: 'getSlotInvitationKey', method: 'GET', path: '/v1/slots/invitation-key', auth: ['none'], reach: 'browser' },
  { service: 's', operationId: 'listApplications', method: 'GET', path: '/v1/applications', auth: ['officer'], reach: 'browser' },
  { service: 's', operationId: 'submitApplication', method: 'POST', path: '/v1/applications', auth: ['system'], reach: 'service-internal' },
  { service: 's', operationId: 'listMyApplications', method: 'GET', path: '/v1/applicants/me/applications', auth: ['applicant-session'], reach: 'browser' },
];

const rulesFor = (extra: RouteLike): readonly string[] =>
  auditRoutes([...base, extra]).map((problem) => problem.rule);

test('a compliant table produces no problems at all', () => {
  assert.deepEqual([...auditRoutes(base)], []);
});

test('the anonymous browser allowlist is a reviewed list of exactly four', () => {
  assert.deepEqual([...ANONYMOUS_BROWSER_OPERATIONS], [
    'officerLogin',
    'requestApplicantOtp',
    'verifyApplicantOtp',
    'getSlotInvitationKey',
  ]);
});

test('INVARIANT 1: a templated path is caught', () => {
  assert.ok(rulesFor({ service: 's', operationId: 'byId', method: 'GET', path: '/v1/applications/{id}', auth: ['officer'], reach: 'browser' }).includes('exact-path-only'));
  assert.ok(rulesFor({ service: 's', operationId: 'byId2', method: 'GET', path: '/v1/applications/:id', auth: ['officer'], reach: 'browser' }).includes('exact-path-only'));
});

test('INVARIANT 4: officer JWT and citizen session on one route is caught', () => {
  assert.ok(
    rulesFor({ service: 's', operationId: 'mixed', method: 'POST', path: '/v1/mixed', auth: ['officer', 'applicant-session'], reach: 'browser' })
      .includes('credentials-not-interchangeable'),
  );
});

test('ADR-016: a system-token route marked browser-reachable is caught', () => {
  assert.ok(
    rulesFor({ service: 's', operationId: 'leak', method: 'POST', path: '/v1/leak', auth: ['system'], reach: 'browser' })
      .includes('system-token-never-in-browser'),
  );
});

test('ADR-018: a citizen-session route that is not browser-reachable is caught', () => {
  assert.ok(
    rulesFor({ service: 's', operationId: 'odd', method: 'POST', path: '/v1/odd', auth: ['applicant-session'], reach: 'service-internal' })
      .includes('session-is-browser-only'),
  );
});

test('a new unauthenticated browser route cannot be added without the allowlist', () => {
  assert.ok(
    rulesFor({ service: 's', operationId: 'oops', method: 'GET', path: '/v1/oops', auth: ['none'], reach: 'browser' })
      .includes('anonymous-browser-allowlist'),
  );
});

test('"none" qualified by another kind is caught', () => {
  assert.ok(
    rulesFor({ service: 's', operationId: 'both', method: 'GET', path: '/v1/both', auth: ['none', 'officer'], reach: 'browser' })
      .includes('auth-declared'),
  );
});

test('an unknown auth kind or reach is caught', () => {
  assert.ok(rulesFor({ service: 's', operationId: 'sa', method: 'GET', path: '/v1/sa', auth: ['superadmin'], reach: 'browser' }).includes('auth-declared'));
  assert.ok(rulesFor({ service: 's', operationId: 'edge', method: 'GET', path: '/v1/edge', auth: ['officer'], reach: 'edge' }).includes('reach-declared'));
});

test('a probe that is authenticated or browser-reachable is caught', () => {
  assert.ok(rulesFor({ service: 't', operationId: 'tHealth', method: 'POST', path: '/health', auth: ['officer'], reach: 'browser' }).includes('probe-shape'));
});

test('the same method and path declared twice for ONE service is caught', () => {
  assert.ok(rulesFor({ service: 's', operationId: 'dupe', method: 'GET', path: '/v1/applications', auth: ['officer'], reach: 'browser' }).includes('unique-route'));
});

test('every service exposing GET /health is NOT a collision — all eleven do', () => {
  const probes: readonly RouteLike[] = [
    'application-service',
    'audit-service',
    'background-vetting-service',
    'biometric-service',
    'document-forensics-service',
    'eligibility-service',
    'field-sync-service',
    'iam-service',
    'identity-service',
    'notification-service',
    'scheduling-service',
  ].flatMap((service) => [
    { service, operationId: `${service}-health`, method: 'GET', path: '/health', auth: ['none'], reach: 'service-internal' },
    { service, operationId: `${service}-ready`, method: 'GET', path: '/ready', auth: ['none'], reach: 'service-internal' },
  ]);
  const problems = auditRoutes([...base, ...probes]);
  assert.deepEqual(
    problems.map((problem) => `${problem.rule}/${problem.operationId}`),
    [],
  );
});

test('an allowlist entry naming a route that no longer exists is caught', () => {
  const withoutLogin = base.filter((route) => route.operationId !== 'officerLogin');
  const problems = auditRoutes(withoutLogin);
  assert.ok(problems.some((problem) => problem.operationId === 'officerLogin' && problem.rule === 'anonymous-browser-allowlist'));
});
