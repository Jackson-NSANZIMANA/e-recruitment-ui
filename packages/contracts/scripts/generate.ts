#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// pnpm --filter @usrp/contracts generate
//
// openapi/*.yaml  ->  src/generated/<service>.zod.ts   (Zod schemas)
//                 ->  src/generated/<service>.types.ts (types, via z.infer)
//                 ->  src/generated/routes.ts          (the route table)
//                 ->  src/generated/index.ts           (namespaced barrel)
//
// THE ORDER MATTERS AND IS THE POINT: schemas are generated from the OpenAPI,
// and types are generated FROM THE SCHEMAS via z.infer. A hand-written type
// beside a generated schema is two truths; z.infer makes the runtime validator
// and the compile-time type the same artifact, so a schema that is wrong is
// wrong in both places at once and cannot pass one gate while failing the
// other.
//
// Output is DETERMINISTIC — sorted keys, dependency-first ordering, no
// timestamps. `verify` regenerates and asserts a zero git diff, which is only
// a meaningful gate if a second run of the same input is byte-identical.
// ════════════════════════════════════════════════════════════════

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAllContracts, topoSortSchemas, type ServiceContract } from './openapi/ir.ts';
import { BANNER, describeOperationTable, emitZod, schemaConst } from './openapi/emit.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const OPENAPI_DIR = join(ROOT, 'openapi');
const OUT_DIR = join(ROOT, 'src/generated');

const identifier = (service: string): string =>
  service.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function emitZodModule(contract: ServiceContract): string {
  const order = topoSortSchemas(contract);
  const parts: string[] = [];
  parts.push(BANNER(contract.service, contract.backendSha, contract.file));
  parts.push(`//
// ${contract.title}
//
// Route table (method, path, auth kinds, reach):
${describeOperationTable(contract)}
//
// \`.strict()\` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.
`);
  parts.push(`import { z } from 'zod';\n`);

  for (const name of order) {
    const node = contract.schemas.get(name)!;
    const description = node['description'];
    if (typeof description === 'string' && description.length > 0) {
      const wrapped = description
        .split('\n')
        .flatMap((line) => line.match(/.{1,74}(\s|$)/g) ?? [line])
        .map((line) => ` * ${line.trimEnd()}`)
        .join('\n');
      parts.push(`/**\n${wrapped}\n */`);
    }
    parts.push(`export const ${schemaConst(name)} = ${emitZod(node, contract.file)};\n`);
  }

  // Per-operation response maps: status -> schema. This is what lets a client
  // pick the right validator from the status code it actually received, rather
  // than assuming 2xx and guessing on everything else.
  parts.push(`/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this service is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const ${identifier(contract.service)}Operations = {`);
  for (const op of contract.operations) {
    const responses = op.responses
      .map(
        (r) =>
          `      ${JSON.stringify(r.status)}: ${r.schema === null ? 'null' : schemaConst(r.schema)},`,
      )
      .join('\n');
    parts.push(`  ${JSON.stringify(op.operationId)}: {
    method: ${JSON.stringify(op.method.toUpperCase())},
    path: ${JSON.stringify(op.path)},
    auth: ${JSON.stringify(op.auth)},
    reach: ${JSON.stringify(op.reach)},
    request: ${op.requestSchema === null ? 'null' : schemaConst(op.requestSchema)},
    requestMediaType: ${JSON.stringify(op.requestMediaType)},
    query: ${JSON.stringify(op.queryParams)},
    responses: {
${responses}
    },
  },`);
  }
  parts.push(`} as const;\n`);
  return parts.join('\n');
}

function emitTypesModule(contract: ServiceContract): string {
  const order = topoSortSchemas(contract);
  const parts: string[] = [];
  parts.push(BANNER(contract.service, contract.backendSha, contract.file));
  parts.push(`//
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.
`);
  parts.push(`import type { z } from 'zod';`);
  parts.push(
    `import type {\n${order.map((n) => `  ${schemaConst(n)},`).join('\n')}\n} from './${contract.service}.zod.js';\n`,
  );
  for (const name of order) {
    parts.push(`export type ${name} = z.infer<typeof ${schemaConst(name)}>;`);
  }
  parts.push('');
  return parts.join('\n');
}

