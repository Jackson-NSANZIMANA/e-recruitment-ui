import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, YamlError } from '../scripts/openapi/yaml.ts';

const parse = (source: string): unknown => parseYaml(source, 'fixture.yaml');

test('block mappings and nested mappings', () => {
  assert.deepEqual(parse('a: 1\nb:\n  c: two\n'), { a: 1, b: { c: 'two' } });
});

test('scalars keep their types', () => {
  assert.deepEqual(parse('n: 42\nf: 1.5\nt: true\nf2: false\nz: null\ntilde: ~\ns: plain\n'), {
    n: 42,
    f: 1.5,
    t: true,
    f2: false,
    z: null,
    tilde: null,
    s: 'plain',
  });
});

test('a sha that is not all digits stays a string', () => {
  assert.deepEqual(parse('sha: 47d9ad3ab019f6d2f826cfae2136cbff898d733f\n'), {
    sha: '47d9ad3ab019f6d2f826cfae2136cbff898d733f',
  });
});

test('flow sequences of scalars, on the key line or the next', () => {
  assert.deepEqual(parse('a: ["x", "y"]\nb:\n  ["p", 200]\n'), { a: ['x', 'y'], b: ['p', 200] });
});

test('block sequences of scalars and of mappings', () => {
  assert.deepEqual(parse('items:\n  - one\n  - two\n'), { items: ['one', 'two'] });
  assert.deepEqual(parse('params:\n  - name: id\n    in: query\n  - name: q\n    in: query\n'), {
    params: [
      { name: 'id', in: 'query' },
      { name: 'q', in: 'query' },
    ],
  });
});

test('folded scalars join lines; literal scalars keep newlines', () => {
  assert.deepEqual(parse('d: >-\n  one\n  two\n'), { d: 'one two' });
  assert.deepEqual(parse('d: |-\n  one\n  two\n'), { d: 'one\ntwo' });
});

test('comments outside quotes are stripped; inside quotes they survive', () => {
  assert.deepEqual(parse('a: 1 # trailing\n# whole line\nb: "keep # this"\n'), {
    a: 1,
    b: 'keep # this',
  });
});

test('quoted keys and keys containing slashes or dollars', () => {
  assert.deepEqual(parse('"/v1/things/do":\n  $ref: "#/components/schemas/X"\n'), {
    '/v1/things/do': { $ref: '#/components/schemas/X' },
  });
  assert.deepEqual(parse('/health:\n  get: yes\n'), { '/health': { get: 'yes' } });
});

// ── The rejections are the point: a parser that accepts more than it
// understands is how a contract tool starts lying. ──

test('tabs are refused', () => {
  assert.throws(() => parse('a:\n\tb: 1\n'), YamlError);
});

test('anchors, aliases and tags are refused', () => {
  assert.throws(() => parse('a: &anchor 1\n'), YamlError);
  assert.throws(() => parse('a: *alias\n'), YamlError);
  assert.throws(() => parse('a: !!str 1\n'), YamlError);
});

test('a brace inside a quoted scalar is not mistaken for a flow mapping', () => {
  assert.deepEqual(parse('a: [1, 2]\nb: "{x}"\n'), { a: [1, 2], b: '{x}' });
});

test('a real flow mapping is refused', () => {
  assert.throws(() => parse('a: [ {x: 1} ]\n'), YamlError);
});

test('multi-document streams are refused', () => {
  assert.throws(() => parse('---\na: 1\n'), YamlError);
});

test('a malformed line is refused with its line number', () => {
  assert.throws(
    () => parse('a: 1\nthis is not a mapping\n'),
    (error: unknown) => error instanceof YamlError && error.message.includes('fixture.yaml:2'),
  );
});

test('an unterminated quoted scalar is refused', () => {
  assert.throws(() => parse('a: "no closing quote\n'), YamlError);
});
