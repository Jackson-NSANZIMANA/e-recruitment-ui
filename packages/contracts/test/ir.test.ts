import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ContractError,
  loadAllContracts,
  loadContract,
  refName,
  topoSortSchemas,
} from '../scripts/openapi/ir.ts';

const SHA = '47d9ad3ab019f6d2f826cfae2136cbff898d733f';

/** A minimal, VALID document. Every negative case below mutates exactly one line. */
const doc = (overrides: {
  readonly path?: string;
  readonly drop?: string;
  readonly replace?: readonly [string, string];
  readonly sha?: string;
  readonly operationId?: string;
}): string => {
  const source = `openapi: "3.1.0"
info:
  title: Test Service
  x-usrp-backend-sha: ${overrides.sha ?? SHA}
paths:
  ${overrides.path ?? '/v1/things/do'}:
    post:
      operationId: ${overrides.operationId ?? 'doThing'}
      summary: Do a thing
      x-usrp-reach: browser
      x-usrp-auth: ["officer"]
      x-usrp-source: src/adapters/http/do-thing.controller.ts
      x-usrp-verified: controller-verbatim
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/DoThingRequest"
      responses:
        "200":
          description: the thing was done
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DoThingOk"
components:
  schemas:
    DoThingRequest:
      type: object
      additionalProperties: false
      required:
        - applicationId
      properties:
        applicationId:
          type: string
          format: uuid
    DoThingOk:
      type: object
      additionalProperties: false
      required:
        - status
      properties:
        status:
          const: OK
`;
  const lines = source.split('\n').filter((line) => {
    const drop = overrides.drop;
    return drop === undefined || !line.trim().startsWith(drop);
  });
  const joined = lines.join('\n');
  const replace = overrides.replace;
  return replace === undefined ? joined : joined.replace(replace[0], replace[1]);
};

interface Fixture {
  readonly dir: string;
  readonly write: (name: string, source: string) => void;
  readonly dispose: () => void;
}

const fixture = (): Fixture => {
  const dir = mkdtempSync(join(tmpdir(), 'usrp-ir-'));
  return {
    dir,
    write: (name, source) => writeFileSync(join(dir, name), source, 'utf8'),
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  };
};

const load = (source: string, name = 'test-service.yaml'): ReturnType<typeof loadContract> => {
  const f = fixture();
  try {
    f.write(name, source);
    return loadContract(f.dir, name);
  } finally {
    f.dispose();
  }
};

const refuses = (source: string, fragment: string): void => {
  assert.throws(
    () => load(source),
    (error: unknown) =>
      error instanceof ContractError &&
      error.message.includes(fragment) &&
      error.message.startsWith('test-service.yaml:'),
    `expected a ContractError naming "${fragment}"`,
  );
};

// ── Happy path ───────────────────────────────────────────────────────

test('a valid document loads into the IR', () => {
  const contract = load(doc({}));
  assert.equal(contract.service, 'test-service');
  assert.equal(contract.title, 'Test Service');
  assert.equal(contract.backendSha, SHA);
  assert.equal(contract.operations.length, 1);
  assert.equal(contract.schemas.size, 2);

  const [operation] = contract.operations;
  assert.ok(operation !== undefined);
  assert.equal(operation.operationId, 'doThing');
  assert.equal(operation.method, 'post');
  assert.equal(operation.path, '/v1/things/do');
  assert.equal(operation.reach, 'browser');
  assert.deepEqual([...operation.auth], ['officer']);
  assert.equal(operation.requestSchema, 'DoThingRequest');
  assert.equal(operation.requestMediaType, 'application/json');
  assert.deepEqual([...operation.queryParams], []);
  assert.equal(operation.responses.length, 1);
  assert.equal(operation.responses[0]?.status, '200');
  assert.equal(operation.responses[0]?.schema, 'DoThingOk');
});

