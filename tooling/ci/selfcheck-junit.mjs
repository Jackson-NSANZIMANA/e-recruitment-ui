// Runs a package's selfchecks one by one and writes test-results/unit.junit.xml,
// one <testcase> per selfcheck, so the evidence bundle can count packages whose
// tests are tsx/strip-types scripts rather than node:test or vitest suites.
//
// A selfcheck passes when it exits 0. Its own assertions stay in its output;
// the report records each script's outcome, never an invented assertion count.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {string} suite package name, used as the testsuite name
 * @param {ReadonlyArray<{ name: string, command: string, args: readonly string[] }>} checks
 * @returns {number} the exit code for the package's `test` script
 */
export function runSelfchecks(suite, checks) {
  const cases = [];
  for (const check of checks) {
    const started = Date.now();
    const result = spawnSync(check.command, check.args, { stdio: 'inherit' });
    cases.push({ name: check.name, ok: result.status === 0, code: result.status, seconds: (Date.now() - started) / 1000 });
  }
  const failures = cases.filter((c) => !c.ok).length;
  const body = cases
    .map((c) => `  <testcase name="${escape(c.name)}" classname="${escape(suite)}" file="${escape(c.name)}" time="${c.seconds.toFixed(3)}">`
      + (c.ok ? '' : `<failure message="exited with ${String(c.code)}"/>`) + '</testcase>')
    .join('\n');
  mkdirSync('test-results', { recursive: true });
  writeFileSync(join('test-results', 'unit.junit.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${escape(suite)}" tests="${cases.length}" failures="${failures}">\n${body}\n</testsuite>\n`);
  return failures === 0 ? 0 : 1;
}
