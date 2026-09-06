#!/usr/bin/env node
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAllContracts, topoSortSchemas, type ServiceContract } from './openapi/ir.ts';
import { BANNER, describeOperationTable, emitZod, schemaConst } from './openapi/emit.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const OPENAPI_DIR = join(ROOT, 'openapi');
const OUT_DIR = join(ROOT, 'src/generated');
const identifier = (service: string): string => service.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function emitZodModule(contract: ServiceContract): string {
  const parts: string[] = [BANNER(contract.service, contract.backendSha, contract.file), `//\n// ${contract.title}\n//\n// Route table (method, path, auth kinds, reach):\n${describeOperationTable(contract)}\n`, `import { z } from 'zod';\n`];
  for (const name of topoSortSchemas(contract)) {
    const node = contract.schemas.get(name)!;
    const description = node['description'];
    if (typeof description === 'string' && description.length > 0) {
      const wrapped = description.split('\n').flatMap((line) => line.match(/.{1,74}(\s|$)/g) ?? [line]).map((line) => ` * ${line.trimEnd()}`).join('\n');
      parts.push(`/**\n${wrapped}\n */`);
    }
    parts.push(`export const ${schemaConst(name)} = ${emitZod(node, contract.file)};\n`);
  }
  parts.push(`export const ${identifier(contract.service)}Operations = {`);
  for (const op of contract.operations) {
    const responses = op.responses.map((r) => `      ${JSON.stringify(r.status)}: ${r.schema === null ? 'null' : schemaConst(r.schema)},`).join('\n');
    parts.push(`  ${JSON.stringify(op.operationId)}: {\n    method: ${JSON.stringify(op.method.toUpperCase())},\n    path: ${JSON.stringify(op.path)},\n    auth: ${JSON.stringify(op.auth)},\n    reach: ${JSON.stringify(op.reach)},\n    request: ${op.requestSchema === null ? 'null' : schemaConst(op.requestSchema)},\n    requestMediaType: ${JSON.stringify(op.requestMediaType)},\n    query: ${JSON.stringify(op.queryParams)},\n    responses: {\n${responses}\n    },\n  },`);
  }
  parts.push(`} as const;\n`);
  return parts.join('\n');
}

function emitTypesModule(contract: ServiceContract): string {
  const order = topoSortSchemas(contract);
  return [BANNER(contract.service, contract.backendSha, contract.file), `import type { z } from 'zod';`, `import type {\n${order.map((n) => `  ${schemaConst(n)},`).join('\n')}\n} from './${contract.service}.zod.js';\n`, ...order.map((name) => `export type ${name} = z.infer<typeof ${schemaConst(name)}>;`), ''].join('\n');
}

function emitRoutesModule(contracts: readonly ServiceContract[]): string {
  const rows = contracts.flatMap((contract) => contract.operations.map((op) => ({ service: contract.service, operationId: op.operationId, method: op.method.toUpperCase(), path: op.path, auth: [...op.auth], reach: op.reach, verified: op.verified, source: op.source, statuses: op.responses.map((r) => r.status) })));
  rows.sort((a, b) => a.service === b.service ? (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)) : a.service.localeCompare(b.service));
  return `${BANNER('routes', contracts[0]!.backendSha, '*.yaml')}\nexport interface RouteFact { readonly service: string; readonly operationId: string; readonly method: string; readonly path: string; readonly auth: readonly string[]; readonly reach: string; readonly verified: string; readonly source: string; readonly statuses: readonly string[]; }\n\nexport const ROUTE_TABLE: readonly RouteFact[] = ${JSON.stringify(rows, null, 2)} as const;\nexport const BROWSER_ROUTES: readonly RouteFact[] = ROUTE_TABLE.filter((route) => route.reach === 'browser');\nexport const SERVICE_INTERNAL_ROUTES: readonly RouteFact[] = ROUTE_TABLE.filter((route) => route.reach === 'service-internal');\n`;
}

function emitBarrel(contracts: readonly ServiceContract[]): string {
  const lines = contracts.flatMap((contract) => [`export * as ${identifier(contract.service)} from './${contract.service}.zod.js';`, `export type * as ${identifier(contract.service)}Types from './${contract.service}.types.js';`]);
  return `${BANNER('index', contracts[0]!.backendSha, '*.yaml')}\n${lines.join('\n')}\nexport { ROUTE_TABLE, BROWSER_ROUTES, SERVICE_INTERNAL_ROUTES } from './routes.js';\nexport type { RouteFact } from './routes.js';\n`;
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
  console.log(`generated ${readdirSync(OUT_DIR).length} files from ${contracts.length} documents: ${operations} operations, ${schemas} schemas`);
  console.log(`backend SHA: ${contracts[0]!.backendSha}`);
}
main();
