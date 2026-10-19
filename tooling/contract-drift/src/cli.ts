#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// tooling/contract-drift — the machinery that replaces vigilance.
//
//   node --experimental-strip-types tooling/contract-drift/src/cli.ts
//   node ... cli.ts --backend ../e-recruitment        # adds gates B and C
//
// Exit 0 only when every gate that ran is clean. Exit 1 on ANY mismatch:
// missing route, extra route, changed method, changed auth kind, changed reach,
// a route built and never mounted, or a readiness probe that stopped checking
// anything.
//
// GATE A NEEDS NOTHING BUT THIS REPO and therefore runs in every CI job. Gates
// B and C need a backend checkout and are SKIPPED LOUDLY when it is absent —
// skipped, and reported as skipped, because a gate that quietly downgrades
// itself to green is the hollow gate this project's own doctrine names as worse
// than no gate at all.
// ════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extractAll } from './extract.ts';
import { gateA, gateB, gateC, type Finding, type Manifest } from './drift.ts';
import { gateD, parseFrontendEdgeRegistry } from './edge.ts';
import { gateE, readBackendEdgeContract } from './parity.ts';
import { ROUTE_TABLE } from '../../../packages/contracts/src/generated/routes.ts';

const HERE = new URL('..', import.meta.url).pathname;

function parseArgs(argv: readonly string[]): { backend: string | null } {
  const index = argv.indexOf('--backend');
  if (index === -1) return { backend: process.env['USRP_BACKEND_PATH'] ?? null };
  const value = argv[index + 1];
  if (value === undefined) {
    console.error('--backend requires a path to an e-recruitment checkout');
    process.exit(2);
  }
  return { backend: value };
}

function report(findings: readonly Finding[]): void {
  const byGate = new Map<string, Finding[]>();
  for (const finding of findings) {
    const list = byGate.get(finding.gate) ?? [];
    list.push(finding);
    byGate.set(finding.gate, list);
  }
  for (const gate of [...byGate.keys()].sort()) {
    console.error(`\n  gate ${gate}:`);
    for (const finding of byGate.get(gate)!) {
      console.error(`    [${finding.service}] ${finding.message}`);
    }
  }
}

function main(): void {
  const { backend } = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(
    readFileSync(join(HERE, 'route-manifest.json'), 'utf8'),
  ) as Manifest;

  const findings: Finding[] = [];
  let assertions = 0;
  const ran: string[] = [];
  const skipped: string[] = [];

  const a = gateA(ROUTE_TABLE, manifest);
  findings.push(...a.findings);
  assertions += a.assertions;
  ran.push(`A openapi<->manifest (${a.assertions} assertions)`);

  if (backend === null) {
    skipped.push('B manifest<->backend source: no checkout. Pass --backend <path> or set USRP_BACKEND_PATH.');
    skipped.push('C built-but-unmounted routes: needs the same checkout.');
    skipped.push('D frontend edge registry<->backend edge registry: needs the same checkout.');
    skipped.push('E contract parity v2 (request/response schema, 409/422 outcomes, idempotency): needs the same checkout.');
  } else {
    const servicesDir = resolve(backend, 'services');
    if (!existsSync(servicesDir)) {
      console.error(`\nFAIL: ${servicesDir} does not exist — that is not an e-recruitment checkout.`);
      process.exit(2);
    }
    const extracted = extractAll(servicesDir);
    const b = gateB(manifest, extracted);
    const c = gateC(extracted);
    const edgeRegistryPath = join(backend, 'services/edge-gateway/src/domain/edge-operations.ts');
    const frontendEdgeRegistryPath = resolve(HERE, '../../packages/api-client/src/paths.ts');
    if (!existsSync(edgeRegistryPath)) {
      findings.push({ gate: 'D', severity: 'error', service: 'edge-gateway', message: `backend edge registry is missing: ${edgeRegistryPath}` });
      assertions += 1;
    } else {
      const d = gateD(readFileSync(frontendEdgeRegistryPath, 'utf8'), readFileSync(edgeRegistryPath, 'utf8'));
      findings.push(...d.findings);
      assertions += d.assertions;
      ran.push(`D frontend edge registry<->backend edge registry (${d.assertions} assertions)`);
    }
    // Gate E — contract parity v2 against the backend's own edge document.
    const edgeDocPath = join(backend, 'services/edge-gateway/openapi/edge-v1.yaml');
    if (!existsSync(edgeDocPath)) {
      findings.push({ gate: 'E', severity: 'error', service: 'edge-gateway', message: `backend edge document is missing: ${edgeDocPath}` });
      assertions += 1;
    } else {
      const repo = resolve(HERE, '../..');
      const opsDir = join(repo, 'packages/api-client/src/operations');
      const e = gateE(readBackendEdgeContract(readFileSync(edgeDocPath, 'utf8')), {
        registry: parseFrontendEdgeRegistry(readFileSync(frontendEdgeRegistryPath, 'utf8')).map((o) => ({ id: o.id, method: o.method, path: o.path })),
        wireSource: readFileSync(join(repo, 'packages/api-client/src/wire.ts'), 'utf8'),
        operationSources: readdirSync(opsDir).filter((n) => n.endsWith('.ts')).map((n) => readFileSync(join(opsDir, n), 'utf8')),
        readFile: (p) => (existsSync(join(repo, p)) ? readFileSync(join(repo, p), 'utf8') : null),
      });
      for (const f of e.findings) {
        findings.push({ gate: 'E', severity: f.severity, service: 'edge-gateway', message: `[${f.dimension}] ${f.operation}: ${f.message}` });
      }
      assertions += e.assertions;
      ran.push(`E contract parity v2: request/response schema, 409/422 outcomes, idempotency (${e.assertions} assertions)`);
    }
    findings.push(...b.findings, ...c.findings);
    assertions += b.assertions + c.assertions;
    ran.push(`B manifest<->backend source (${b.assertions} assertions)`);
    ran.push(`C built-but-unmounted routes (${c.assertions} assertions)`);
  }

  console.log('contract-drift');
  console.log(`  backend SHA pinned by manifest: ${manifest.backendSha}`);
  for (const line of ran) console.log(`  RAN     ${line}`);
  for (const line of skipped) console.log(`  SKIPPED ${line}`);

  const errors = findings.filter((f) => f.severity === 'error');
  if (errors.length > 0) {
    console.error(`\nDRIFT DETECTED — ${errors.length} finding(s), ${assertions} assertions run.`);
    report(errors);
    console.error('');
    process.exit(1);
  }
  const notes = findings.filter((f) => f.severity === 'note');
  for (const n of notes) console.log(`  note    gate ${n.gate} ${n.message}`);
  console.log(`  OK      ${assertions} assertions, 0 findings${notes.length > 0 ? ` (${notes.length} note(s))` : ''}`);
  if (skipped.length > 0) {
    console.log('\n  NOTE: gates B and C did not run. Gate A alone proves the OpenAPI matches');
    console.log('        the pinned manifest; it CANNOT tell you the manifest still matches the');
    console.log('        backend. Run with --backend before trusting this as a full check.');
  }
}

main();
