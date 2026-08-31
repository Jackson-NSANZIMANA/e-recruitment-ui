import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACT_RULES,
  runRules,
  stringLiterals,
  stripComments,
  type LintFile,
} from '../scripts/lint/rules.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function collect(dirs: readonly string[]): readonly LintFile[] {
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
      files.push({ path: relative(ROOT, child).split(sep).join('/'), source: readFileSync(child, 'utf8') });
    }
  };
  for (const dir of dirs) walk(join(ROOT, dir));
  return files;
}

test('stripComments blanks comments and keeps every line number', () => {
  const source = 'const a = 1; // trailing\n/* block\n   comment */\nconst b = 2;\n';
  const stripped = stripComments(source);
  assert.equal(stripped.split('\n').length, source.split('\n').length);
  assert.ok(stripped.includes('const a = 1;'));
  assert.ok(!stripped.includes('trailing'));
  assert.ok(!stripped.includes('block'));
  assert.ok(stripped.includes('const b = 2;'));
});

test('stringLiterals finds each literal kind and skips commented ones', () => {
  const values = stringLiterals(`const a = 'x'; const b = "y"; const c = \`z\`; // 'skipped'\n`).map(
    (literal) => literal.value,
  );
  assert.deepEqual(values, ['x', 'y', 'z']);
});

test('THIS PACKAGE IS LINT-CLEAN — the gate is enforced by `pnpm test` too', () => {
  const files = collect(['src', 'scripts', 'test']);
  assert.ok(files.length > 0, 'lint matched no files, which would make this test meaningless');
  const violations = runRules(CONTRACT_RULES, files);
  assert.deepEqual(
    violations.map((v) => `${v.file}:${v.line} [${v.rule}] ${v.message}`),
    [],
  );
});
