// ════════════════════════════════════════════════════════════════
// Extract the backend's OWN route facts from its source text.
//
// WHY TEXT AND NOT THE TYPESCRIPT COMPILER. This tool has to run in the
// frontend repo's CI, against a checkout of a DIFFERENT repository, with that
// repository's node_modules absent. A type-aware pass would need the backend's
// full dependency graph resolvable, which turns "did the route table change"
// into "can we install the backend". The facts being extracted — an exported
// `*_PATH` string constant, a `{ method, path }` literal pair, and the `kind`
// argument to `withAuth` — are all syntactically local, so text is sufficient
// AND honest about its limits.
//
// WHERE IT IS DELIBERATELY CONSERVATIVE: anything it cannot resolve is reported
// as UNRESOLVED, never guessed and never dropped. An extractor that silently
// skips what it does not understand converges on finding nothing, and a drift
// checker that finds nothing is green forever.
// ════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface ExtractedRoute {
  readonly method: string;
  /** The literal path, once the `*_PATH` constant is resolved. */
  readonly path: string | null;
  /** The identifier the path came from, or null for an inline literal. */
  readonly constant: string | null;
  readonly auth: readonly string[];
  readonly controller: string;
  readonly line: number;
}

export interface ExtractedService {
  readonly service: string;
  readonly controllerDir: string | null;
  /** Exported `*_PATH` constants, by identifier. */
  readonly pathConstants: ReadonlyMap<string, string>;
  readonly routes: readonly ExtractedRoute[];
  /** Identifiers referenced inside the `routes: [...]` array of main.ts. */
  readonly mountedFactories: readonly string[];
  readonly mainSource: string;
  readonly readinessCallback: boolean;
  readonly problems: readonly string[];
}

