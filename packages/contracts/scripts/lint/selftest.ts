#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// pnpm --filter @usrp/contracts lint:selftest
//
// PROVE THE LINTER CAN GO RED. Every rule is handed a file that violates it and
// a file that does not, and this script fails if either verdict is wrong. A
// clean `lint` run is worth exactly as much as this script's exit code — the
// backend's doctrine that a green-but-hollow gate is worse than no gate applies
// to gates I wrote myself first of all.
// ════════════════════════════════════════════════════════════════

import { CONTRACT_RULES, SHARED_TYPES_RULES, type LintFile, type Rule } from './rules.ts';
import { auditRoutes, type RouteLike } from './route-invariants.ts';

interface Case {
  readonly rule: string;
  /** A file that MUST trip the rule. */
  readonly dirty: LintFile;
  /** A file that must NOT trip it. */
  readonly clean: LintFile;
}

const CASES: readonly Case[] = [
  {
    rule: 'exact-path-only',
    dirty: { path: 'src/thing.ts', source: 'const u = `/v1/applications/${id}`;\n' },
    clean: { path: 'src/thing.ts', source: "const u = '/v1/applications/by-id';\n" },
  },
  {
    rule: 'exact-path-only',
    dirty: { path: 'src/thing.ts', source: "const u = '/v1/applications/{applicationId}';\n" },
    clean: { path: 'src/thing.ts', source: "const u = '#/components/schemas/Uuid';\n" },
  },
  {
    rule: 'exact-path-only',
    dirty: { path: 'scripts/gen.ts', source: "const u = '/v1/applications/by-id/:id';\n" },
    clean: {
      path: 'scripts/gen.ts',
      source: 'const doc = `/**\\n${body}\\n */`;\nconst row = `//   ${a} ${b}`;\nvoid doc; void row;\n',
    },
  },
  {
    rule: 'no-national-id-hash',
    dirty: { path: 'src/thing.ts', source: 'export const k = row.nationalIdHash;\n' },
    clean: {
      path: 'src/thing.ts',
      source: '// nationalIdHash must never reach the browser.\nexport const k = 1;\n',
    },
  },
  {
    rule: 'no-raw-hex-colour',
    dirty: { path: 'src/thing.ts', source: "export const c = '#ff5630';\n" },
    clean: { path: 'src/thing.ts', source: "export const c = token('color.text.danger');\n" },
  },
  {
    rule: 'no-any',
    dirty: { path: 'src/thing.ts', source: 'export function f(x: any): void { void x; }\n' },
    clean: { path: 'src/thing.ts', source: 'export function f(x: unknown): void { void x; }\n' },
  },
  {
    rule: 'generated-banner',
    dirty: { path: 'src/generated/thing.ts', source: 'export const x = 1;\n' },
    clean: {
      path: 'src/generated/thing.ts',
      source: '// GENERATED FILE — DO NOT EDIT BY HAND.\nexport const x = 1;\n',
    },
  },
  {
    rule: 'generated-banner',
    dirty: {
      path: 'src/handwritten.ts',
      source: '// GENERATED FILE — DO NOT EDIT BY HAND.\nexport const x = 1;\n',
    },
    clean: { path: 'src/handwritten.ts', source: 'export const x = 1;\n' },
  },
  {
    rule: 'runtime-import-extension',
    dirty: { path: 'scripts/thing.ts', source: "import { a } from './other.js';\nvoid a;\n" },
    clean: { path: 'scripts/thing.ts', source: "import { a } from './other.ts';\nvoid a;\n" },
  },
  {
    rule: 'runtime-import-extension',
    dirty: { path: 'src/thing.ts', source: "import { a } from './other.ts';\nvoid a;\n" },
    clean: { path: 'src/thing.ts', source: "import { a } from './other.js';\nvoid a;\n" },
  },
  {
    rule: 'no-cookie-credential',
    dirty: { path: 'src/thing.ts', source: "export const opts = { httpOnly: true };\n" },
    clean: {
      path: 'src/thing.ts',
      source: "export const opts = { authorization: 'Bearer …' };\n",
    },
  },
  {
    rule: 'deprecation-notice',
    dirty: { path: 'src/index.ts', source: 'export type A = "RDF";\n' },
    clean: { path: 'src/index.ts', source: '/** @deprecated use @usrp/contracts */\nexport type A = "RDF";\n' },
  },
  {
    rule: 'frozen-surface',
    dirty: { path: 'src/index.ts', source: '/** @deprecated */\nexport type S = "TOTALLY_NEW_STATUS";\n' },
    clean: { path: 'src/index.ts', source: '/** @deprecated */\nexport type S = "UNDER_REVIEW" | "DRAFT";\n' },
  },
];

