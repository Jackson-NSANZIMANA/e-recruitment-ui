// ════════════════════════════════════════════════════════════════
// Edge registry reconciliation.
//
// The service route drift checker proves upstream controller facts. This gate
// proves the browser boundary separately: the frontend operation registry must
// agree with the backend edge registry on the actual method, path, session kind,
// retry policy and composition. Operation names are intentionally not compared
// because the frontend may use a product-friendly alias (requestOtp) while the
// edge keeps a transport-facing name (requestApplicantOtp).
//
// This parser is deliberately dependency-free. CI checks out a different
// repository without installing its node_modules; reading the data registry as
// source keeps the proof runnable and conservative.
// ════════════════════════════════════════════════════════════════

export interface EdgeRegistryOperation {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly session: string;
  readonly retryOnG2G: boolean;
  readonly composition: string;
}

export interface EdgeFinding {
  readonly gate: 'D';
  readonly severity: 'error';
  readonly service: 'edge-gateway';
  readonly message: string;
}

function registryBlock(source: string, name: 'frontend' | 'backend'): string {
  const marker = name === 'frontend' ? 'export const EDGE_OPERATIONS = [' : 'export const EDGE_OPERATIONS = Object.freeze({';
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`${name} edge registry marker not found`);
  const endMarker = name === 'frontend' ? '] as const satisfies' : '} as const satisfies';
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error(`${name} edge registry terminator not found`);
  return source.slice(start, end);
}

function property(body: string, key: string): string | undefined {
  const match = body.match(new RegExp(`\\b${key}\\s*:\\s*['\"]([^'\"]+)['\"]`));
  return match?.[1];
}

function boolProperty(body: string, key: string): boolean | undefined {
  const match = body.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)`));
  return match?.[1] === 'true' ? true : match?.[1] === 'false' ? false : undefined;
}

function parseOperation(body: string, id: string, pathKey: 'edgePath' | 'path'): EdgeRegistryOperation {
  const method = property(body, 'method');
  const path = property(body, pathKey);
  const session = property(body, 'session');
  const composition = property(body, 'composition');
  const retryOnG2G = boolProperty(body, 'retryOnG2G');
  const missing = [
    method === undefined ? 'method' : null,
    path === undefined ? pathKey : null,
    session === undefined ? 'session' : null,
    composition === undefined ? 'composition' : null,
    retryOnG2G === undefined ? 'retryOnG2G' : null,
  ].filter((value): value is string => value !== null);
  if (missing.length > 0) throw new Error(`${id} is missing ${missing.join(', ')}`);
  return {
    id,
    method: method!,
    path: path!,
    session: session!,
    composition: composition!,
    retryOnG2G: retryOnG2G!,
  };
}

export function parseFrontendEdgeRegistry(source: string): readonly EdgeRegistryOperation[] {
  const block = registryBlock(source, 'frontend');
  const operations: EdgeRegistryOperation[] = [];
  for (const match of block.matchAll(/^\s*\{\s*id:\s*['"]([^'"]+)['"]\s*,([^}]*)\}/gm)) {
    operations.push(parseOperation(match[2]!, match[1]!, 'edgePath'));
  }
  if (operations.length === 0) throw new Error('frontend edge registry contains no operations');
  return operations;
}

export function parseBackendEdgeRegistry(source: string): readonly EdgeRegistryOperation[] {
  const block = registryBlock(source, 'backend');
  const operations: EdgeRegistryOperation[] = [];
  for (const match of block.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*:\s*\{([^\n]*)\},?\s*$/gm)) {
    operations.push(parseOperation(match[2]!, property(match[2]!, 'operationId') ?? match[1]!, 'path'));
  }
  if (operations.length === 0) throw new Error('backend edge registry contains no operations');
  return operations;
}

function key(operation: EdgeRegistryOperation): string {
  return `${operation.method.toUpperCase()} ${operation.path}`;
}

export function gateD(
  frontendSource: string,
  backendSource: string,
): { readonly findings: readonly EdgeFinding[]; readonly assertions: number } {
  const findings: EdgeFinding[] = [];
  let assertions = 0;
  let frontend: readonly EdgeRegistryOperation[];
  let backend: readonly EdgeRegistryOperation[];
  try {
    frontend = parseFrontendEdgeRegistry(frontendSource);
    backend = parseBackendEdgeRegistry(backendSource);
  } catch (error) {
    findings.push({
      gate: 'D',
      severity: 'error',
      service: 'edge-gateway',
      message: error instanceof Error ? error.message : String(error),
    });
    return { findings, assertions: 1 };
  }

  const frontendByKey = new Map(frontend.map((operation) => [key(operation), operation]));
  const backendByKey = new Map(backend.map((operation) => [key(operation), operation]));
  assertions += 1;
  for (const operation of backend) {
    const found = frontendByKey.get(key(operation));
    assertions += 1;
    if (found === undefined) {
      findings.push({
        gate: 'D',
        severity: 'error',
        service: 'edge-gateway',
        message: `MISSING FRONTEND EDGE OPERATION: backend registry serves ${key(operation)} as ${operation.id}, but packages/api-client/src/paths.ts does not expose it.`,
      });
      continue;
    }
    for (const field of ['session', 'composition'] as const) {
      assertions += 1;
      if (found[field] !== operation[field]) {
        findings.push({
          gate: 'D',
          severity: 'error',
          service: 'edge-gateway',
          message: `${field} drift on ${key(operation)}: backend=${operation[field]}, frontend=${found[field]} (${found.id}).`,
        });
      }
    }
    assertions += 1;
    if (found.retryOnG2G !== operation.retryOnG2G) {
      findings.push({
        gate: 'D',
        severity: 'error',
        service: 'edge-gateway',
        message: `retry policy drift on ${key(operation)}: backend=${String(operation.retryOnG2G)}, frontend=${String(found.retryOnG2G)} (${found.id}).`,
      });
    }
  }
  for (const operation of frontend) {
    assertions += 1;
    if (!backendByKey.has(key(operation))) {
      findings.push({
        gate: 'D',
        severity: 'error',
        service: 'edge-gateway',
        message: `EXTRA FRONTEND EDGE OPERATION: ${key(operation)} (${operation.id}) has no matching backend edge registry entry.`,
      });
    }
  }
  return { findings, assertions };
}
