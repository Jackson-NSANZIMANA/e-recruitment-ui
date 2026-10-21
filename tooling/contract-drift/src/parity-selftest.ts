// Gate E selftest fixtures: one planted drift per new dimension, each of which
// must turn the gate red, plus the clean case that must stay green.
import { gateE, readBackendEdgeContract, type FrontendFacts, type KnownDivergence, type ParityEntry } from './parity.ts';
import { parseYamlLite } from './yaml-lite.ts';

const YAML = `openapi: 3.1.0
paths:
  /edge/v1/things:
    post:
      operationId: createThing
      x-usrp-session: officer
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              additionalProperties: false
              required: [code, label]
              properties:
                code: { type: string, pattern: '^[A-Z]+$' }
                label: { type: string, maxLength: 50 }
                note: { type: [string, 'null'] }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, enum: [CREATED] }
                  code: { type: string }
        '409': { description: "THING_EXISTS (code) | THING_LOCKED" }
        '422': { description: Label, code, or THING_INVALID validation failed. }
  /edge/v1/things/read:
    get:
      operationId: readThing
      responses:
        '200': { description: The thing's public view. }
components:
  parameters:
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: true
      description: UUID key; same actor, operation, key, and request body replay the original result.
`;

const WIRE = `
export interface CreateThingInput {
  readonly code: string;
  /** The label: shown to officers. */
  readonly label: string;
  readonly note?: string | null;
}
export interface ThingCreated {
  readonly status: 'CREATED';
  readonly code: string;
}
export type ThingRefusal = 'THING_EXISTS' | 'THING_LOCKED' | 'THING_INVALID';
`;

const OPS = `export function createThing(client, input, idempotencyKey) {
  return client.call<ThingCreated>('createThing', { body: input, idempotencyKey });
}
export function readThing(client) { return client.call<unknown>('readThing', {}); }`;

const TABLE: readonly ParityEntry[] = [
  { op: 'createThing', request: 'CreateThingInput', response: { status: '201', type: 'ThingCreated' }, outcomes: { file: 'wire.ts', types: ['ThingRefusal'] } },
];

export function runParitySelftest(assert: (condition: boolean, what: string) => void): void {
  // yaml-lite reads the backend document's flow style, including a description
  // split at commas (YAML 1.2 null keys) and quoted strings with ':' and "'".
  const doc = parseYamlLite(YAML) as Record<string, any>;
  assert(doc['paths']['/edge/v1/things']['post']['requestBody']['content']['application/json']['schema']['properties']['note']['type'][1] === 'null', 'yaml-lite: nested flow collections');
  assert(doc['paths']['/edge/v1/things/read']['get']['responses']['200']['description'] === "The thing's public view.", 'yaml-lite: apostrophe inside a plain scalar');

  const facts = (wire = WIRE, ops = OPS): FrontendFacts => ({
    registry: [
      { id: 'createThing', method: 'POST', path: '/edge/v1/things' },
      { id: 'readThing', method: 'GET', path: '/edge/v1/things/read' },
    ],
    wireSource: wire,
    operationSources: [ops],
    readFile: (p) => (p === 'wire.ts' ? wire : null),
  });
  const backend = readBackendEdgeContract(YAML);
  const errors = (f: FrontendFacts, b = backend, divergences: readonly KnownDivergence[] = []): string[] =>
    gateE(b, f, TABLE, divergences).findings.filter((x) => x.severity === 'error').map((x) => x.message);

  assert(errors(facts()).length === 0, `gate E clean (got ${errors(facts()).join(' | ')})`);
  assert(backend.operations.find((o) => o.operationId === 'createThing')?.outcomeCodes.has('THING_INVALID') === true, 'gate E reads a code out of a comma-split description');

  // E1 request schema
  assert(errors(facts(WIRE.replace('  readonly label: string;\n', ''))).some((m) => m.includes('REQUEST FIELD MISSING') && m.includes('label')), 'gate E request: a required field the frontend does not send');
  assert(errors(facts(WIRE.replace('readonly label: string;', 'readonly label?: string;'))).some((m) => m.includes('REQUEST FIELD OPTIONAL')), 'gate E request: a required field the frontend marks optional');
  assert(errors(facts(WIRE.replace('readonly code: string;\n  /**', 'readonly code: string;\n  readonly agency: string;\n  /**'))).some((m) => m.includes('REQUEST FIELD UNKNOWN') && m.includes('agency')), 'gate E request: an extra field a closed schema refuses');

  // E2 response schema
  assert(errors(facts(WIRE.replace("readonly status: 'CREATED';", "readonly status: 'CREATED';\n  readonly thingId: string;"))).some((m) => m.includes('RESPONSE FIELD NEVER SENT') && m.includes('thingId')), 'gate E response: a required field the backend never sends');

  // E3 outcome union
  assert(errors(facts(WIRE.replace(" | 'THING_LOCKED'", ''))).some((m) => m.includes('OUTCOME UNHANDLED') && m.includes('THING_LOCKED')), 'gate E outcomes: a documented 409 the frontend does not name');

  // E4 idempotency
  assert(errors(facts(WIRE, OPS.replace('{ body: input, idempotencyKey }', '{ body: input }'))).some((m) => m.includes('IDEMPOTENCY KEY MISSING')), 'gate E idempotency: a required key the frontend does not send');
  assert(errors(facts(WIRE, OPS.replace("call<unknown>('readThing', {})", "call<unknown>('readThing', { idempotencyKey: 'k' })"))).some((m) => m.includes('IDEMPOTENCY KEY UNDOCUMENTED')), 'gate E idempotency: a key the backend does not declare');
  const narrowed = readBackendEdgeContract(YAML.replace('same actor, operation, key, and request body', 'same key'));
  assert(errors(facts(), narrowed).some((m) => m.includes('IDEMPOTENCY SCOPE CHANGED')), 'gate E idempotency: the replay scope narrows');

  // Known divergences excuse exactly what they match, and go stale loudly.
  const missingLabel = facts(WIRE.replace('  readonly label: string;\n', ''));
  const excuse: KnownDivergence = { op: 'createThing', dimension: 'request', matches: '"label"', reason: 'planted', owner: 'selftest' };
  assert(!errors(missingLabel, backend, [excuse]).some((m) => m.includes('REQUEST FIELD MISSING')), 'gate E: a known divergence downgrades its finding to a note');
  assert(errors(facts(), backend, [excuse]).some((m) => m.includes('STALE KNOWN DIVERGENCE')), 'gate E: a divergence that matches nothing is an error');
}
