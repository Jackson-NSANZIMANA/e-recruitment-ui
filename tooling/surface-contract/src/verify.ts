// ══════════════════════════════════════════════════════════════════
// surface-contract v2 — every route has a manifest, every manifest a rung,
// and every rung its evidence (ADR-FE-009).
//
// The ladder (packages/ui/src/readiness/model.ts holds the same list; the
// apps read the rung at build time and mount only SCREEN-BUILT and above in
// production):
//
//   DECLARED            a manifest exists; it names what it is blocked by
//   EDGE-AVAILABLE      every listed operation is active in api-client paths.ts
//   CLIENT-WIRED        every operation has a typed api-client call site
//   SCREEN-BUILT        the route source is not a placeholder, at least one
//                       state group is evidenced in source, and every literal
//                       i18n key the screen uses exists in en, rw and fr
//   E2E-PROVEN          every referenced spec exists and has no fixme/skip
//   LOAD-PROVEN         signed off outside this repo; the manifest records a
//   OPERATIONALLY-READY reference (evidence.signoff) and this tool cannot verify it
//
// Each rung includes every check below it. Coverage runs the other way too:
// a route mounted by any app with no manifest is a finding, because the apps
// fail closed on it in production and a silent disappearance is worse than a
// red build.
//
// Text-level and dependency-free on purpose, like contract-drift: it must run
// before `pnpm install`, in the hygiene job.
// ══════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export const RUNGS = [
  'DECLARED',
  'EDGE-AVAILABLE',
  'CLIENT-WIRED',
  'SCREEN-BUILT',
  'E2E-PROVEN',
  'LOAD-PROVEN',
  'OPERATIONALLY-READY',
] as const;
export type Rung = (typeof RUNGS)[number];

export const APPS = ['applicant-portal', 'officer-console', 'field-station'] as const;
export type AppName = (typeof APPS)[number];

export interface SurfaceRoute {
  readonly path: string;
  readonly app: string;
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

export interface SurfaceReadiness {
  readonly rung: string;
  readonly evidence?: {
    readonly e2e?: readonly string[];
    readonly contract?: string;
    readonly a11y?: string;
    readonly signoff?: string;
  };
  readonly blockedBy?: readonly string[];
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
  readonly readiness: SurfaceReadiness;
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

export interface LoadedSurface {
  readonly file: string;
  readonly contract: SurfaceContract;
}

export interface MountedRoute {
  readonly app: AppName;
  readonly path: string;
  readonly declaredIn: string;
}

export interface ReadinessRow {
  readonly app: string;
  readonly path: string;
  readonly rung: string;
  readonly surface: string;
}

export interface SurfaceSuiteResult {
  readonly findings: readonly SurfaceFinding[];
  readonly notes: readonly SurfaceFinding[];
  readonly assertions: number;
  readonly rows: readonly ReadinessRow[];
  readonly manifests: number;
}

// ── file helpers ──────────────────────────────────────────────────

function source(root: string, path: string): string | null {
  const absolute = resolve(root, path);
  const relativePath = relative(root, absolute);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) return null;
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

const rungIndex = (rung: string): number => (RUNGS as readonly string[]).indexOf(rung);
const atLeast = (rung: string, floor: Rung): boolean => rungIndex(rung) >= rungIndex(floor);

export function normalisePath(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, '');
  if (trimmed === '') return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

// ── mounted-route discovery ───────────────────────────────────────

const PATH_LITERAL = /\bpath:\s*["']([^"']+)["']/g;

function pathsIn(text: string): string[] {
  return [...stripComments(text).matchAll(PATH_LITERAL)].map((m) => m[1]!).filter((p) => p !== '/' && p !== '*' && p !== '');
}

/** The text of one named export (`export const X` / `export function X`) up to the next top-level export. */
export function exportSegment(text: string, name: string): string | null {
  const re = new RegExp(`export\\s+(?:const|function)\\s+${name}\\b`);
  const match = re.exec(text);
  if (match === null) return null;
  const rest = text.slice(match.index + match[0].length);
  const next = rest.search(/(?:^|[;\n])\s*export\s/);
  return next === -1 ? rest : rest.slice(0, next);
}

/**
 * Every path each app mounts: the literals in its app.tsx, plus the paths of
 * every slice route export its slices.tsx lists in MOUNTS. All three apps
 * mount slice routes at the root of their authenticated branch.
 */
export function discoverMountedRoutes(root: string): readonly MountedRoute[] {
  const mounted: MountedRoute[] = [];
  for (const app of APPS) {
    const appFile = `apps/${app}/src/app.tsx`;
    const appText = source(root, appFile);
    if (appText === null) continue;
    for (const path of pathsIn(appText)) mounted.push({ app, path: normalisePath(path), declaredIn: appFile });

    const slicesFile = `apps/${app}/src/routes/slices.tsx`;
    const slicesText = source(root, slicesFile);
    if (slicesText === null) continue;
    const clean = stripComments(slicesText);
    const sliceOf = new Map<string, string>();
    for (const imp of clean.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']@usrp\/feature-([a-z-]+)["']/g)) {
      for (const name of imp[1]!.split(',').map((n) => n.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean)) {
        sliceOf.set(name, imp[2]!);
      }
    }
    const mountsBlock = clean.slice(clean.indexOf('const MOUNTS'));
    for (const ref of mountsBlock.matchAll(/routes:\s*([A-Za-z_$][\w$]*)/g)) {
      const name = ref[1]!;
      const slice = sliceOf.get(name);
      if (slice === undefined) continue;
      const routesFile = `packages/features/${slice}/src/routes/index.tsx`;
      const routesText = source(root, routesFile);
      const segment = routesText === null ? null : exportSegment(routesText, name);
      if (segment === null) continue;
      for (const path of pathsIn(segment)) mounted.push({ app, path: normalisePath(path), declaredIn: routesFile });
    }
  }
  return mounted;
}

