#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// pnpm --filter @usrp/contracts lint          (and --filter @usrp/shared-types)
//
//   node --experimental-strip-types scripts/lint/cli.ts --package contracts
//   node --experimental-strip-types scripts/lint/cli.ts --package shared-types
//
// Zero dependencies, so it runs before `pnpm install` has ever succeeded — the
// same property the backend's selfcheck has and for the same reason: a gate you
// cannot run on a cold machine is a gate that stops being run.
// ════════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACT_RULES,
  SHARED_TYPES_RULES,
  runRules,
  type LintFile,
  type Rule,
} from './rules.ts';

const CONTRACTS_ROOT = fileURLToPath(new URL('../..', import.meta.url));

interface Target {
  readonly name: string;
  readonly root: string;
  readonly rules: readonly Rule[];
  readonly dirs: readonly string[];
}

const TARGETS: readonly Target[] = [
  {
    name: '@usrp/contracts',
    root: CONTRACTS_ROOT,
    rules: CONTRACT_RULES,
    dirs: ['src', 'scripts', 'test'],
  },
  {
    name: '@usrp/shared-types',
    root: join(CONTRACTS_ROOT, '..', 'shared-types'),
    rules: SHARED_TYPES_RULES,
    dirs: ['src', 'test'],
  },
];

function collect(root: string, dirs: readonly string[]): readonly LintFile[] {
  const files: LintFile[] = [];
  const walk = (absolute: string): void => {
    let entries: readonly string[] = [];
    try {
      entries = readdirSync(absolute);
    } catch {
      return;
    }
    for (const entry of [...entries].sort()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      const child = join(absolute, entry);
      if (statSync(child).isDirectory()) {
        walk(child);
        continue;
      }
      if (!entry.endsWith('.ts')) continue;
      files.push({
        path: relative(root, child).split(sep).join('/'),
        source: readFileSync(child, 'utf8'),
      });
    }
  };
  for (const dir of dirs) walk(join(root, dir));
  return files;
}

function main(): void {
  const argv = process.argv.slice(2);
  const index = argv.indexOf('--package');
  const wanted = index === -1 ? 'contracts' : (argv[index + 1] ?? 'contracts');
  const target = TARGETS.find((candidate) => candidate.name.endsWith(`/${wanted}`));
  if (target === undefined) {
    console.error(
      `unknown --package "${wanted}". Known: ${TARGETS.map((t) => t.name.replace('@usrp/', '')).join(', ')}`,
    );
    process.exit(2);
    return;
  }

  const files = collect(target.root, target.dirs);
  if (files.length === 0) {
    console.error(`${target.name}: lint matched NO files under ${target.dirs.join(', ')}.`);
    console.error('A linter with nothing to lint is a green tick that means nothing. Refusing.');
    process.exit(1);
    return;
  }

  const violations = runRules(target.rules, files);
  const assertions = files.length * target.rules.length;

  console.log(`${target.name} lint`);
  console.log(`  ${files.length} files x ${target.rules.length} rules = ${assertions} checks`);

  if (violations.length > 0) {
    console.error('');
    console.error(`LINT FAILED — ${violations.length} violation(s).`);
    const byRule = new Map<string, string>();
    for (const rule of target.rules) byRule.set(rule.id, rule.why);
    let lastRule = '';
    for (const problem of violations) {
      if (problem.rule !== lastRule) {
        console.error('');
        console.error(`  [${problem.rule}] ${byRule.get(problem.rule) ?? ''}`);
        lastRule = problem.rule;
      }
      console.error(`    ${problem.file}:${problem.line}  ${problem.message}`);
    }
    console.error('');
    process.exit(1);
    return;
  }

  console.log(`  CLEAN — ${assertions} checks, 0 violations.`);
}

main();