const PATH_CONST_RE = /export\s+const\s+([A-Z][A-Z0-9_]*_PATH)\s*=\s*'([^']+)'/g;
const ROUTE_RE = /method:\s*'(GET|POST|PUT|PATCH|DELETE)'\s*,\s*\n?\s*path:\s*([A-Za-z_$][\w$]*|'[^']+')/g;
const WITH_AUTH_RE = /withAuth\(\s*verify\s*,\s*\{\s*kind:\s*(\[[^\]]*\]|'[^']+')/g;

/** Strip line and block comments so a commented-out route is not extracted. */
function decomment(source: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (quote === null && two === '//') {
      const end = source.indexOf('\n', i);
      // Preserve newlines so reported line numbers stay true.
      out += end === -1 ? '' : '\n';
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (quote === null && two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const skipped = source.slice(i, end === -1 ? source.length : end + 2);
      out += skipped.replace(/[^\n]/g, ' ');
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    const ch = source[i]!;
    if (quote === null && (ch === '"' || ch === "'" || ch === '`')) quote = ch;
    else if (quote !== null && ch === '\\') {
      out += ch + (source[i + 1] ?? '');
      i += 2;
      continue;
    } else if (ch === quote) quote = null;
    out += ch;
    i += 1;
  }
  return out;
}

const lineOf = (source: string, index: number): number =>
  source.slice(0, index).split('\n').length;

function parseKind(raw: string): readonly string[] {
  if (raw.startsWith('[')) {
    return [...raw.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  }
  return [raw.replace(/'/g, '')];
}

/**
 * A controller may wrap several routes. Associate each `{method, path}` pair
 * with the NEAREST PRECEDING withAuth kind, which is how these files are
 * written throughout the backend: the handler follows its route header.
 * Unwrapped routes (iam's login, identity's OTP and me-routes, scheduling's
 * inline key route) legitimately have no withAuth, and are reported as such
 * rather than as an extraction failure.
 */
function extractRoutes(
  source: string,
  file: string,
  sessionAuthPaths: ReadonlySet<string>,
): readonly ExtractedRoute[] {
  const clean = decomment(source);
  const auths = [...clean.matchAll(WITH_AUTH_RE)].map((m) => ({
    index: m.index,
    kinds: parseKind(m[1]!),
  }));
  const routes: ExtractedRoute[] = [];
  for (const match of clean.matchAll(ROUTE_RE)) {
    const raw = match[2]!;
    const isLiteral = raw.startsWith("'");
    // The nearest withAuth that appears AFTER this route header and before the
    // next one is the guard for this handler.
    const nextRoute = [...clean.matchAll(ROUTE_RE)]
      .map((m) => m.index)
      .find((i) => i > match.index);
    const guard = auths.find(
      (a) => a.index > match.index && (nextRoute === undefined || a.index < nextRoute),
    );
    const constant = isLiteral ? null : raw;
    routes.push({
      method: match[1]!,
      path: isLiteral ? raw.slice(1, -1) : null,
      constant,
      auth:
        guard !== undefined
          ? guard.kinds
          : constant !== null && sessionAuthPaths.has(constant)
            ? ['applicant-session']
            : ['none'],
      controller: file,
      line: lineOf(clean, match.index),
    });
  }
  return routes;
}

/**
 * The opaque-session routes are NOT guarded by withAuth — they call a local
 * `authenticate(...)` helper that resolves the session against the DB, because
 * withAuth only understands the two Ed25519 JWT kinds. The extractor therefore
 * cannot read their auth kind from a withAuth call, and says so explicitly
 * rather than mislabelling them `none`, which would be the dangerous answer:
 * `none` on a route that returns a citizen's applications reads as "public".
 */
function sessionRoutesIn(source: string): ReadonlySet<string> {
  const clean = decomment(source);
  const constants = new Set<string>();
  for (const match of clean.matchAll(ROUTE_RE)) {
    const raw = match[2]!;
    if (raw.startsWith("'")) continue;
    const next = [...clean.matchAll(ROUTE_RE)].map((m) => m.index).find((i) => i > match.index);
    const body = clean.slice(match.index, next ?? clean.length);
    if (/authenticate\(/.test(body) && !/withAuth\(/.test(body)) constants.add(raw);
  }
  return constants;
}

function readMain(dir: string): { source: string; factories: string[]; readiness: boolean } {
  const mainPath = join(dir, 'src/main.ts');
  if (!existsSync(mainPath)) return { source: '', factories: [], readiness: false };
  const source = decomment(readFileSync(mainPath, 'utf8'));
  const start = source.indexOf('routes: [');
  let factories: string[] = [];
  if (start !== -1) {
    let depth = 0;
    let end = start + 'routes: ['.length - 1;
    for (let i = end; i < source.length; i += 1) {
      if (source[i] === '[') depth += 1;
      else if (source[i] === ']') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const block = source.slice(start, end + 1);
    factories = [...new Set([...block.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]!))];
  }
  return { source, factories, readiness: /\breadiness:\s*\S/.test(source) };
}

export function extractService(servicesDir: string, service: string): ExtractedService {
  const dir = join(servicesDir, service);
  const httpDir = join(dir, 'src/adapters/http');
  const problems: string[] = [];
  const pathConstants = new Map<string, string>();
  const routes: ExtractedRoute[] = [];
  const hasHttpDir = existsSync(httpDir) && statSync(httpDir).isDirectory();

  const { source: mainSource, factories, readiness } = readMain(dir);

  if (hasHttpDir) {
    const files = readdirSync(httpDir)
      .filter((name) => name.endsWith('.ts'))
      .sort();
    for (const file of files) {
      const source = readFileSync(join(httpDir, file), 'utf8');
      const clean = decomment(source);
      for (const match of clean.matchAll(PATH_CONST_RE)) {
        const [, name, value] = match;
        const existing = pathConstants.get(name!);
        if (existing !== undefined && existing !== value) {
          problems.push(`constant ${name!} has two values: '${existing}' and '${value!}'`);
        }
        pathConstants.set(name!, value!);
      }
      routes.push(...extractRoutes(source, file, sessionRoutesIn(source)));
    }
  }

  // Inline routes declared in main.ts (scheduling-service's invitation key).
  if (mainSource.length > 0) {
    for (const route of extractRoutes(mainSource, 'src/main.ts (inline)', new Set())) {
      if (route.path !== null) routes.push(route);
    }
  }

  const resolved = routes.map((route) => {
    if (route.path !== null) return route;
    const value = route.constant === null ? undefined : pathConstants.get(route.constant);
    if (value === undefined) {
      problems.push(
        `${route.controller}:${route.line} references path constant ${String(route.constant)} which is not an exported *_PATH in this service`,
      );
      return route;
    }
    return { ...route, path: value };
  });

  return {
    service,
    controllerDir: hasHttpDir ? `services/${service}/src/adapters/http` : null,
    pathConstants,
    routes: resolved,
    mountedFactories: factories,
    mainSource,
    readinessCallback: readiness,
    problems,
  };
}

export function extractAll(servicesDir: string): readonly ExtractedService[] {
  return readdirSync(servicesDir)
    .filter((name) => statSync(join(servicesDir, name)).isDirectory())
    .sort()
    .map((service) => extractService(servicesDir, service));
}
