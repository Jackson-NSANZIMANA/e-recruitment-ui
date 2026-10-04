import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

export interface SurfaceRoute {
  readonly path: string;
  readonly source: string;
  readonly role: string;
}

export interface SurfaceAdsRequirement {
  readonly name: string;
  readonly source: string;
  readonly import: string;
}

export interface SurfaceStateRequirement {
  readonly surface: string;
  readonly required: readonly string[];
  readonly source: string;
  readonly evidence: readonly string[];
}

export interface SurfaceContract {
  readonly schemaVersion: number;
  readonly id: string;
  readonly title: string;
  readonly audience: string;
  readonly owner: string;
  readonly purpose: string;
  readonly routes: readonly SurfaceRoute[];
  readonly operations: readonly string[];
  readonly ads: readonly SurfaceAdsRequirement[];
  readonly states: readonly SurfaceStateRequirement[];
  readonly accessibility: readonly string[];
  readonly tests: readonly string[];
  readonly rules: Readonly<Record<string, unknown>>;
}

export interface SurfaceFinding {
  readonly severity: 'error' | 'note';
  readonly rule: string;
  readonly message: string;
  readonly file?: string;
}

export interface SurfaceVerification {
  readonly findings: readonly SurfaceFinding[];
  readonly assertions: number;
}

function source(root: string, path: string): string | null {
  const absolute = resolve(root, path);
  const relativePath = relative(root, absolute);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) return null;
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
}

function finding(
  findings: SurfaceFinding[],
  rule: string,
  message: string,
  file?: string,
): void {
  findings.push({ severity: 'error', rule, message, ...(file === undefined ? {} : { file }) });
}

function hasAny(sourceText: string | null, evidence: readonly string[]): boolean {
  return sourceText !== null && evidence.every((item) => sourceText.includes(item));
}

export function verifySurfaceContract(
  contract: SurfaceContract,
  root: string,
): SurfaceVerification {
  const findings: SurfaceFinding[] = [];
  let assertions = 0;
  const check = (condition: boolean, rule: string, message: string, file?: string): void => {
    assertions += 1;
    if (!condition) finding(findings, rule, message, file);
  };

  check(contract.schemaVersion === 1, 'schema-version', 'surface contract schemaVersion must be 1');
  check(/^[a-z0-9][a-z0-9.-]+$/.test(contract.id), 'surface-id', `invalid surface id: ${contract.id}`);
  check(contract.routes.length > 0, 'routes', 'surface must own at least one route');
  check(contract.states.length > 0, 'states', 'surface must declare at least one state group');
  check(contract.operations.every((operation) => /^[A-Za-z][A-Za-z0-9]+$/.test(operation)), 'operation-format', 'operation ids must be camelCase identifiers');

  const appSource = source(root, 'apps/officer-console/src/app.tsx');
  for (const route of contract.routes) {
    const routeSource = source(root, route.source);
    check(routeSource !== null, 'route-source', `route source does not exist: ${route.source}`, route.source);
    const routeSegment = route.path.startsWith('/') ? route.path.slice(1) : route.path;
    check(
      appSource !== null && appSource.includes(`path: "${routeSegment}"`),
      'route-mounted',
      `${route.path} is not mounted by the officer console router`,
      'apps/officer-console/src/app.tsx',
    );
    check(
      routeSource !== null && !/\/(?:v1|api)\//.test(routeSource) && !/\bfetch\s*\(/.test(routeSource),
      'edge-boundary',
      `${route.source} must call the operation-id client instead of a raw browser URL or fetch`,
      route.source,
    );
  }

  const pathSource = source(root, 'packages/api-client/src/paths.ts');
  const activeOperations = new Set(
    [...(pathSource?.matchAll(/^\s*\{\s*id:\s*['"]([^'"]+)['"]/gm) ?? [])].map((match) => match[1]),
  );
  for (const operation of contract.operations) {
    check(activeOperations.has(operation), 'operation-registered', `${operation} is not active in EDGE_OPERATIONS`, 'packages/api-client/src/paths.ts');
  }

  for (const requirement of contract.ads) {
    const requirementSource = source(root, requirement.source);
    check(requirementSource !== null, 'ads-source', `${requirement.name} source does not exist: ${requirement.source}`, requirement.source);
    check(
      requirementSource !== null && requirementSource.includes(requirement.import),
      'ads-import',
      `${requirement.name} is not evidenced by the required import ${requirement.import}`,
      requirement.source,
    );
  }

  for (const state of contract.states) {
    const stateSource = source(root, state.source);
    check(stateSource !== null, 'state-source', `${state.surface} state source does not exist: ${state.source}`, state.source);
    check(
      hasAny(stateSource, state.evidence),
      'state-evidence',
      `${state.surface} is missing one or more required state evidence markers: ${state.evidence.join(', ')}`,
      state.source,
    );
    check(state.required.length > 0, 'state-declaration', `${state.surface} must declare required states`, state.source);
  }

  for (const testFile of contract.tests) {
    check(source(root, testFile) !== null, 'test-source', `declared proof does not exist: ${testFile}`, testFile);
  }

  const surfaceSources = new Set([
    ...contract.routes.map((route) => route.source),
    ...contract.ads.map((requirement) => requirement.source),
    ...contract.states.map((state) => state.source),
  ]);
  for (const file of surfaceSources) {
    const fileSource = source(root, file);
    check(
      fileSource !== null && !/nationalIdHash|document\.cookie|#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(fileSource),
      'platform-invariants',
      `${file} violates a surface platform invariant`,
      file,
    );
  }

  return { findings, assertions };
}

export function loadSurfaceContract(root: string, manifestPath: string): SurfaceContract {
  const absolute = resolve(root, manifestPath);
  return JSON.parse(readFileSync(absolute, 'utf8')) as SurfaceContract;
}

export function formatSurfaceReport(
  manifestPath: string,
  result: SurfaceVerification,
): string {
  const lines = ['surface-contract', `  manifest: ${manifestPath}`, `  assertions: ${result.assertions}`];
  if (result.findings.length === 0) {
    lines.push('  status: PASS');
    return lines.join('\n');
  }
  lines.push(`  status: FAIL (${result.findings.length} finding(s))`);
  for (const item of result.findings) {
    lines.push(`  - [${item.rule}] ${item.message}${item.file === undefined ? '' : ` (${item.file})`}`);
  }
  return lines.join('\n');
}
