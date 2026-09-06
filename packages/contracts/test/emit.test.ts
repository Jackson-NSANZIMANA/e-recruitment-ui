import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANNER, emitZod, schemaConst } from '../scripts/openapi/emit.ts';
import type { SchemaNode } from '../scripts/openapi/ir.ts';

const node = (value: Record<string, unknown>): SchemaNode => value as unknown as SchemaNode;
const emit = (value: Record<string, unknown>): string => emitZod(node(value), 'f.yaml');

test('the banner names the producer, the source and the pinned backend', () => {
  const banner = BANNER('identity-service', 'abc123', 'identity-service.yaml');
  assert.ok(banner.includes('GENERATED'), 'a generated file must say so');
  assert.ok(banner.includes('abc123'), 'the pinned backend SHA must be on the artifact');
  assert.ok(banner.includes('identity-service.yaml'), 'the source document must be named');
});

test('schemaConst is stable', () => {
  assert.equal(schemaConst('Uuid'), 'UuidSchema');
});

test('a $ref becomes a reference, never an inlined copy', () => {
  assert.equal(emit({ $ref: '#/components/schemas/Uuid' }), 'UuidSchema');
});

test('enums and consts', () => {
  assert.equal(emit({ enum: ['A', 'B'] }), "z.enum(['A', 'B'])");
  assert.equal(emit({ enum: ['ONLY'] }), "z.literal('ONLY')");
  assert.equal(emit({ const: 'OK' }), "z.literal('OK')");
});

test('a quote inside an enum value is escaped, not broken', () => {
  assert.equal(emit({ enum: ["it's"] }), "z.literal('it\\'s')");
});

test('string constraints the backend genuinely enforces are emitted', () => {
  assert.equal(emit({ type: 'string', format: 'uuid' }), 'z.string().uuid()');
  assert.equal(emit({ type: 'string', minLength: 3, maxLength: 9 }), 'z.string().min(3).max(9)');
  assert.equal(emit({ type: 'string', pattern: '^[A-Z]+$' }), 'z.string().regex(/^[A-Z]+$/)');
});

test('a date-time format emits NO .datetime() — the backend never promised one', () => {
  assert.equal(emit({ type: 'string', format: 'date-time' }), 'z.string()');
});

test('nullable types', () => {
  assert.equal(emit({ type: ['string', 'null'] }), 'z.string().nullable()');
  assert.equal(emit({ type: ['number', 'null'] }), 'z.number().nullable()');
  assert.equal(emit({ type: 'null' }), 'z.null()');
});

test('an undescribed schema becomes unknown, never any', () => {
  const emitted = emit({});
  assert.equal(emitted, 'z.unknown()');
  assert.ok(!emitted.includes('any'));
});

test('an object with no described properties becomes a record of unknown', () => {
  assert.equal(emit({ type: 'object' }), 'z.record(z.unknown())');
});

test('additionalProperties:false becomes .strict() — an extra key is drift', () => {
  const emitted = emit({
    type: 'object',
    additionalProperties: false,
    required: ['a'],
    properties: { a: { type: 'string' }, b: { type: 'number' } },
  });
  assert.ok(emitted.includes('.strict()'), emitted);
  assert.ok(emitted.includes('"a": z.string(),'), emitted);
  assert.ok(emitted.includes('"b": z.number().optional(),'), emitted);
});

test('additionalProperties:true stays open', () => {
  const emitted = emit({
    type: 'object',
    additionalProperties: true,
    required: [],
    properties: { a: { type: 'string' } },
  });
  assert.ok(!emitted.includes('.strict()'), emitted);
});

test('arrays, with and without a minimum', () => {
  assert.equal(emit({ type: 'array', items: { type: 'string' } }), 'z.array(z.string())');
  assert.equal(
    emit({ type: 'array', items: { type: 'string' }, minItems: 1 }),
    'z.array(z.string()).min(1)',
  );
  assert.equal(emit({ type: 'array' }), 'z.array(z.unknown())');
});

test('a discriminated oneOf uses discriminatedUnion; a bare oneOf uses union', () => {
  const discriminated = emit({
    oneOf: [{ $ref: '#/components/schemas/A' }, { $ref: '#/components/schemas/B' }],
    discriminator: { propertyName: 'outcome' },
  });
  assert.ok(discriminated.startsWith("z.discriminatedUnion('outcome', ["), discriminated);
  const bare = emit({ oneOf: [{ $ref: '#/components/schemas/A' }] });
  assert.ok(bare.startsWith('z.union(['), bare);
});

test('an unsupported type is a loud failure, not a silent z.unknown()', () => {
  assert.throws(() => emit({ type: 'file' }), /unsupported schema type "file"/);
});
