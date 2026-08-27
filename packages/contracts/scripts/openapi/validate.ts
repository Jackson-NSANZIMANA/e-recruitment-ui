// ════════════════════════════════════════════════════════════════
// A zero-dependency validator for the OpenAPI subset these documents use.
//
// WHY THIS EXISTS ALONGSIDE THE GENERATED ZOD. The Zod schemas are the artifact
// consumers import; `zod` is a real dependency of this package and CI installs
// it. This validator reads the SAME IR the Zod emitter reads, and exists so the
// fixture round-trip gate can run with nothing installed at all — including on a
// machine that has never seen node_modules. `verify` runs the fixtures through
// BOTH and asserts they agree, so this is not a second source of truth; it is a
// second reader of one source, and the parity assertion is what keeps it honest.
//
// If the two ever disagree, verify fails and names the fixture. That is the
// whole point.
// ════════════════════════════════════════════════════════════════

import { refName, type SchemaNode } from './ir.ts';
import type { YamlValue } from './yaml.ts';

export interface Violation {
  readonly path: string;
  readonly message: string;
}

interface Ctx {
  readonly schemas: ReadonlyMap<string, SchemaNode>;
  readonly file: string;
  readonly out: Violation[];
}

const typeOfValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

function typesOf(node: SchemaNode): readonly string[] {
  const raw = node['type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

function check(node: SchemaNode, value: unknown, path: string, ctx: Ctx): void {
  const ref = node['$ref'];
  if (typeof ref === 'string') {
    const name = refName(ref, ctx.file);
    const target = ctx.schemas.get(name);
    if (target === undefined) {
      ctx.out.push({ path, message: `unresolved $ref ${name}` });
      return;
    }
    check(target, value, path, ctx);
    return;
  }

  const oneOf = node['oneOf'];
  if (Array.isArray(oneOf)) {
    const attempts = oneOf.map((member) => {
      const probe: Ctx = { schemas: ctx.schemas, file: ctx.file, out: [] };
      check(member as SchemaNode, value, path, probe);
      return probe.out;
    });
    if (attempts.some((v) => v.length === 0)) return;
    ctx.out.push({
      path,
      message: `matched no member of the union (${attempts.length} candidates); closest failure: ${
        attempts.sort((a, b) => a.length - b.length)[0]![0]?.message ?? 'unknown'
      }`,
    });
    return;
  }

  const constant = node['const'];
  if (typeof constant === 'string') {
    if (value !== constant) {
      ctx.out.push({ path, message: `expected literal ${JSON.stringify(constant)}, got ${JSON.stringify(value)}` });
    }
    return;
  }

  const enumeration = node['enum'];
  if (Array.isArray(enumeration)) {
    if (!enumeration.some((allowed) => allowed === value)) {
      ctx.out.push({ path, message: `${JSON.stringify(value)} is not one of the ${enumeration.length} allowed values` });
    }
    return;
  }

  const types = typesOf(node);
  const actual = typeOfValue(value);
  if (types.length === 0) return;
  if (value === null) {
    if (!types.includes('null')) ctx.out.push({ path, message: 'null is not permitted here' });
    return;
  }
  const primary = types.find((t) => t !== 'null');
  if (primary === undefined) {
    ctx.out.push({ path, message: 'only null is permitted here' });
    return;
  }

  if (primary === 'integer' || primary === 'number') {
    if (actual !== 'number') {
      ctx.out.push({ path, message: `expected ${primary}, got ${actual}` });
      return;
    }
    if (primary === 'integer' && !Number.isInteger(value)) {
      ctx.out.push({ path, message: 'expected an integer' });
    }
    return;
  }
  if (primary !== actual) {
    ctx.out.push({ path, message: `expected ${primary}, got ${actual}` });
    return;
  }

  if (primary === 'string') {
    const text = value as string;
    const min = node['minLength'];
    const max = node['maxLength'];
    const pattern = node['pattern'];
    if (typeof min === 'number' && text.length < min) {
      ctx.out.push({ path, message: `shorter than minLength ${min}` });
    }
    if (typeof max === 'number' && text.length > max) {
      ctx.out.push({ path, message: `longer than maxLength ${max}` });
    }
    if (typeof pattern === 'string' && !new RegExp(pattern).test(text)) {
      ctx.out.push({ path, message: `does not match pattern ${pattern}` });
    }
    if (node['format'] === 'uuid' && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(text)) {
      ctx.out.push({ path, message: 'not a UUID' });
    }
    return;
  }

  if (primary === 'array') {
    const items = node['items'];
    const min = node['minItems'];
    const list = value as unknown[];
    if (typeof min === 'number' && list.length < min) {
      ctx.out.push({ path, message: `fewer than minItems ${min}` });
    }
    if (items !== undefined && items !== null && typeof items === 'object' && !Array.isArray(items)) {
      list.forEach((item, i) => check(items as SchemaNode, item, `${path}[${i}]`, ctx));
    }
    return;
  }

  // object
  const properties = node['properties'];
  const record = value as Record<string, unknown>;
  if (properties === undefined || properties === null) return;
  const props = properties as Record<string, YamlValue>;
  const required = Array.isArray(node['required'])
    ? node['required'].filter((r): r is string => typeof r === 'string')
    : [];
  for (const key of required) {
    if (!Object.hasOwn(record, key)) {
      ctx.out.push({ path: `${path}.${key}`, message: 'required property is absent' });
    }
  }
  if (node['additionalProperties'] !== true) {
    for (const key of Object.keys(record)) {
      if (!Object.hasOwn(props, key)) {
        ctx.out.push({
          path: `${path}.${key}`,
          message: 'unexpected property (additionalProperties is false)',
        });
      }
    }
  }
  for (const [key, child] of Object.entries(props)) {
    if (!Object.hasOwn(record, key)) continue;
    check(child as SchemaNode, record[key], `${path}.${key}`, ctx);
  }
}

export function validateAgainst(
  schemaName: string,
  value: unknown,
  schemas: ReadonlyMap<string, SchemaNode>,
  file: string,
): readonly Violation[] {
  const node = schemas.get(schemaName);
  if (node === undefined) return [{ path: '$', message: `no component schema named "${schemaName}"` }];
  const ctx: Ctx = { schemas, file, out: [] };
  check(node, value, '$', ctx);
  return ctx.out;
}