test('query parameters are read; ids in the query are legal', () => {
  const withQuery = doc({}).replace(
    '      requestBody:',
    '      parameters:\n        - name: applicationId\n          in: query\n      requestBody:',
  );
  const contract = load(withQuery);
  assert.deepEqual([...(contract.operations[0]?.queryParams ?? [])], ['applicationId']);
});

test('refName unwraps a local component ref and rejects anything else', () => {
  assert.equal(refName('#/components/schemas/Uuid', 'f.yaml'), 'Uuid');
  assert.throws(() => refName('Uuid', 'f.yaml'), ContractError);
  assert.throws(() => refName('#/components/schemas/', 'f.yaml'), ContractError);
  assert.throws(() => refName('https://example/x', 'f.yaml'), ContractError);
});

// ── THE INVARIANT ──────────────────────────────────────────────────

test('INVARIANT 1: a templated path is refused', () => {
  refuses(doc({ path: '"/v1/things/{thingId}"' }), 'INVARIANT 1');
});

test('INVARIANT 1: a path parameter is refused even when it looks harmless', () => {
  refuses(doc({ path: '"/v1/things/$id"' }), 'INVARIANT 1');
});

test('a non-query parameter is refused', () => {
  const withHeader = doc({}).replace(
    '      requestBody:',
    '      parameters:\n        - name: X-Thing\n          in: header\n      requestBody:',
  );
  refuses(withHeader, 'only query parameters exist in this platform');
});

// ── Absent fields: the regression this branch fixed ──────────────────────
//
// Under `noUncheckedIndexedAccess` every one of these reads is
// `YamlValue | undefined`. The loader must name the missing field rather than
// crash — and must do it WITHOUT a `!` or a `?? null` papering over the gap.

test('an absent info.title is named, not crashed on', () => {
  refuses(doc({ drop: 'title:' }), 'info.title must be a non-empty string');
});

test('an absent backend SHA is named', () => {
  refuses(doc({ drop: 'x-usrp-backend-sha:' }), 'info.x-usrp-backend-sha');
});

test('an absent info block is named', () => {
  refuses(doc({ replace: ['info:', 'notinfo:'] }), 'info must be a mapping');
});

test('an absent paths block is named', () => {
  refuses(doc({ replace: ['paths:', 'notpaths:'] }), 'paths must be a mapping');
});

test('an absent operationId is named', () => {
  refuses(doc({ drop: 'operationId:' }), 'operationId must be a non-empty string');
});

test('an absent x-usrp-reach is named', () => {
  refuses(doc({ drop: 'x-usrp-reach:' }), 'x-usrp-reach must be a non-empty string');
});

test('an absent x-usrp-source is named — provenance is not optional', () => {
  refuses(doc({ drop: 'x-usrp-source:' }), 'x-usrp-source must be a non-empty string');
});

test('an absent x-usrp-verified is named', () => {
  refuses(doc({ drop: 'x-usrp-verified:' }), 'x-usrp-verified must be a non-empty string');
});

test('an absent x-usrp-auth is named', () => {
  refuses(doc({ drop: 'x-usrp-auth:' }), 'x-usrp-auth must be a non-empty array');
});

test('an absent responses block is named', () => {
  refuses(doc({ replace: ['      responses:', '      notresponses:'] }), 'responses must be a mapping');
});

test('an absent parameter name is named', () => {
  const withNamelessParam = doc({}).replace(
    '      requestBody:',
    '      parameters:\n        - in: query\n      requestBody:',
  );
  refuses(withNamelessParam, 'parameter.name must be a non-empty string');
});

// ── Other refusals ───────────────────────────────────────────────

test('a wrong openapi version is refused', () => {
  refuses(doc({ replace: ['openapi: "3.1.0"', 'openapi: "3.0.3"'] }), 'openapi: "3.1.0"');
});

test('an unknown auth kind is refused', () => {
  refuses(doc({ replace: ['["officer"]', '["superadmin"]'] }), 'unknown auth kind "superadmin"');
});

