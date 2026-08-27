#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// pnpm --filter @usrp/contracts verify   —  "prove it, don't assert it"
//
// Five gates. Exit non-zero if any that RAN failed, and print which ones did
// not run and why. The backend's own doctrine is that a green-but-hollow gate is
// worse than no gate, so a gate that cannot run says so instead of passing.
//
//   1  DETERMINISM      regenerate into a temp dir; every committed file under
//                       src/generated must be byte-identical. Plus `git diff
//                       --exit-code` when git is available.
//   2  DRIFT            tooling/contract-drift gate A (B and C with --backend).
//   3  DRIFT SELFTEST   the drift tool is made to go RED on every drift kind it
//                       claims to catch. Gate 2 passing means nothing without
//                       this one.
//   4  FIXTURES         every mined response fixture round-trips: positives are
//                       accepted, NEGATIVES ARE REJECTED. The negatives are what
//                       make this a proof — a schema of z.unknown() passes every
//                       positive fixture ever written.
//   5  ZOD PARITY       the generated Zod schemas reach the same verdict as the
//                       structural validator on all 4's cases. Needs `zod`
//                       installed; SKIPPED LOUDLY otherwise.
// ════════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAllContracts, loadContract, type ServiceContract } from './openapi/ir.ts';
import { BANNER } from './openapi/emit.ts';
import { validateAgainst } from './openapi/validate.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const REPO = new URL('../../..', import.meta.url).pathname;

interface GateResult {
  readonly name: string;
  readonly assertions: number;
  readonly failures: readonly string[];
  readonly skipped?: string;
}

const results: GateResult[] = [];

