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

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extractAll } from './extract.ts';
import { gateA, gateB, gateC, type Finding, type Manifest } from './drift.ts';
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
  } else {
    const servicesDir = resolve(backend, 'services');
    if (!existsSync(servicesDir)) {
      console.error(`\nFAIL: ${servicesDir} does not exist — that is not an e-recruitment checkout.`);
      process.exit(2);
    }
    const extracted = extractAll(servicesDir);
    const b = gateB(manifest, extracted);
    const c = gateC(extracted);
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
  console.log(`  OK      ${assertions} assertions, 0 findings`);
  if (skipped.length > 0) {
    console.log('\n  NOTE: gates B and C did not run. Gate A alone proves the OpenAPI matches');
    console.log('        the pinned manifest; it CANNOT tell you the manifest still matches the');
    console.log('        backend. Run with --backend before trusting this as a full check.');
  }
}

main();