test('an unknown reach is refused', () => {
  refuses(doc({ replace: ['x-usrp-reach: browser', 'x-usrp-reach: edge'] }), 'x-usrp-reach must be browser|service-internal');
});

test('a response key that is not an HTTP status is refused', () => {
  refuses(doc({ replace: ['        "200":', '        "ok":'] }), 'is not an HTTP status code');
});

test('an inline (non-$ref) response schema is refused', () => {
  refuses(
    doc({ replace: ['                $ref: "#/components/schemas/DoThingOk"', '                type: object'] }),
    'must be a $ref to a named component',
  );
});

test('a $ref to a component that does not exist is refused', () => {
  refuses(
    doc({ replace: ['#/components/schemas/DoThingOk', '#/components/schemas/Missing'] }),
    '$ref to undefined component schema "Missing"',
  );
});

test('a component that nothing references is refused', () => {
  const orphaned = doc({}).replace(
    '    DoThingOk:',
    '    Orphan:\n      type: string\n    DoThingOk:',
  );
  refuses(orphaned, 'defined and never referenced');
});

// ── Across documents ─────────────────────────────────────────────

test('two documents pinned to different backend SHAs are refused', () => {
  const f = fixture();
  try {
    f.write('a-service.yaml', doc({}));
    f.write('b-service.yaml', doc({ operationId: 'doOther', sha: 'deadbeef' }));
    assert.throws(() => loadAllContracts(f.dir), (error: unknown) =>
      error instanceof ContractError && error.message.includes('disagree about the verified backend SHA'));
  } finally {
    f.dispose();
  }
});

test('a duplicate operationId across documents is refused', () => {
  const f = fixture();
  try {
    f.write('a-service.yaml', doc({}));
    f.write('b-service.yaml', doc({}));
    assert.throws(() => loadAllContracts(f.dir), (error: unknown) =>
      error instanceof ContractError && error.message.includes('duplicate operationId "doThing"'));
  } finally {
    f.dispose();
  }
});

test('an empty directory is refused rather than silently passing', () => {
  const f = fixture();
  try {
    assert.throws(() => loadAllContracts(f.dir), (error: unknown) =>
      error instanceof ContractError && error.message.includes('no OpenAPI documents found'));
  } finally {
    f.dispose();
  }
});

test('two valid documents load and agree', () => {
  const f = fixture();
  try {
    f.write('a-service.yaml', doc({}));
    f.write('b-service.yaml', doc({ operationId: 'doOther' }));
    const contracts = loadAllContracts(f.dir);
    assert.equal(contracts.length, 2);
    assert.deepEqual(contracts.map((c) => c.service), ['a-service', 'b-service']);
  } finally {
    f.dispose();
  }
});

// ── topoSortSchemas ──────────────────────────────────────────────

test('schemas are ordered dependency-first', () => {
  const chained = doc({}).replace(
    '        status:\n          const: OK',
    '        status:\n          $ref: "#/components/schemas/Status"',
  ).replace(
    'components:\n  schemas:',
    'components:\n  schemas:\n    Status:\n      const: OK',
  );
  const contract = load(chained);
  const order = topoSortSchemas(contract);
  assert.ok(order.indexOf('Status') < order.indexOf('DoThingOk'), `Status must precede DoThingOk, got ${order.join(' -> ')}`);
});

test('a reference cycle is refused instead of emitting a lazy thunk', () => {
  const cyclic = doc({}).replace(
    '        status:\n          const: OK',
    '        status:\n          $ref: "#/components/schemas/DoThingRequest"',
  ).replace(
    '        applicationId:\n          type: string\n          format: uuid',
    '        applicationId:\n          $ref: "#/components/schemas/DoThingOk"',
  );
  const contract = load(cyclic);
  assert.throws(() => topoSortSchemas(contract), (error: unknown) =>
    error instanceof ContractError && error.message.includes('schema reference cycle'));
});
