import type { ExtractedService } from './extract.ts';

export interface RouteFactLike { readonly service: string; readonly operationId: string; readonly method: string; readonly path: string; readonly auth: readonly string[]; readonly reach: string; }
export interface ManifestRoute { readonly method: string; readonly path: string; readonly auth: readonly string[]; readonly constant: string | null; readonly controller: string; readonly mounted: boolean; }
export interface ManifestService { readonly controllerDir: string | null; readonly readinessCallback: boolean; readonly routes: readonly ManifestRoute[]; }
export interface Manifest { readonly backendSha: string; readonly services: Readonly<Record<string, ManifestService>>; }
export type Severity = 'error' | 'note';
export interface Finding { readonly gate: 'A' | 'B' | 'C'; readonly severity: Severity; readonly service: string; readonly message: string; }

const PROBE_PATHS = new Set(['/health', '/ready']);
const key = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;

export function gateA(routeTable: readonly RouteFactLike[], manifest: Manifest): { findings: readonly Finding[]; assertions: number } {
  const findings: Finding[] = [];
  let assertions = 0;
  const documented = new Map<string, RouteFactLike[]>();
  for (const route of routeTable) {
    if (PROBE_PATHS.has(route.path)) continue;
    const list = documented.get(route.service) ?? [];
    list.push(route);
    documented.set(route.service, list);
  }
  const services = new Set([...Object.keys(manifest.services), ...documented.keys()]);
  for (const service of [...services].sort()) {
    const expected = manifest.services[service]?.routes ?? null;
    const actual = documented.get(service) ?? [];
    assertions += 1;
    if (expected === null) { findings.push({ gate: 'A', severity: 'error', service, message: 'documented in openapi/ but absent from route-manifest.json — every service must appear in both, including the ones with no business routes' }); continue; }
    if (!Object.hasOwn(manifest.services, service)) continue;
    const expectedByKey = new Map(expected.map((r) => [key(r.method, r.path), r]));
    const actualByKey = new Map(actual.map((r) => [key(r.method, r.path), r]));
    for (const [k, route] of expectedByKey) {
      assertions += 1;
      const found = actualByKey.get(k);
      if (found === undefined) { findings.push({ gate: 'A', severity: 'error', service, message: `MISSING ROUTE: the backend serves ${k} (${route.controller}) and no OpenAPI operation describes it` }); continue; }
      assertions += 1;
      const expectedAuth = [...route.auth].sort().join('|');
      const actualAuth = [...found.auth].sort().join('|');
      if (expectedAuth !== actualAuth) findings.push({ gate: 'A', severity: 'error', service, message: `CHANGED AUTH KIND on ${k}: manifest says [${expectedAuth}], ${found.operationId} says [${actualAuth}]. Getting this wrong either locks out a legitimate caller or exposes a system-token route.` });
      assertions += 1;
      const expectReach = route.auth.includes('system') ? 'service-internal' : null;
      if (expectReach !== null && found.reach !== expectReach) findings.push({ gate: 'A', severity: 'error', service, message: `REACH MISMATCH on ${k}: a system-token route must be x-usrp-reach: service-internal, got "${found.reach}". Proxying one to a browser is a security incident.` });
    }
    for (const [k, route] of actualByKey) { assertions += 1; if (!expectedByKey.has(k)) findings.push({ gate: 'A', severity: 'error', service, message: `EXTRA ROUTE: operation ${route.operationId} documents ${k}, which the backend does not serve. A client generated from this would call a 404.` }); }
    for (const probe of PROBE_PATHS) { assertions += 1; if (!routeTable.some((r) => r.service === service && r.path === probe)) findings.push({ gate: 'A', severity: 'error', service, message: `no operation documents GET ${probe}; shared-http reserves it on every service` }); }
  }
  return { findings, assertions };
}

export function gateB(manifest: Manifest, extracted: readonly ExtractedService[]): { findings: readonly Finding[]; assertions: number } {
  const findings: Finding[] = [];
  let assertions = 0;
  const byService = new Map(extracted.map((s) => [s.service, s]));
  for (const [service, expected] of Object.entries(manifest.services)) {
    const actual = byService.get(service);
    assertions += 1;
    if (actual === undefined) { findings.push({ gate: 'B', severity: 'error', service, message: `the manifest names this service and the backend checkout has no services/${service} directory` }); continue; }
    for (const problem of actual.problems) findings.push({ gate: 'B', severity: 'error', service, message: `extractor: ${problem}` });
    assertions += 1;
    if (expected.readinessCallback !== actual.readinessCallback) findings.push({ gate: 'B', severity: 'error', service, message: `readiness callback: manifest says ${String(expected.readinessCallback)}, source says ${String(actual.readinessCallback)}. GET /ready either checks a dependency or it does not, and the difference decides whether an orchestrator routes traffic to a broken service.` });
    const expectedByKey = new Map(expected.routes.map((r) => [key(r.method, r.path), r]));
    const actualByKey = new Map(actual.routes.filter((r) => r.path !== null).map((r) => [key(r.method, r.path!), r]));
    for (const [k, route] of expectedByKey) {
      assertions += 1;
      const found = actualByKey.get(k);
      if (found === undefined) { findings.push({ gate: 'B', severity: 'error', service, message: `manifest claims ${k} but no route registration in the backend source produces it. Either the backend removed it or the manifest is stale.` }); continue; }
      assertions += 1;
      const a = [...route.auth].sort().join('|'); const b = [...found.auth].sort().join('|');
      if (a !== b) findings.push({ gate: 'B', severity: 'error', service, message: `auth kind drifted on ${k}: manifest [${a}], source [${b}] (${found.controller}:${found.line})` });
      if (route.constant !== null) { assertions += 1; if (!actual.pathConstants.has(route.constant)) findings.push({ gate: 'B', severity: 'error', service, message: `manifest names path constant ${route.constant} for ${k}, which this service no longer exports` }); }
    }
    for (const [k, route] of actualByKey) { assertions += 1; if (!expectedByKey.has(k)) findings.push({ gate: 'B', severity: 'error', service, message: `NEW BACKEND ROUTE, undocumented: ${k} (${route.controller}:${route.line}). Add it to the manifest and to openapi/, or the frontend is contracting against a surface that has moved.` }); }
  }
  return { findings, assertions };
}

/** Gate C — every exported *_PATH must be used by a route factory actually passed to startHttpServer. */
export function gateC(extracted: readonly ExtractedService[]): { findings: readonly Finding[]; assertions: number } {
  const findings: Finding[] = [];
  let assertions = 0;
  for (const service of extracted) {
    for (const [constant] of service.pathConstants) {
      assertions += 1;
      const owner = service.routes.find((route) => route.constant === constant);
      if (owner === undefined) { findings.push({ gate: 'C', severity: 'error', service: service.service, message: `${constant} is exported but no route registration uses it — a path constant with no route` }); continue; }
      assertions += 1;
      if (owner.controller === 'src/main.ts (inline)') continue;
      const factory = owner.factory;
      if (factory === null) { findings.push({ gate: 'C', severity: 'error', service: service.service, message: `${owner.controller} defines ${constant} but its route has no enclosing exported factory` }); continue; }
      assertions += 1;
      if (!service.mountedFactories.includes(factory)) findings.push({ gate: 'C', severity: 'error', service: service.service, message: `${owner.controller} defines ${constant} through ${factory}(), but ${factory}() is not present in main.ts routes[]. The controller may be imported yet still be unreachable dead code answering the transport's own 404.` });
    }
  }
  return { findings, assertions };
}