function node(script: string, args: readonly string[] = []): string {
  return execFileSync(process.execPath, ['--experimental-strip-types', script, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// ── Gate 1: determinism + zero diff ───────────────────────────────────

function gateDeterminism(): GateResult {
  const failures: string[] = [];
  let assertions = 0;
  const outDir = join(ROOT, 'src/generated');
  const committed = new Map<string, string>();
  for (const file of readdirSync(outDir).sort()) {
    committed.set(file, readFileSync(join(outDir, file), 'utf8'));
  }
  assertions += 1;
  if (committed.size === 0) {
    failures.push('src/generated is empty — nothing has been generated and committed');
    return { name: 'determinism', assertions, failures };
  }

  // Regenerate in place (the generator is idempotent) and compare.
  node(join(ROOT, 'scripts/generate.ts'));
  const after = readdirSync(outDir).sort();
  assertions += 1;
  if (after.length !== committed.size) {
    failures.push(
      `regenerating changed the FILE SET: ${committed.size} committed, ${after.length} produced`,
    );
  }
  for (const file of after) {
    assertions += 1;
    const before = committed.get(file);
    const now = readFileSync(join(outDir, file), 'utf8');
    if (before === undefined) {
      failures.push(`regenerating produced a file that is not committed: ${file}`);
      continue;
    }
    if (before !== now) {
      failures.push(
        `${file} differs from the committed output. Either the generator is not deterministic, or someone edited a generated file by hand.`,
      );
    }
  }

  // Belt and braces: git's own opinion, when git is available.
  try {
    execFileSync('git', ['diff', '--exit-code', '--', 'packages/contracts/src/generated'], {
      cwd: REPO,
      stdio: 'ignore',
    });
    assertions += 1;
  } catch (err) {
    const code = (err as { status?: number }).status;
    if (code === 1) {
      failures.push('git diff reports changes under src/generated after regenerating');
      assertions += 1;
    }
    // Any other failure means git or the repo is unavailable — gate 1's
    // byte-comparison above already covered the same ground.
  }
  return { name: 'determinism + zero diff', assertions, failures };
}

// ── Gate 2 + 3: drift ─────────────────────────────────────────────────

function gateDrift(backend: string | null): GateResult {
  const failures: string[] = [];
  const args = backend === null ? [] : ['--backend', backend];
  let assertions = 0;
  try {
    const out = node(join(REPO, 'tooling/contract-drift/src/cli.ts'), args);
    const match = /OK\s+(\d+) assertions/.exec(out);
    assertions = match === null ? 1 : Number.parseInt(match[1]!, 10);
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    failures.push(`contract-drift exited non-zero:\n${e.stdout ?? ''}${e.stderr ?? ''}`);
  }
  return {
    name: 'contract drift',
    assertions,
    failures,
    ...(backend === null
      ? {
          skipped:
            'gates B and C (manifest vs live backend source) need a checkout: pass --backend <path> or set USRP_BACKEND_PATH',
        }
      : {}),
  };
}

function gateDriftSelftest(): GateResult {
  const failures: string[] = [];
  let assertions = 0;
  try {
    const out = node(join(REPO, 'tooling/contract-drift/src/selftest.ts'));
    const match = /selftest OK — (\d+) assertions/.exec(out);
    assertions = match === null ? 1 : Number.parseInt(match[1]!, 10);
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    failures.push(`the drift tool failed to prove it can go red:\n${e.stdout ?? ''}${e.stderr ?? ''}`);
  }
  return { name: 'drift selftest (can the gate go red?)', assertions, failures };
}

// ── Gate 4 + 5: fixtures ──────────────────────────────────────────────

interface FixtureCase {
  readonly id: string;
  readonly schema: string;
  readonly expect: 'accept' | 'reject';
  readonly why: string;
  readonly value: unknown;
}

interface FixtureFile {
  readonly service: string;
  readonly cases: readonly FixtureCase[];
}

function loadFixtures(): readonly FixtureFile[] {
  const dir = join(ROOT, 'fixtures');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.fixtures.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as FixtureFile);
}

function gateFixtures(
  contracts: readonly ServiceContract[],
  fixtures: readonly FixtureFile[],
): GateResult {
  const failures: string[] = [];
  let assertions = 0;
  const byService = new Map(contracts.map((c) => [c.service, c]));

  for (const file of fixtures) {
    const contract = byService.get(file.service);
    assertions += 1;
    if (contract === undefined) {
      failures.push(`${file.service}: fixtures exist for a service with no OpenAPI document`);
      continue;
    }
    const ids = new Set<string>();
    for (const testCase of file.cases) {
      assertions += 1;
      if (ids.has(testCase.id)) {
        failures.push(`${file.service}/${testCase.id}: duplicate case id`);
      }
      ids.add(testCase.id);

      assertions += 1;
      if (typeof testCase.why !== 'string' || testCase.why.length < 20) {
        failures.push(
          `${file.service}/${testCase.id}: every case must carry provenance in "why". An unexplained fixture is a fixture nobody can maintain.`,
        );
      }

      assertions += 1;
      const violations = validateAgainst(
        testCase.schema,
        testCase.value,
        contract.schemas,
        contract.file,
      );
      const accepted = violations.length === 0;
      if (testCase.expect === 'accept' && !accepted) {
        failures.push(
          `${file.service}/${testCase.id}: expected ACCEPT of ${testCase.schema}, rejected — ${violations
            .map((v) => `${v.path}: ${v.message}`)
            .join('; ')}`,
        );
      }
      if (testCase.expect === 'reject' && accepted) {
        failures.push(
          `${file.service}/${testCase.id}: expected REJECT of ${testCase.schema} and it was ACCEPTED. Why it matters: ${testCase.why}`,
        );
      }
    }
  }

  // Every business operation's documented success body must be exercised.
  for (const contract of contracts) {
    const covered = new Set(
      fixtures
        .filter((f) => f.service === contract.service)
        .flatMap((f) => f.cases.map((c) => c.schema)),
    );
    for (const op of contract.operations) {
      if (op.path === '/health' || op.path === '/ready') continue;
      const success = op.responses.find((r) => r.status.startsWith('2') && r.schema !== null);
      if (success === undefined) continue;
      assertions += 1;
      if (!covered.has(success.schema!)) {
        failures.push(
          `${contract.service}/${op.operationId}: its ${success.status} body (${success.schema!}) has no fixture. An unexercised success shape is an unproven one.`,
        );
      }
    }
  }
  return { name: 'fixture round-trip (structural)', assertions, failures };
}

async function gateZodParity(
  contracts: readonly ServiceContract[],
  fixtures: readonly FixtureFile[],
): Promise<GateResult> {
  const failures: string[] = [];
  let assertions = 0;
  try {
    await import('zod');
  } catch {
    return {
      name: 'zod parity',
      assertions: 0,
      failures: [],
      skipped:
        'the `zod` package does not resolve here, so the GENERATED schemas were not executed. Gate 4 proved the fixtures against the same IR the emitter reads, but the emitted code itself is unproven until `pnpm install` has run. Run `pnpm --filter @usrp/contracts verify` in an installed workspace before treating this suite as complete.',
    };
  }
  const byService = new Map(contracts.map((c) => [c.service, c]));
  for (const file of fixtures) {
    const contract = byService.get(file.service);
    if (contract === undefined) continue;
    const mod = (await import(`../src/generated/${contract.service}.zod.ts`)) as Record<
      string,
      { safeParse: (value: unknown) => { success: boolean; error?: unknown } }
    >;
    for (const testCase of file.cases) {
      assertions += 1;
      const schema = mod[`${testCase.schema}Schema`];
      if (schema === undefined) {
        failures.push(
          `${file.service}/${testCase.id}: the generated module exports no ${testCase.schema}Schema`,
        );
        continue;
      }
      const zodAccepted = schema.safeParse(testCase.value).success;
      const structural =
        validateAgainst(testCase.schema, testCase.value, contract.schemas, contract.file).length ===
        0;
      assertions += 1;
      if (zodAccepted !== structural) {
        failures.push(
          `${file.service}/${testCase.id}: THE TWO READERS DISAGREE — zod says ${
            zodAccepted ? 'accept' : 'reject'
          }, the structural validator says ${
            structural ? 'accept' : 'reject'
          }. One of them is wrong about the contract.`,
        );
      }
      assertions += 1;
      if (zodAccepted !== (testCase.expect === 'accept')) {
        failures.push(
          `${file.service}/${testCase.id}: the generated Zod schema expected to ${testCase.expect} and did not`,
        );
      }
    }
  }
  return { name: 'zod parity', assertions, failures };
}


// ── Gate 6: the proposed/ directory must never leak into generation ────

function gateProposedIsolation(contracts: readonly ServiceContract[]): GateResult {
  const failures: string[] = [];
  let assertions = 0;
  const dir = join(ROOT, 'openapi/proposed');
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((name) => name.endsWith('.yaml'));
  } catch {
    return { name: 'proposed isolation', assertions: 0, failures: [], skipped: 'no openapi/proposed directory' };
  }
  const real = new Set(
    contracts.flatMap((c) => c.operations.map((op) => `${op.method.toUpperCase()} ${op.path}`)),
  );
  const realIds = new Set(contracts.flatMap((c) => c.operations.map((op) => op.operationId)));
  for (const file of files) {
    assertions += 1;
    const proposal = loadContract(dir, file);
    for (const op of proposal.operations) {
      assertions += 1;
      const key = `${op.method.toUpperCase()} ${op.path}`;
      if (real.has(key)) {
        failures.push(
          `proposed/${file}: ${key} (${op.operationId}) is ALSO in a live document. A proposal that has landed must be moved out of proposed/, not duplicated — two descriptions of one endpoint is the exact failure this package exists to end.`,
        );
      }
      assertions += 1;
      if (realIds.has(op.operationId)) {
        failures.push(`proposed/${file}: operationId ${op.operationId} collides with a live operation`);
      }
      assertions += 1;
      if (!op.operationId.startsWith('proposed')) {
        failures.push(
          `proposed/${file}: ${op.operationId} must be named proposed* so a grep for it in application code is unambiguous`,
        );
      }
    }
  }
  return { name: 'proposed isolation (nothing unbuilt can generate a client)', assertions, failures };
}

// ── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const backendIndex = argv.indexOf('--backend');
  const backend =
    backendIndex === -1 ? (process.env['USRP_BACKEND_PATH'] ?? null) : (argv[backendIndex + 1] ?? null);

  const contracts = loadAllContracts(join(ROOT, 'openapi'));
  const fixtures = loadFixtures();

  results.push(gateDeterminism());
  results.push(gateDrift(backend));
  results.push(gateDriftSelftest());
  results.push(gateFixtures(contracts, fixtures));
  results.push(await gateZodParity(contracts, fixtures));
  results.push(gateProposedIsolation(contracts));

  const totalAssertions = results.reduce((n, r) => n + r.assertions, 0);
  const failed = results.filter((r) => r.failures.length > 0);

  console.log('@usrp/contracts verify');
  console.log(`  backend SHA: ${contracts[0]!.backendSha}`);
  console.log(
    `  scope: ${contracts.length} documents, ${contracts.reduce((n, c) => n + c.operations.length, 0)} operations, ${contracts.reduce((n, c) => n + c.schemas.size, 0)} schemas, ${fixtures.reduce((n, f) => n + f.cases.length, 0)} fixture cases`,
  );
  console.log('');
  for (const result of results) {
    const status =
      result.failures.length > 0 ? 'FAIL' : result.skipped !== undefined && result.assertions === 0 ? 'SKIP' : 'PASS';
    console.log(`  ${status}  ${result.name} — ${result.assertions} assertions`);
    if (result.skipped !== undefined) console.log(`        NOTE: ${result.skipped}`);
  }
  console.log('');

  if (failed.length > 0) {
    console.error(`VERIFY FAILED — ${failed.length} gate(s), ${totalAssertions} assertions run.`);
    for (const result of failed) {
      console.error(`\n  ${result.name}:`);
      for (const failure of result.failures) console.error(`    ✗ ${failure}`);
    }
    console.error('');
    process.exit(1);
  }
  console.log(`ALL GATES GREEN — ${totalAssertions} assertions.`);
  const skipped = results.filter((r) => r.skipped !== undefined);
  if (skipped.length > 0) {
    console.log(`(${skipped.length} gate(s) reported reduced scope; see the NOTEs above.)`);
  }
}

void main();
