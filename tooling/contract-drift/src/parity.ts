// ════════════════════════════════════════════════════════════════
// Gate E — contract parity v2 (ADR-FE-012, W0-06).
//
// Gate D proves the frontend and backend registries agree on method, path,
// session, retry and composition. Gate E compares what travels:
//
//   E1 request schema   frontend request type  ↔ backend requestBody schema
//   E2 response schema  frontend response type ↔ backend 2xx schema
//   E3 outcome union    frontend handled codes ↔ backend 409/422 codes
//   E4 idempotency      frontend sends a key   ↔ backend requires one, and the
//                       key's documented scope (actor, operation, key, body)
//
// The backend side is services/edge-gateway/openapi/edge-v1.yaml at the pinned
// checkout (read with yaml-lite.ts). The frontend side is read from SOURCE:
// the interfaces in packages/api-client/src/wire.ts, the outcome unions named
// in PARITY_TABLE, and each operation's call site in api-client/src/operations.
// PARITY_TABLE only says WHICH frontend symbol answers for an operation; it
// never restates a field, so it cannot drift silently from the code.
//
// Known divergences are listed with a reason and an owner. A matching finding
// becomes a note; an entry that no longer matches anything is itself an error,
// so an exception cannot outlive the defect it excuses.
//
// The permission dimension waits for the backend's x-usrp-permission (S04).
// ════════════════════════════════════════════════════════════════

import { parseYamlLite, type YamlValue } from './yaml-lite.ts';

export type ParityDimension = 'request' | 'response' | 'outcomes' | 'idempotency';

export interface ParityFinding {
  readonly gate: 'E';
  readonly severity: 'error' | 'note';
  readonly service: 'edge-gateway';
  readonly dimension: ParityDimension;
  readonly operation: string;
  readonly message: string;
}

export interface ParityEntry {
  /** Frontend operation id (paths.ts). */
  readonly op: string;
  /** wire.ts interface the frontend sends. */
  readonly request?: string;
  /** wire.ts interface the frontend expects on a 2xx. */
  readonly response?: { readonly status: string; readonly type: string };
  /** Where the frontend's handled 409/422 codes are declared. */
  readonly outcomes?: { readonly file: string; readonly types?: readonly string[]; readonly consts?: readonly string[] };
}

export interface KnownDivergence {
  readonly op: string;
  readonly dimension: ParityDimension;
  /** Substring of the finding message this entry excuses. */
  readonly matches: string;
  readonly reason: string;
  readonly owner: string;
}

/** Which frontend symbol answers for each backend-described operation. */
export const PARITY_TABLE: readonly ParityEntry[] = [
  {
    op: 'admitAtGate',
    request: 'AdmitAtGateInput',
    outcomes: { file: 'packages/api-client/src/wire.ts', types: ['GateAdmissionResult', 'InvalidTicketReason'] },
  },
  {
    op: 'submitMyApplication',
    request: 'SubmitApplicationInput',
    response: { status: '201', type: 'SubmitApplicationResponse' },
  },
  { op: 'registerWalkIn', outcomes: { file: 'packages/features/field-ops/src/model/walk-in.ts', consts: ['WALK_IN_REFUSALS'] } },
  { op: 'createCampaign', request: 'CreateCampaignInput' },
  { op: 'createCampaignPolicy', request: 'CreateCampaignPolicyInput' },
  { op: 'configureCampaignSession', request: 'ConfigureCampaignSessionInput' },
  { op: 'publishCampaign', request: 'CampaignPublicCodeInput' },
  { op: 'closeCampaignRegistration', request: 'CampaignPublicCodeInput' },
  { op: 'completeCampaign', request: 'CampaignPublicCodeInput' },
  { op: 'cancelCampaign', request: 'CampaignPublicCodeInput' },
];

export const KNOWN_DIVERGENCES: readonly KnownDivergence[] = [
  {
    op: 'submitMyApplication',
    dimension: 'request',
    matches: 'campaignCode',
    reason:
      'edge-v1.yaml documents submitMyApplication as { category, nesaIndexNumber?, hecRegistrationNumber? } with additionalProperties: false, but the backend edge controller (citizen.controller.ts) REQUIRES campaignCode and 400s without it. The frontend follows the controller; the backend document is stale.',
    owner: 'backend edge-gateway (ask raised in the S02 hand-off)',
  },
];

// ── backend side ──────────────────────────────────────────────────

export interface SchemaShape {
  readonly properties: ReadonlySet<string>;
  readonly required: ReadonlySet<string>;
  readonly closed: boolean;
}

export interface BackendOperation {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly request: SchemaShape | null;
  readonly responses: ReadonlyMap<string, SchemaShape | null>;
  readonly outcomeCodes: ReadonlySet<string>;
  readonly idempotencyRequired: boolean;
}

