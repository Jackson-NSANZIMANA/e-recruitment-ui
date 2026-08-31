import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAgainst } from '../scripts/openapi/validate.ts';
import type { SchemaNode } from '../scripts/openapi/ir.ts';

const schemas = new Map<string, SchemaNode>(
  Object.entries({
    Uuid: { type: 'string', format: 'uuid' },
    Agency: { enum: ['RDF', 'RNP', 'RCS'] },
    Row: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'agency'],
      properties: {
        id: { $ref: '#/components/schemas/Uuid' },
        agency: { $ref: '#/components/schemas/Agency' },
        note: { type: ['string', 'null'] },
        scores: { type: 'array', items: { type: 'integer' }, minItems: 1 },
        handle: { type: 'string', minLength: 3, maxLength: 8, pattern: '^[a-z]+$' },
      },
    },
    Open: { type: 'object', additionalProperties: true, properties: { a: { type: 'string' } } },
  }) as unknown as readonly (readonly [string, SchemaNode])[],
);

const check = (name: string, value: unknown): readonly string[] =>
  validateAgainst(name, value, schemas, 'f.yaml').map((v) => `${v.path}: ${v.message}`);

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

test('a conforming row is accepted', () => {
  assert.deepEqual(check('Row', { id: UUID, agency: 'RDF' }), []);
});

test('an unknown schema name is a violation, not a pass', () => {
  assert.equal(check('Nope', {}).length, 1);
});

test('a missing required property is named', () => {
  assert.deepEqual(check('Row', { id: UUID }), ['$.agency: required property is absent']);
});

test('additionalProperties:false rejects an unexpected key — that is the drift', () => {
  const problems = check('Row', { id: UUID, agency: 'RDF', surpriseField: 1 });
  assert.equal(problems.length, 1);
  assert.ok(problems[0]?.includes('unexpected property'), problems.join('; '));
});

test('additionalProperties:true tolerates one', () => {
  assert.deepEqual(check('Open', { a: 'x', extra: 1 }), []);
});

test('enum membership is enforced', () => {
  assert.equal(check('Row', { id: UUID, agency: 'SUPERADMIN' }).length, 1);
});

test('a non-UUID is rejected', () => {
  assert.equal(check('Row', { id: 'not-a-uuid', agency: 'RDF' }).length, 1);
});

test('nullable means null is allowed and a wrong type still is not', () => {
  assert.deepEqual(check('Row', { id: UUID, agency: 'RDF', note: null }), []);
  assert.equal(check('Row', { id: UUID, agency: 'RDF', note: 7 }).length, 1);
});

test('minItems and item types are enforced', () => {
  assert.deepEqual(check('Row', { id: UUID, agency: 'RDF', scores: [1, 2] }), []);
  assert.equal(check('Row', { id: UUID, agency: 'RDF', scores: [] }).length, 1);
  assert.equal(check('Row', { id: UUID, agency: 'RDF', scores: [1.5] }).length, 1);
});

test('string bounds and patterns are enforced', () => {
  assert.deepEqual(check('Row', { id: UUID, agency: 'RDF', handle: 'abc' }), []);
  assert.equal(check('Row', { id: UUID, agency: 'RDF', handle: 'ab' }).length, 1);
  assert.equal(check('Row', { id: UUID, agency: 'RDF', handle: 'abcdefghij' }).length, 1);
  assert.equal(check('Row', { id: UUID, agency: 'RDF', handle: 'ABC' }).length, 1);
});

test('null where nothing is nullable is rejected', () => {
  assert.equal(check('Row', { id: null, agency: 'RDF' }).length, 1);
});

test('every violation carries a path a human can act on', () => {
  const problems = check('Row', { id: 'bad', agency: 'RDF', note: 7 });
  assert.equal(problems.length, 2);
  assert.ok(problems.every((p) => p.startsWith('$.')), problems.join('; '));
});