const ALL_RULES: readonly Rule[] = [...CONTRACT_RULES, ...SHARED_TYPES_RULES];

function ruleById(id: string): Rule {
  const found = ALL_RULES.find((rule) => rule.id === id);
  if (found === undefined) throw new Error(`selftest names rule "${id}" which does not exist`);
  return found;
}

const failures: string[] = [];
let assertions = 0;

// ── Every rule must be exercised, or the selftest is theatre ──
const exercised = new Set(CASES.map((testCase) => testCase.rule));
for (const rule of ALL_RULES) {
  assertions += 1;
  if (!exercised.has(rule.id)) {
    failures.push(`rule "${rule.id}" has no selftest case — it has never been proven to go red`);
  }
}

for (const testCase of CASES) {
  const rule = ruleById(testCase.rule);

  assertions += 1;
  const dirty = rule.check(testCase.dirty);
  if (dirty.length === 0) {
    failures.push(
      `${rule.id}: stayed GREEN on a file that violates it —\n      ${JSON.stringify(testCase.dirty.source)}`,
    );
  }

  assertions += 1;
  const clean = rule.check(testCase.clean);
  if (clean.length > 0) {
    failures.push(
      `${rule.id}: went RED on a compliant file (false positive) — ${clean
        .map((v) => v.message)
        .join('; ')}`,
    );
  }
}

// ── The route auditor, same treatment ──
const GOOD: readonly RouteLike[] = [
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

const withGood = (extra: RouteLike): readonly RouteLike[] => [...GOOD, extra];

const ROUTE_CASES: readonly { readonly rule: string; readonly routes: readonly RouteLike[] }[] = [
  {
    rule: 'exact-path-only',
    routes: withGood({ service: 's', operationId: 'byId', method: 'GET', path: '/v1/applications/{id}', auth: ['officer'], reach: 'browser' }),
  },
  {
    rule: 'unique-route',
    routes: withGood({ service: 's', operationId: 'dupe', method: 'GET', path: '/v1/applications', auth: ['officer'], reach: 'browser' }),
  },
  {
    rule: 'auth-declared',
    routes: withGood({ service: 's', operationId: 'noAuth', method: 'GET', path: '/v1/x', auth: [], reach: 'browser' }),
  },
  {
    rule: 'credentials-not-interchangeable',
    routes: withGood({ service: 's', operationId: 'both', method: 'POST', path: '/v1/y', auth: ['officer', 'applicant-session'], reach: 'browser' }),
  },
  {
    rule: 'system-token-never-in-browser',
    routes: withGood({ service: 's', operationId: 'leak', method: 'POST', path: '/v1/z', auth: ['system'], reach: 'browser' }),
  },
  {
    rule: 'session-is-browser-only',
    routes: withGood({ service: 's', operationId: 'weird', method: 'POST', path: '/v1/w', auth: ['applicant-session'], reach: 'service-internal' }),
  },
  {
    rule: 'probe-shape',
    routes: withGood({ service: 't', operationId: 'tHealth', method: 'POST', path: '/health', auth: ['officer'], reach: 'browser' }),
  },
  {
    rule: 'anonymous-browser-allowlist',
    routes: withGood({ service: 's', operationId: 'oops', method: 'GET', path: '/v1/secrets', auth: ['none'], reach: 'browser' }),
  },
  {
    rule: 'reach-declared',
    routes: withGood({ service: 's', operationId: 'nowhere', method: 'GET', path: '/v1/q', auth: ['officer'], reach: 'edge' }),
  },
];

assertions += 1;
const baseline = auditRoutes(GOOD);
if (baseline.length > 0) {
  failures.push(
    `route auditor went RED on a compliant table: ${baseline.map((p) => `${p.rule}/${p.operationId}`).join(', ')}`,
  );
}

for (const routeCase of ROUTE_CASES) {
  assertions += 1;
  const problems = auditRoutes(routeCase.routes);
  if (!problems.some((problem) => problem.rule === routeCase.rule)) {
    failures.push(
      `route auditor rule "${routeCase.rule}" stayed GREEN on a table that violates it (saw: ${
        problems.map((p) => p.rule).join(', ') || 'nothing'
      })`,
    );
  }
}

if (failures.length > 0) {
  console.error(`LINT SELFTEST FAILED — ${failures.length} of ${assertions} assertions.`);
  for (const failure of failures) console.error(`  x ${failure}`);
  process.exit(1);
}
console.log(`lint selftest OK — ${assertions} assertions.`);
console.log(
  `  ${ALL_RULES.length} source rules and ${ROUTE_CASES.length} route-audit rules each proven to go red.`,
);