export interface BackendEdgeContract {
  readonly operations: readonly BackendOperation[];
  /** The documented Idempotency-Key scope text, if any. */
  readonly idempotencyScope: string | null;
}

const obj = (v: YamlValue | undefined): Record<string, YamlValue> | null =>
  v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, YamlValue>) : null;

function shapeOf(schema: YamlValue | undefined): SchemaShape | null {
  const s = obj(schema);
  const props = obj(s?.['properties']);
  if (s === null || props === null) return null;
  const required = Array.isArray(s['required']) ? s['required'].map(String) : [];
  return { properties: new Set(Object.keys(props)), required: new Set(required), closed: s['additionalProperties'] === false };
}

/** Text of a response object, including the fragments a flow-mapped description split into null keys. */
function responseText(response: YamlValue | undefined): string {
  if (typeof response === 'string') return response;
  const r = obj(response);
  if (r === null) return '';
  const parts = [typeof r['description'] === 'string' ? r['description'] : ''];
  for (const [key, value] of Object.entries(r)) if (value === null) parts.push(key);
  return parts.join(' ');
}

const CODE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b[A-Z]{5,}\b/g;
const NOT_CODES = new Set(['UUID', 'NIDA', 'CORS', 'HTTP', 'JSON']);

export function outcomeCodesIn(text: string): ReadonlySet<string> {
  return new Set([...text.matchAll(CODE)].map((m) => m[0]).filter((c) => !NOT_CODES.has(c)));
}

