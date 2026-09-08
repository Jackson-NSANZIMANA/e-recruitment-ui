// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — the exact-path build guard
//
//   pnpm --filter @usrp/api-client check:paths
//
// FAILS THE BUILD on any template literal that interpolates a value into a
// URL-shaped string. This is the guard the task asked for, and it exists because
// the failure it prevents is invisible in development:
//
//   `/v1/applications/${id}`  type-checks perfectly, reads like every other REST
//                             client on earth, and can never be matched by
//                             `shared-http`, which routes by EXACT path with no
//                             param syntax (ADR-005). Result: a 404 in
//                             production from code that passed every check.
//
// Regex-based on purpose. A full AST pass would need a TypeScript program, which
// means the guard cannot run before typecheck and cannot run on a broken tree —
// and the moment a guard is slow or fragile it gets skipped. This reads files and
// exits non-zero. It also SELF-TESTS against known-bad and known-good fixtures on
// every run, so a guard that has quietly stopped matching anything fails loudly
// instead of passing everything.
// ══════════════════════════════════════════════════════════════════

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * A template literal, with every `${...}` replaced by a placeholder.
 *
 * The discriminator is then dead simple and hard to argue with: a URL contains a
 * `/` and NO SPACES; prose contains spaces. That one distinction separates
 * `` `/v1/applications/${id}` `` and `` `${base}/v1/applications/${id}` `` from
 * `` `@usrp/api-client disagrees with @usrp/contracts: ${problems}` `` — and
 * keeping the rule this cheap is what keeps the guard enabled.
 */
const PLACEHOLDER = '';

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly reason: string;
}

/** Every template literal on a line, normalised to placeholders. */
function normalisedTemplates(line: string): readonly string[] {
  const templates: string[] = [];
  let index = 0;
  while (index < line.length) {
    const open = line.indexOf('`', index);
    if (open === -1) break;
    const close = line.indexOf('`', open + 1);
    if (close === -1) break;
    templates.push(line.slice(open + 1, close).replace(/\$\{[^}]*\}/g, PLACEHOLDER));
    index = close + 1;
  }
  return templates;
}

/** A quoted API path glued to a variable with `+`. The pre-template idiom. */
const SUSPICIOUS_CONCAT = /['"]\/(?:v1|edge)\/[^'"]*['"]\s*\+/;

export function scanSource(source: string, file: string): readonly Violation[] {
  const violations: Violation[] = [];

  source.split('\n').forEach((line, index) => {
    // A comment explaining the banned pattern must not violate it, or the
    // documentation of the rule becomes a failure of the rule.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    for (const template of normalisedTemplates(line)) {
      const interpolates = template.includes(PLACEHOLDER);
      const pathShaped = template.includes('/') && !/\s/.test(template);
      if (interpolates && pathShaped) {
        violations.push({
          file,
          line: index + 1,
          text: trimmed,
          reason: 'a template literal interpolates a value into a URL-shaped string',
        });
        return;
      }
    }
    if (SUSPICIOUS_CONCAT.test(line)) {
      violations.push({ file, line: index + 1, text: trimmed, reason: 'an API path concatenated with a variable' });
      return;
    }
  });

  return violations;
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      yield* walk(full);
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) yield full;
  }
}

/**
 * Prove the guard still bites before trusting it to pass.
 *
 * The lesson from the backend's own green-but-hollow CI: a check that runs zero
 * assertions reports success. So the guard is verified in BOTH directions on
 * every invocation.
 */
function selfTest(): readonly string[] {
  const problems: string[] = [];

  const shouldFail: readonly string[] = [
    'const url = `/v1/applications/${id}`;',
    'return client.get(`/applications/${applicationId}/status`);',
    "const path = '/v1/applications/' + applicationId;",
    'await fetch(`${base}/v1/applications/${id}`);',
  ];
  for (const sample of shouldFail) {
    if (scanSource(sample, 'selftest').length === 0) {
      problems.push(`guard FAILED to flag a known-bad line: ${sample}`);
    }
  }

  const shouldPass: readonly string[] = [
    "const url = '/edge/v1/applications';",
    'client.call("findApplicationById", { query: { applicationId } });',
    'const label = `${count} applications`;',
    'throw new Error(`Unknown edge operation "${id}".`);',
    "const key = ['applications', 'detail', applicationId];",
    // The false positive this guard produced on its OWN first run: an error
    // message mentioning two scoped package names contains a slash. Spaces are
    // what separate prose from a path, and this fixture pins that forever.
    'super(`@usrp/api-client disagrees with @usrp/contracts:\\n  ${problems.join(\'x\')}`);',
    'process.stdout.write(`  scanned ${scanned} files in src/ ok`);',
  ];
  for (const sample of shouldPass) {
    if (scanSource(sample, 'selftest').length > 0) {
      problems.push(`guard WRONGLY flagged a known-good line: ${sample}`);
    }
  }

  return problems;
}

async function main(): Promise<void> {
  const selfTestProblems = selfTest();
  if (selfTestProblems.length > 0) {
    process.stderr.write('\n  ✗ exact-path guard SELF-TEST failed — the guard itself is broken:\n');
    for (const problem of selfTestProblems) process.stderr.write(`      ${problem}\n`);
    process.stderr.write('\n');
    process.exit(1);
  }

  const root = new URL('../src', import.meta.url).pathname;
  const violations: Violation[] = [];
  let scanned = 0;
  for await (const file of walk(root)) {
    scanned += 1;
    violations.push(...scanSource(await readFile(file, 'utf8'), relative(root, file)));
  }

  if (violations.length > 0) {
    process.stderr.write(`\n  ✗ exact-path guard: ${violations.length} interpolated URL(s) found.\n\n`);
    for (const violation of violations) {
      process.stderr.write(`      ${violation.file}:${violation.line}  ${violation.reason}\n          ${violation.text}\n`);
    }
    process.stderr.write(
      [
        '',
        '  shared-http routes by EXACT PATH ONLY and has no param syntax (ADR-005).',
        '  IDs travel in the request body (POST) or a query param (GET, ?applicationId=).',
        '  Add the operation to EDGE_OPERATIONS in src/paths.ts and call it by id.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  process.stdout.write(
    `\n  ✓ exact-path guard: ${scanned} files scanned, 0 interpolated URLs; guard self-test green (11 fixtures, both directions).\n\n`,
  );
}

// Only run when invoked as a script. `scanSource` is exported so the guard can be
// exercised from a test without the CLI firing as a side effect of the import.
const invokedDirectly = process.argv[1] !== undefined && process.argv[1].endsWith('check-exact-paths.ts');
if (invokedDirectly) await main();
