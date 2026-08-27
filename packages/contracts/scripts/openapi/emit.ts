// ════════════════════════════════════════════════════════════════
// OpenAPI schema -> Zod source text, and the shared identifier rules.
//
// WHAT THIS DELIBERATELY DOES NOT EMIT: `.datetime()` on a date-time string.
// The backend does not validate the format of any timestamp it RETURNS, so a
// client-side format assertion would be a constraint this platform never
// promised. In a national deployment a validator that rejects real server data
// is an outage with our name on it. Formats the backend genuinely enforces on
// the way IN (uuid patterns, the NESA/HEC regexes, the length bounds) ARE
// emitted, because there the contract is real.
// ════════════════════════════════════════════════════════════════

import { refName, type SchemaNode, type ServiceContract } from './ir.ts';
import type { YamlValue } from './yaml.ts';

export const BANNER = (service: string, sha: string, sourceFile: string): string =>
  `// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/${sourceFile.padEnd(42)}║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  ${sha.padEnd(50)}║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and \`verify\`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/${(sourceFile + ' instead.').padEnd(33)}║
// ╚══════════════════════════════════════════════════════════════╝
`;

export const schemaConst = (name: string): string => `${name}Schema`;

const quote = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function typesOf(node: SchemaNode): readonly string[] {
  const raw = node['type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

function stringChain(node: SchemaNode): string {
  let out = 'z.string()';
  const min = node['minLength'];
  const max = node['maxLength'];
  const pattern = node['pattern'];
  if (node['format'] === 'uuid') out += '.uuid()';
  if (typeof min === 'number' && min > 0) out += `.min(${min})`;
  if (typeof max === 'number') out += `.max(${max})`;
  if (typeof pattern === 'string') out += `.regex(/${pattern}/)`;
  return out;
}

/**
 * Render one schema node. `refs` maps a component name to the identifier that
 * holds it, so a $ref becomes a plain reference rather than an inlined copy.
 */
export function emitZod(node: SchemaNode, file: string, indent = 0): string {
  const pad = '  '.repeat(indent);
  const ref = node['$ref'];
  if (typeof ref === 'string') return schemaConst(refName(ref, file));

  const oneOf = node['oneOf'];
  if (Array.isArray(oneOf)) {
    const members = oneOf.map((member) =>
      emitZod(member as SchemaNode, file, indent + 1),
    );
    const discriminator = node['discriminator'];
    if (discriminator !== null && typeof discriminator === 'object' && !Array.isArray(discriminator)) {
      const key = (discriminator as Record<string, YamlValue>)['propertyName'];
      if (typeof key === 'string') {
        return `z.discriminatedUnion(${quote(key)}, [\n${members
          .map((m) => `${pad}  ${m},`)
          .join('\n')}\n${pad}])`;
      }
    }
    return `z.union([\n${members.map((m) => `${pad}  ${m},`).join('\n')}\n${pad}])`;
  }

  const constant = node['const'];
  if (typeof constant === 'string') return `z.literal(${quote(constant)})`;

  const enumeration = node['enum'];
  if (Array.isArray(enumeration)) {
    const values = enumeration.map((v) => quote(String(v)));
    if (values.length === 1) return `z.literal(${values[0]!})`;
    return `z.enum([${values.join(', ')}])`;
  }

  const types = typesOf(node);
  const nullable = types.includes('null');
  const primary = types.find((t) => t !== 'null');
  const suffix = nullable ? '.nullable()' : '';

  if (primary === undefined) {
    if (nullable) return 'z.null()';
    return 'z.unknown()';
  }

  switch (primary) {
    case 'string':
      return stringChain(node) + suffix;
    case 'number':
    case 'integer':
      return `z.number()${suffix}`;
    case 'boolean':
      return `z.boolean()${suffix}`;
    case 'array': {
      const items = node['items'];
      const inner =
        items === null || typeof items !== 'object' || Array.isArray(items)
          ? 'z.unknown()'
          : emitZod(items as SchemaNode, file, indent);
      const min = node['minItems'];
      const bound = typeof min === 'number' && min > 0 ? `.min(${min})` : '';
      return `z.array(${inner})${bound}${suffix}`;
    }
    case 'object': {
      const properties = node['properties'];
      if (properties === undefined || properties === null) {
        // An open object: the platform's jsonb columns and the opaque
        // ForensicsFlags / vectorClock payloads. Modelled as a record of
        // unknown, NOT as `any` — the values are genuinely not described
        // anywhere and pretending otherwise is the guess this package refuses.
        return `z.record(z.unknown())${suffix}`;
      }
      const props = properties as Record<string, YamlValue>;
      const required = new Set(
        Array.isArray(node['required'])
          ? node['required'].filter((r): r is string => typeof r === 'string')
          : [],
      );
      const lines = Object.entries(props).map(([key, child]) => {
        const rendered = emitZod(child as SchemaNode, file, indent + 1);
        const optional = required.has(key) ? '' : '.optional()';
        return `${pad}    ${JSON.stringify(key)}: ${rendered}${optional},`;
      });
      const open = node['additionalProperties'] === true;
      // additionalProperties:false -> .strict(). An unexpected key is a
      // CONTRACT BREACH, not noise: it means the wire grew a field this
      // package has never read, which is exactly the drift being hunted.
      const closing = open ? '' : '.strict()';
      return `z\n${pad}  .object({\n${lines.join('\n')}\n${pad}  })${closing}${suffix}`;
    }
    default:
      throw new Error(`${file}: unsupported schema type "${primary}"`);
  }
}

export function describeOperationTable(contract: ServiceContract): string {
  return contract.operations
    .map(
      (op) =>
        `//   ${op.method.toUpperCase().padEnd(4)} ${op.path.padEnd(46)} ${op.auth.join('|').padEnd(18)} ${op.reach}`,
    )
    .join('\n');
}