// ── evidence predicates ───────────────────────────────────────────

/** A one-line title screen, or a file that only re-exports another (followed). */
export function isPlaceholder(root: string, file: string, depth = 0): boolean {
  const text = source(root, file);
  if (text === null) return true;
  const code = stripComments(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const reexport = /^export\s*\{\s*(?:default|[A-Za-z_$][\w$]*\s+as\s+default)\b[^}]*\}\s*from\s*["'](\.[^"']+)["']/.exec(code.join('\n'));
  if (reexport !== null && code.length <= 3 && depth < 3) {
    const target = reexport[1]!.replace(/\.js$/, '');
    for (const ext of ['.tsx', '.ts']) {
      const candidate = join(dirname(file), `${target.replace(/\.tsx?$/, '')}${ext}`);
      if (source(root, candidate) !== null) return isPlaceholder(root, candidate, depth + 1);
    }
    return true;
  }
  return code.length <= 3;
}

/** The api-client call site for an operation, and whether it carries a real response type. */
export function typedCallSites(root: string): ReadonlyMap<string, { typed: boolean; decoded: boolean }> {
  const dir = resolve(root, 'packages/api-client/src/operations');
  const sites = new Map<string, { typed: boolean; decoded: boolean }>();
  if (!existsSync(dir)) return sites;
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const text = readFileSync(join(dir, name), 'utf8');
    for (const m of text.matchAll(/\bcall<([^>]+(?:>[^>(]*)?)>\(\s*["']([A-Za-z0-9]+)["']/g)) {
      const type = m[1]!.trim();
      const typed = !/^(?:unknown|Readonly<Record<string,\s*unknown>>|Record<string,\s*unknown>)$/.test(type);
      const decoded = /\bdecode[A-Z]\w*\(|ResultFromRefusal\(|\.parse\(/.test(text);
      const prior = sites.get(m[2]!);
      sites.set(m[2]!, { typed: typed || prior?.typed === true, decoded: decoded || prior?.decoded === true });
    }
    // A generic command helper (campaign-control.ts) calls `call<unknown>(operationId)`
    // and decodes afterwards; its operations are listed in an exported
    // `*_OPERATIONS = [...] as const`, and they count as typed only when the
    // same file declares a decoder.
    if (/\bdecode[A-Z]\w*\(/.test(text)) {
      for (const list of text.matchAll(/export const [A-Z_]+_OPERATIONS = \[([^\]]*)\] as const/g)) {
        for (const op of list[1]!.matchAll(/['"]([A-Za-z0-9]+)['"]/g)) sites.set(op[1]!, { typed: true, decoded: true });
      }
    }
  }
  return sites;
}

type LocaleTree = Readonly<Record<string, unknown>>;

function loadLocales(root: string): Record<'en' | 'rw' | 'fr', LocaleTree[]> {
  const out: Record<'en' | 'rw' | 'fr', LocaleTree[]> = { en: [], rw: [], fr: [] };
  for (const lang of ['en', 'rw', 'fr'] as const) {
    const common = source(root, `packages/i18n/src/locales/${lang}/common.json`);
    if (common !== null) out[lang].push(JSON.parse(common) as LocaleTree);
    const features = resolve(root, 'packages/features');
    if (!existsSync(features)) continue;
    for (const slice of readdirSync(features)) {
      const bundle = source(root, `packages/features/${slice}/locales/${lang}.json`);
      if (bundle !== null) out[lang].push(JSON.parse(bundle) as LocaleTree);
    }
  }
  return out;
}

function hasKey(trees: readonly LocaleTree[], key: string): boolean {
  return trees.some((tree) => {
    let node: unknown = tree;
    for (const part of key.split('.')) {
      if (node === null || typeof node !== 'object') return false;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string';
  });
}

/** Literal `t("a.b")` keys. Template-literal and computed keys are not judged. */
export function literalKeys(text: string): readonly string[] {
  return [...new Set([...stripComments(text).matchAll(/\bt\(\s*["']([a-z][\w]*(?:\.[\w]+)+)["']/g)].map((m) => m[1]!))];
}

// ── one manifest ──────────────────────────────────────────────────

export interface VerifyContext {
  readonly root: string;
  readonly mounted: readonly MountedRoute[];
  readonly activeOperations: ReadonlySet<string>;
  readonly callSites: ReadonlyMap<string, { typed: boolean; decoded: boolean }>;
  readonly locales: Record<'en' | 'rw' | 'fr', LocaleTree[]>;
  readonly backendSha: string | null;
}

export function buildContext(root: string): VerifyContext {
  const pathSource = source(root, 'packages/api-client/src/paths.ts') ?? '';
  return {
    root,
    mounted: discoverMountedRoutes(root),
    activeOperations: new Set([...pathSource.matchAll(/^\s*\{\s*id:\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]!)),
    callSites: typedCallSites(root),
    locales: loadLocales(root),
    backendSha: /EDGE_BACKEND_SHA = '([0-9a-f]{40})'/.exec(pathSource)?.[1] ?? null,
  };
}

export function verifySurfaceContract(contract: SurfaceContract, rootOrContext: string | VerifyContext): SurfaceVerification {
  const ctx = typeof rootOrContext === 'string' ? buildContext(rootOrContext) : rootOrContext;
  const { root } = ctx;
  const findings: SurfaceFinding[] = [];
  let assertions = 0;
  const check = (condition: boolean, rule: string, message: string, file?: string): void => {
    assertions += 1;
    if (!condition) findings.push({ severity: 'error', rule, message, ...(file === undefined ? {} : { file }) });
  };
  const note = (rule: string, message: string, file?: string): void => {
    findings.push({ severity: 'note', rule, message, ...(file === undefined ? {} : { file }) });
  };

  check(contract.schemaVersion === 2, 'schema-version', `${contract.id}: surface contract schemaVersion must be 2 (readiness ladder)`);
  check(/^[a-z0-9][a-z0-9.-]+$/.test(contract.id), 'surface-id', `invalid surface id: ${contract.id}`);
  check(Array.isArray(contract.routes) && contract.routes.length > 0, 'routes', `${contract.id}: surface must own at least one route`);
  check(
    (contract.operations ?? []).every((operation) => /^[A-Za-z][A-Za-z0-9]+$/.test(operation)),
    'operation-format',
    `${contract.id}: operation ids must be camelCase identifiers`,
  );

  const readiness = contract.readiness as SurfaceReadiness | undefined;
  const rung = readiness?.rung ?? '';
  check(rungIndex(rung) !== -1, 'readiness-rung', `${contract.id}: readiness.rung "${rung}" is not on the ladder (${RUNGS.join(' < ')})`);
  if (rungIndex(rung) === -1) return { findings, assertions };

  // ── routes: sources exist, are mounted where they claim, stay on the edge boundary
  for (const route of contract.routes) {
    const routeSource = source(root, route.source);
    check((APPS as readonly string[]).includes(route.app), 'route-app', `${contract.id}: ${route.path} names unknown app "${route.app}"`);
    check(route.path.startsWith('/'), 'route-path', `${contract.id}: route path must start with "/": ${route.path}`);
    check(routeSource !== null, 'route-source', `route source does not exist: ${route.source}`, route.source);
    check(
      ctx.mounted.some((m) => m.app === route.app && m.path === normalisePath(route.path)),
      'route-mounted',
      `${route.path} is not mounted by apps/${route.app} (app.tsx or a slice in routes/slices.tsx)`,
      `apps/${route.app}/src/app.tsx`,
    );
    const routeCode = routeSource === null ? null : stripComments(routeSource);
    check(
      routeCode !== null && !/\/(?:v1|api)\//.test(routeCode) && !/\bfetch\s*\(/.test(routeCode),
      'edge-boundary',
      `${route.source} must call the operation-id client instead of a raw browser URL or fetch`,
      route.source,
    );
  }

  // ── EDGE-AVAILABLE
  for (const operation of contract.operations ?? []) {
    if (atLeast(rung, 'EDGE-AVAILABLE')) {
      check(ctx.activeOperations.has(operation), 'operation-registered', `${contract.id}: ${operation} is not active in EDGE_OPERATIONS`, 'packages/api-client/src/paths.ts');
    } else if (!ctx.activeOperations.has(operation)) {
      note('operation-pending', `${contract.id}: ${operation} is not an edge operation yet (allowed at DECLARED)`);
    }
  }

  // ── CLIENT-WIRED
  if (atLeast(rung, 'CLIENT-WIRED')) {
    for (const operation of contract.operations ?? []) {
      check(
        ctx.callSites.get(operation)?.typed === true,
        'client-wired',
        `${contract.id}: ${operation} has no typed call site in packages/api-client/src/operations (CLIENT-WIRED needs one)`,
        'packages/api-client/src/operations',
      );
    }
    const undecoded = (contract.operations ?? []).filter((operation) => ctx.callSites.get(operation)?.decoded === false);
    if (undecoded.length > 0) note('undecoded', `${contract.id}: typed but not decoded at the boundary: ${undecoded.join(', ')}`);
  }

  // ── below SCREEN-BUILT, an unbuilt screen says what it is waiting for
  if (!atLeast(rung, 'SCREEN-BUILT')) {
    check(
      Array.isArray(readiness?.blockedBy) && readiness.blockedBy.length > 0,
      'blocked-by',
      `${contract.id}: a surface below SCREEN-BUILT must name what it is blocked by (readiness.blockedBy)`,
    );
  }

  // ── SCREEN-BUILT
  if (atLeast(rung, 'SCREEN-BUILT')) {
    check((contract.states ?? []).length > 0, 'states', `${contract.id}: SCREEN-BUILT needs at least one evidenced state group`);
    check((contract.ads ?? []).length > 0, 'ads', `${contract.id}: SCREEN-BUILT needs its ADS composition declared`);
    for (const route of contract.routes) {
      check(!isPlaceholder(root, route.source), 'screen-built', `${contract.id}: ${route.source} is a placeholder, which cannot be SCREEN-BUILT`, route.source);
    }
    const screenFiles = new Set([...contract.routes.map((r) => r.source), ...(contract.states ?? []).map((s) => s.source)]);
    for (const file of screenFiles) {
      const text = source(root, file);
      if (text === null) continue;
      for (const key of literalKeys(text)) {
        const missing = (['en', 'rw', 'fr'] as const).filter((lang) => !hasKey(ctx.locales[lang], key));
        check(missing.length === 0, 'locale-parity', `${contract.id}: "${key}" (${file}) is missing in ${missing.join(', ')}`, file);
      }
    }
  }

  // ── declared ADS and states, at any rung where they are given
  for (const requirement of contract.ads ?? []) {
    const requirementSource = source(root, requirement.source);
    check(requirementSource !== null, 'ads-source', `${requirement.name} source does not exist: ${requirement.source}`, requirement.source);
    check(
      requirementSource !== null && requirementSource.includes(requirement.import),
      'ads-import',
      `${requirement.name} is not evidenced by the required import ${requirement.import}`,
      requirement.source,
    );
  }
  for (const state of contract.states ?? []) {
    const stateSource = source(root, state.source);
    check(stateSource !== null, 'state-source', `${state.surface} state source does not exist: ${state.source}`, state.source);
    check(
      stateSource !== null && state.evidence.every((item) => stateSource.includes(item)),
      'state-evidence',
      `${state.surface} is missing one or more required state evidence markers: ${state.evidence.join(', ')}`,
      state.source,
    );
    check(state.required.length > 0, 'state-declaration', `${state.surface} must declare required states`, state.source);
  }
  for (const testFile of contract.tests ?? []) {
    check(source(root, testFile) !== null, 'test-source', `declared proof does not exist: ${testFile}`, testFile);
  }

  // ── E2E-PROVEN
  if (atLeast(rung, 'E2E-PROVEN')) {
    const specs = readiness?.evidence?.e2e ?? [];
    check(specs.length > 0, 'e2e-evidence', `${contract.id}: E2E-PROVEN needs readiness.evidence.e2e`);
    for (const spec of specs) {
      const text = source(root, spec);
      check(text !== null, 'e2e-exists', `${contract.id}: referenced spec does not exist: ${spec}`, spec);
      if (text === null) continue;
      check(/\btest\(/.test(text), 'e2e-has-tests', `${contract.id}: ${spec} declares no test()`, spec);
      check(!/\btest(?:\.describe)?\.(?:fixme|skip)\b|\.fixme\(|\.skip\(/.test(stripComments(text)), 'e2e-no-skip', `${contract.id}: ${spec} contains fixme/skip, which cannot prove E2E-PROVEN`, spec);
    }
  }

  // ── LOAD-PROVEN and OPERATIONALLY-READY: a reference, not a proof
  if (atLeast(rung, 'LOAD-PROVEN')) {
    const signoff = readiness?.evidence?.signoff ?? '';
    check(signoff.length >= 8, 'signoff', `${contract.id}: ${rung} is signed off outside this repo; record the reference in readiness.evidence.signoff`);
  }

  const contractSha = readiness?.evidence?.contract;
  if (contractSha !== undefined) {
    check(contractSha === ctx.backendSha, 'contract-sha', `${contract.id}: readiness.evidence.contract ${contractSha} is not the pinned EDGE_BACKEND_SHA ${String(ctx.backendSha)}`);
  }

  // ── platform invariants over every file the surface names
  const surfaceSources = new Set([
    ...contract.routes.map((route) => route.source),
    ...(contract.ads ?? []).map((requirement) => requirement.source),
    ...(contract.states ?? []).map((state) => state.source),
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

// ── the whole suite ───────────────────────────────────────────────

export function loadSurfaceContract(root: string, manifestPath: string): SurfaceContract {
  return JSON.parse(readFileSync(resolve(root, manifestPath), 'utf8')) as SurfaceContract;
}

export function loadAllSurfaces(root: string, dir = 'docs/ui-surfaces'): readonly LoadedSurface[] {
  const absolute = resolve(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ file: `${dir}/${name}`, contract: loadSurfaceContract(root, `${dir}/${name}`) }));
}

export function verifySurfaceSuite(root: string, surfaces: readonly LoadedSurface[] = loadAllSurfaces(root)): SurfaceSuiteResult {
  const ctx = buildContext(root);
  const all: SurfaceFinding[] = [];
  let assertions = 0;
  const rows: ReadinessRow[] = [];

  const ids = new Map<string, string>();
  for (const { file, contract } of surfaces) {
    assertions += 1;
    const prior = ids.get(contract.id);
    if (prior !== undefined) all.push({ severity: 'error', rule: 'surface-id-unique', message: `surface id ${contract.id} is declared by both ${prior} and ${file}`, file });
    ids.set(contract.id, file);
    const result = verifySurfaceContract(contract, ctx);
    all.push(...result.findings.map((f) => ({ ...f, file: f.file ?? file })));
    assertions += result.assertions;
    for (const route of contract.routes ?? []) {
      rows.push({ app: route.app, path: normalisePath(route.path), rung: contract.readiness?.rung ?? '(none)', surface: contract.id });
    }
  }

  // Coverage: every mounted route has exactly one manifest entry, and no app path is claimed twice.
  const claimed = new Map<string, string[]>();
  for (const row of rows) {
    const key = `${row.app} ${row.path}`;
    claimed.set(key, [...(claimed.get(key) ?? []), row.surface]);
  }
  for (const [key, owners] of claimed) {
    assertions += 1;
    if (owners.length > 1) all.push({ severity: 'error', rule: 'route-claimed-twice', message: `${key} is declared by ${owners.join(' and ')}` });
  }
  const seen = new Set<string>();
  for (const route of ctx.mounted) {
    const key = `${route.app} ${route.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    assertions += 1;
    if (!claimed.has(key)) {
      all.push({
        severity: 'error',
        rule: 'route-unmanifested',
        message: `apps/${route.app} mounts ${route.path} (${route.declaredIn}) and no docs/ui-surfaces manifest declares it; production would not mount it`,
        file: route.declaredIn,
      });
    }
  }

  rows.sort((a, b) => a.app.localeCompare(b.app) || a.path.localeCompare(b.path));
  return {
    findings: all.filter((f) => f.severity === 'error'),
    notes: all.filter((f) => f.severity === 'note'),
    assertions,
    rows,
    manifests: surfaces.length,
  };
}

export function formatSuiteReport(result: SurfaceSuiteResult): string {
  const lines = ['surface-contract', `  manifests: ${result.manifests}`, `  routes: ${result.rows.length}`, `  assertions: ${result.assertions}`];
  const width = Math.max(...result.rows.map((r) => r.path.length), 4);
  lines.push('  readiness:');
  for (const row of result.rows) {
    const shipped = atLeast(row.rung, 'SCREEN-BUILT') ? 'prod' : 'dev only';
    lines.push(`    ${row.app.padEnd(17)} ${row.path.padEnd(width)}  ${row.rung.padEnd(19)} ${shipped.padEnd(8)}  ${row.surface}`);
  }
  for (const n of result.notes) lines.push(`  note [${n.rule}] ${n.message}`);
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

/** Single-manifest report, kept for `--manifest`. */
export function formatSurfaceReport(manifestPath: string, result: SurfaceVerification): string {
  const errors = result.findings.filter((f) => f.severity === 'error');
  const lines = ['surface-contract', `  manifest: ${manifestPath}`, `  assertions: ${result.assertions}`];
  if (errors.length === 0) {
    lines.push('  status: PASS');
    return lines.join('\n');
  }
  lines.push(`  status: FAIL (${errors.length} finding(s))`);
  for (const item of errors) lines.push(`  - [${item.rule}] ${item.message}${item.file === undefined ? '' : ` (${item.file})`}`);
  return lines.join('\n');
}