export function readBackendEdgeContract(yamlText: string): BackendEdgeContract {
  const doc = obj(parseYamlLite(yamlText));
  const paths = obj(doc?.['paths']) ?? {};
  const componentParams = obj(obj(doc?.['components'])?.['parameters']) ?? {};
  const keyParam = Object.entries(componentParams).find(([, p]) => obj(p)?.['name'] === 'Idempotency-Key');
  const operations: BackendOperation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const [method, raw] of Object.entries(obj(item) ?? {})) {
      const op = obj(raw);
      if (op === null || typeof op['operationId'] !== 'string') continue;
      const content = obj(obj(op['requestBody'])?.['content']);
      const request = shapeOf(obj(content?.['application/json'])?.['schema']);
      const responses = new Map<string, SchemaShape | null>();
      const codes = new Set<string>();
      for (const [status, response] of Object.entries(obj(op['responses']) ?? {})) {
        if (/^2\d\d$/.test(status)) {
          responses.set(status, shapeOf(obj(obj(obj(response)?.['content'])?.['application/json'])?.['schema']));
        }
        if (status === '409' || status === '422') for (const code of outcomeCodesIn(responseText(response))) codes.add(code);
      }
      const params = Array.isArray(op['parameters']) ? op['parameters'] : [];
      const viaParam = params.some((p) => {
        const o = obj(p);
        return o?.['name'] === 'Idempotency-Key' || (keyParam !== undefined && o?.['$ref'] === `#/components/parameters/${keyParam[0]}`);
      });
      const viaText = /Idempotency-Key`?\s+header/i.test(`${String(op['summary'] ?? '')} ${String(op['description'] ?? '')}`);
      operations.push({
        operationId: op['operationId'],
        method: method.toUpperCase(),
        path,
        request,
        responses,
        outcomeCodes: codes,
        idempotencyRequired: viaParam || viaText,
      });
    }
  }
  const scope = keyParam === undefined ? null : String(obj(keyParam[1])?.['description'] ?? '');
  return { operations, idempotencyScope: scope };
}

// ── frontend side ─────────────────────────────────────────────────

export interface InterfaceShape {
  readonly members: ReadonlyMap<string, { readonly optional: boolean }>;
}

/** Top-level members of `export interface Name … { … }` in a TS source. */
export function interfaceShape(source: string, name: string): InterfaceShape | null {
  const head = new RegExp(`export interface ${name}\\b[^{]*\\{`).exec(source);
  if (head === null) return null;
  let depth = 1;
  let i = head.index + head[0].length;
  let current = '';
  const members = new Map<string, { optional: boolean }>();
  const flush = (): void => {
    const m = /^\s*(?:\/\*[\s\S]*?\*\/\s*)*(?:readonly\s+)?([A-Za-z_$][\w$]*)(\?)?\s*:/.exec(current.replace(/\/\/[^\n]*/g, ''));
    if (m !== null) members.set(m[1]!, { optional: m[2] === '?' });
    current = '';
  };
  for (; i < source.length && depth > 0; i += 1) {
    const ch = source[i]!;
    if (ch === '{' || ch === '(' || ch === '<' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ')' || (ch === '>' && source[i - 1] !== '=') || ch === ']') {
      depth -= 1;
      if (depth === 0) break;
    }
    if (depth === 1 && (ch === ';' || ch === '\n') && /:/.test(current)) {
      flush();
      continue;
    }
    current += ch;
  }
  if (/:/.test(current)) flush();
  return { members };
}

/** Upper-case string literals in named `export type`s and `export const`s of a source. */
export function declaredCodes(source: string, types: readonly string[] = [], consts: readonly string[] = []): ReadonlySet<string> | null {
  const codes = new Set<string>();
  const take = (segment: string): void => {
    for (const m of segment.matchAll(/['"]([A-Z][A-Z0-9_]+)['"]/g)) codes.add(m[1]!);
  };
  for (const name of [...types, ...consts]) {
    const kind = types.includes(name) ? 'type' : 'const';
    const re = new RegExp(`export ${kind} ${name}\\b[^=]*=`);
    const match = re.exec(source);
    if (match === null) return null;
    const rest = source.slice(match.index + match[0].length);
    // The declaration ends at the first ';' outside any bracket.
    let depth = 0;
    let end = rest.length;
    for (let i = 0; i < rest.length; i += 1) {
      const ch = rest[i]!;
      if (ch === '{' || ch === '[' || ch === '(') depth += 1;
      else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
      else if (ch === ';' && depth === 0) { end = i; break; }
    }
    take(rest.slice(0, end));
  }
  return codes;
}

/** Whether the frontend call site for `op` sends an Idempotency-Key. */
export function sendsIdempotencyKey(operationSources: readonly string[], op: string): boolean | null {
  const site = new RegExp(`\\b(?:call<[^(]*>|command)\\(\\s*(?:client\\s*,\\s*)?['"]${op}['"]`);
  for (const text of operationSources) {
    const m = site.exec(text);
    if (m === null) continue;
    let depth = 0;
    let i = text.indexOf('(', m.index);
    const start = i;
    for (; i < text.length; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    return /\bidempotencyKey\b/.test(text.slice(start, i));
  }
  return null;
}

// ── the gate ──────────────────────────────────────────────────────

export interface FrontendFacts {
  /** id → method + path, from paths.ts. */
  readonly registry: readonly { readonly id: string; readonly method: string; readonly path: string }[];
  readonly wireSource: string;
  readonly operationSources: readonly string[];
  readonly readFile: (repoPath: string) => string | null;
}

const SCOPE_TERMS = ['actor', 'operation', 'key', 'body'];

export function gateE(
  backend: BackendEdgeContract,
  frontend: FrontendFacts,
  table: readonly ParityEntry[] = PARITY_TABLE,
  divergences: readonly KnownDivergence[] = KNOWN_DIVERGENCES,
): { readonly findings: readonly ParityFinding[]; readonly assertions: number } {
  const raw: ParityFinding[] = [];
  let assertions = 0;
  const finding = (dimension: ParityDimension, operation: string, message: string, severity: 'error' | 'note' = 'error'): void => {
    raw.push({ gate: 'E', severity, service: 'edge-gateway', dimension, operation, message });
  };
  const backendByKey = new Map(backend.operations.map((o) => [`${o.method} ${o.path}`, o]));
  const entryFor = new Map(table.map((e) => [e.op, e]));

  for (const fe of frontend.registry) {
    const be = backendByKey.get(`${fe.method} ${fe.path}`);
    if (be === undefined) continue; // presence is gate D's job
    const entry = entryFor.get(fe.id);

    // E1 request schema
    if (be.request !== null) {
      assertions += 1;
      if (entry?.request === undefined) {
        finding('request', fe.id, `backend documents a request schema for ${be.operationId}; no frontend request type is mapped in PARITY_TABLE (not compared)`, 'note');
      } else {
        const shape = interfaceShape(frontend.wireSource, entry.request);
        if (shape === null) finding('request', fe.id, `PARITY_TABLE names ${entry.request}, which packages/api-client/src/wire.ts does not declare`);
        else {
          for (const req of be.request.required) {
            assertions += 1;
            const member = shape.members.get(req);
            if (member === undefined) finding('request', fe.id, `REQUEST FIELD MISSING: backend requires "${req}" and ${entry.request} does not send it; every call would 400`);
            else if (member.optional) finding('request', fe.id, `REQUEST FIELD OPTIONAL: backend requires "${req}" but ${entry.request} marks it optional`);
          }
          for (const [name] of shape.members) {
            assertions += 1;
            if (!be.request.properties.has(name)) {
              finding('request', fe.id, `REQUEST FIELD UNKNOWN: ${entry.request} sends "${name}", which the backend schema does not declare${be.request.closed ? ' (additionalProperties: false — refused)' : ''}`, be.request.closed ? 'error' : 'note');
            }
          }
        }
      }
    }

    // E2 response schema
    if (entry?.response !== undefined) {
      assertions += 1;
      const schema = be.responses.get(entry.response.status);
      const shape = interfaceShape(frontend.wireSource, entry.response.type);
      if (shape === null) finding('response', fe.id, `PARITY_TABLE names ${entry.response.type}, which wire.ts does not declare`);
      else if (schema === undefined || schema === null) finding('response', fe.id, `backend documents no ${entry.response.status} schema for ${be.operationId}; ${entry.response.type} cannot be compared`);
      else {
        for (const [name, member] of shape.members) {
          assertions += 1;
          if (!member.optional && !schema.properties.has(name)) finding('response', fe.id, `RESPONSE FIELD NEVER SENT: ${entry.response.type}.${name} is required by the frontend and absent from the backend ${entry.response.status} schema`);
        }
        for (const name of schema.properties) {
          assertions += 1;
          if (!shape.members.has(name)) finding('response', fe.id, `backend ${entry.response.status} sends "${name}", which ${entry.response.type} ignores`, 'note');
        }
      }
    }

    // E3 outcome union
    if (be.outcomeCodes.size > 0) {
      assertions += 1;
      if (entry?.outcomes === undefined) {
        finding('outcomes', fe.id, `backend documents 409/422 outcomes [${[...be.outcomeCodes].join(', ')}]; no frontend outcome union is mapped (not compared)`, 'note');
      } else {
        const source = frontend.readFile(entry.outcomes.file);
        const handled = source === null ? null : declaredCodes(source, entry.outcomes.types, entry.outcomes.consts);
        if (handled === null) finding('outcomes', fe.id, `PARITY_TABLE outcome source ${entry.outcomes.file} (${[...(entry.outcomes.types ?? []), ...(entry.outcomes.consts ?? [])].join(', ')}) was not found`);
        else {
          for (const code of be.outcomeCodes) {
            assertions += 1;
            if (!handled.has(code)) finding('outcomes', fe.id, `OUTCOME UNHANDLED: backend documents ${code} for ${be.operationId} and the frontend union does not name it; an officer or citizen would see a generic error`);
          }
          for (const code of handled) {
            if (!be.outcomeCodes.has(code) && !['ADMITTED', 'FORBIDDEN', 'APPLICANT_NOT_FOUND', 'UNSUPPORTED_AGENCY'].includes(code)) {
              finding('outcomes', fe.id, `frontend handles ${code}, which the backend document does not list for ${be.operationId}`, 'note');
            }
          }
        }
      }
    }

    // E4 idempotency
    const sends = sendsIdempotencyKey(frontend.operationSources, fe.id);
    if (sends !== null || be.idempotencyRequired) {
      assertions += 1;
      if (be.idempotencyRequired && sends !== true) finding('idempotency', fe.id, `IDEMPOTENCY KEY MISSING: backend requires an Idempotency-Key for ${be.operationId} and the frontend call site does not send one`);
      if (!be.idempotencyRequired && sends === true) finding('idempotency', fe.id, `IDEMPOTENCY KEY UNDOCUMENTED: the frontend sends an Idempotency-Key for ${fe.id} but the backend does not declare one, so a retry is not known to be safe`);
    }
  }

  // E4 scope: what "the same request" means for a replay.
  if (backend.operations.some((o) => o.idempotencyRequired)) {
    assertions += 1;
    const scope = (backend.idempotencyScope ?? '').toLowerCase();
    const missing = SCOPE_TERMS.filter((term) => !scope.includes(term));
    if (missing.length > 0) {
      finding('idempotency', '(all)', `IDEMPOTENCY SCOPE CHANGED: the frontend mints one key per (actor, operation, key, body) intent; the backend's documented scope no longer names ${missing.join(', ')}`);
    }
  }

  // Known divergences: excuse what they match, and fail when they match nothing.
  const used = new Set<KnownDivergence>();
  const findings = raw.map((f) => {
    if (f.severity !== 'error') return f;
    const excuse = divergences.find((d) => d.op === f.operation && d.dimension === f.dimension && f.message.includes(d.matches));
    if (excuse === undefined) return f;
    used.add(excuse);
    return { ...f, severity: 'note' as const, message: `${f.message} — KNOWN DIVERGENCE (${excuse.owner}): ${excuse.reason}` };
  });
  for (const d of divergences) {
    assertions += 1;
    if (!used.has(d)) {
      findings.push({ gate: 'E', severity: 'error', service: 'edge-gateway', dimension: d.dimension, operation: d.op, message: `STALE KNOWN DIVERGENCE: "${d.matches}" no longer matches a finding; remove it from KNOWN_DIVERGENCES` });
    }
  }
  return { findings, assertions };
}
