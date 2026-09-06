import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TERMINAL_STATUSES } from '../src/index.js';

// ════════════════════════════════════════════════════════════════
// @usrp/shared-types is DEPRECATED. It therefore does not get "tests" in the
// usual sense — there is no behaviour here worth defending. What it gets is a
// QUARANTINE SUITE: proof that the package is labelled, that its fiction is
// documented rather than merely present, and that it cannot grow while nobody
// is looking. Four packages still import it, so deleting it is not this
// agent's call; freezing it is.
// ════════════════════════════════════════════════════════════════

const SOURCE = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');

/** Everything this package exports today. It may shrink. It may not grow. */
const FROZEN_EXPORTS: readonly string[] = [
  'Agency',
  'ApplicationStatus',
  'TERMINAL_STATUSES',
  'OfficerRole',
  'ApplicantProfile',
  'ApplicationListItem',
  'Application',
  'ApplicationEvent',
  'DocumentType',
  'DocumentQuality',
  'ApplicationDocument',
  'OfficerDashboardMetrics',
  'PaginatedResult',
];

const exportedNames = (source: string): readonly string[] => {
  const names: string[] = [];
  for (const match of source.matchAll(
    /^export\s+(?:declare\s+)?(?:type|interface|const|function|class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/gm,
  )) {
    const name = match[1];
    if (name !== undefined) names.push(name);
  }
  return names.sort();
};

test('the module announces its own deprecation where an editor will show it', () => {
  const head = SOURCE.split('\n').slice(0, 30).join('\n');
  assert.ok(head.includes('@deprecated'), 'no @deprecated marker in the first 30 lines');
  assert.ok(head.includes('@usrp/contracts'), 'the replacement must be named');
});

test('every export carries a @deprecated marker of its own', () => {
  const lines = SOURCE.split('\n');
  for (const [index, line] of lines.entries()) {
    const match = /^export\s+(?:type|interface|const|function|class)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(line);
    if (match === null) continue;
    const preamble = lines.slice(Math.max(0, index - 8), index).join('\n');
    assert.ok(
      preamble.includes('@deprecated'),
      `${match[1] ?? '?'} has no @deprecated marker above it`,
    );
  }
});

test('THE SURFACE IS FROZEN — it may shrink, it may not grow', () => {
  const actual = exportedNames(SOURCE);
  const added = actual.filter((name) => !FROZEN_EXPORTS.includes(name));
  assert.deepEqual(
    added,
    [],
    'a new export was added to a deprecated package. Put it in @usrp/contracts instead.',
  );
});

test('the frozen list has not rotted — every entry still exists', () => {
  const actual = exportedNames(SOURCE);
  const missing = FROZEN_EXPORTS.filter((name) => !actual.includes(name));
  assert.deepEqual(missing, [], 'update FROZEN_EXPORTS when a symbol is finally migrated away');
});

test('ApplicationStatus still holds exactly 17 values, 5 real and 12 fictional', () => {
  const block = /export type ApplicationStatus =([\s\S]*?);/.exec(SOURCE);
  assert.ok(block !== null, 'ApplicationStatus is no longer a union — do not reshape a frozen package');
  const values = [...(block[1] ?? '').matchAll(/"([A-Z_]+)"/g)].map((match) => match[1] ?? '');
  assert.equal(values.length, 17);

  const real = ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'];
  const fiction = values.filter((value) => !real.includes(value));
  assert.equal(fiction.length, 12, `expected 12 fictional statuses, saw ${fiction.join(', ')}`);
  for (const value of real) assert.ok(values.includes(value), `${value} is real and must stay`);
});

test('the documented defects are still present, so the docs above are not lying', () => {
  assert.ok(SOURCE.includes('SUPERADMIN'), 'the SUPERADMIN defect is documented as present');
  assert.ok(SOURCE.includes('"OTHER"'), 'the gender OTHER defect is documented as present');
  assert.ok(TERMINAL_STATUSES.has('EXPIRED'), 'EXPIRED is documented as a fictional terminal state');
  assert.equal(TERMINAL_STATUSES.size, 4);
});

test('the real terminal state this package LOST is still absent — do not patch it here', () => {
  // The header prose names it in order to explain the defect; what must not
  // exist is the VALUE, i.e. the quoted token in a union or a set.
  assert.ok(
    !/"WALK_IN_REJECTED"/.test(SOURCE),
    'WALK_IN_REJECTED is real, and it belongs in @usrp/contracts, not in a package slated for deletion',
  );
});

test('nothing in this package describes an HTTP surface', () => {
  assert.ok(!/['"`]\/v1\//.test(SOURCE), 'route knowledge belongs to @usrp/contracts');
});