function emitRoutesModule(contracts: readonly ServiceContract[]): string {
  const rows = contracts.flatMap((contract) =>
    contract.operations.map((op) => ({
      service: contract.service,
      operationId: op.operationId,
      method: op.method.toUpperCase(),
      path: op.path,
      auth: [...op.auth],
      reach: op.reach,
      verified: op.verified,
      source: op.source,
      statuses: op.responses.map((r) => r.status),
    })),
  );
  rows.sort((a, b) =>
    a.service === b.service
      ? a.path === b.path
        ? a.method.localeCompare(b.method)
        : a.path.localeCompare(b.path)
      : a.service.localeCompare(b.service),
  );
  const business = rows.filter((r) => r.path !== '/health' && r.path !== '/ready');
  return `${BANNER('routes', contracts[0]!.backendSha, '*.yaml')}
//
// THE ROUTE TABLE, as data. tooling/contract-drift diffs this against the
// backend's own \`*_PATH\` constants and route registrations, so this file is the
// machine-readable half of "the frontend and the backend agree about what
// exists".
//
// ${business.length} business operations + ${rows.length - business.length} probes = ${rows.length} total.

export interface RouteFact {
  readonly service: string;
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly auth: readonly string[];
  readonly reach: string;
  readonly verified: string;
  readonly source: string;
  readonly statuses: readonly string[];
}

export const ROUTE_TABLE: readonly RouteFact[] = ${JSON.stringify(rows, null, 2)} as const;

/** Everything a browser may legitimately reach. */
export const BROWSER_ROUTES: readonly RouteFact[] = ROUTE_TABLE.filter(
  (route) => route.reach === 'browser',
);

/**
 * System-token routes. PROXYING ONE OF THESE TO A BROWSER IS A SECURITY
 * INCIDENT, not a convenience — that is why the set is exported as data an
 * edge-tier check can assert against instead of a comment reviewers must
 * remember.
 */
export const SERVICE_INTERNAL_ROUTES: readonly RouteFact[] = ROUTE_TABLE.filter(
  (route) => route.reach === 'service-internal',
);
`;
}

function emitBarrel(contracts: readonly ServiceContract[]): string {
  const lines = contracts.flatMap((contract) => [
    `export * as ${identifier(contract.service)} from './${contract.service}.zod.js';`,
    `export type * as ${identifier(contract.service)}Types from './${contract.service}.types.js';`,
  ]);
  return `${BANNER('index', contracts[0]!.backendSha, '*.yaml')}
//
// NAMESPACED ON PURPOSE. Eleven services independently name a schema \`Uuid\`,
// and six of them name one \`Forbidden403\` — with THREE genuinely different
// shapes behind that name across the platform. A flat barrel would have to pick
// a winner and would silently hand callers the wrong 403. Namespaces make the
// service you are talking to part of the type you import.

${lines.join('\n')}
export { ROUTE_TABLE, BROWSER_ROUTES, SERVICE_INTERNAL_ROUTES } from './routes.js';
export type { RouteFact } from './routes.js';
`;
}

function main(): void {
  const contracts = loadAllContracts(OPENAPI_DIR);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  for (const contract of contracts) {
    writeFileSync(join(OUT_DIR, `${contract.service}.zod.ts`), emitZodModule(contract), 'utf8');
    writeFileSync(join(OUT_DIR, `${contract.service}.types.ts`), emitTypesModule(contract), 'utf8');
  }
  writeFileSync(join(OUT_DIR, 'routes.ts'), emitRoutesModule(contracts), 'utf8');
  writeFileSync(join(OUT_DIR, 'index.ts'), emitBarrel(contracts), 'utf8');

  const operations = contracts.reduce((n, c) => n + c.operations.length, 0);
  const schemas = contracts.reduce((n, c) => n + c.schemas.size, 0);
  const files = readdirSync(OUT_DIR).length;
  console.log(
    `generated ${files} files from ${contracts.length} documents: ${operations} operations, ${schemas} schemas`,
  );
  console.log(`backend SHA: ${contracts[0]!.backendSha}`);
}

main();
