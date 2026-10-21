// ════════════════════════════════════════════════════════════════
// A small YAML reader for the BACKEND's edge document
// (services/edge-gateway/openapi/edge-v1.yaml).
//
// Why not packages/contracts/scripts/openapi/yaml.ts: that reader is
// deliberately limited to the subset THIS repository authors and rejects flow
// mappings, which the backend's edge document uses on almost every schema line
// (`{ type: string, minLength: 3 }`). Why not a YAML library: contract-drift
// runs against a checkout of another repository with no install step, and it
// must stay dependency-free like the rest of this tool.
//
// SUPPORTED: block mappings and sequences (2-space indent), flow mappings and
// flow sequences (nested), plain / single- / double-quoted scalars, numbers,
// true/false/null, `|`/`|-`/`>`/`>-` block scalars, `#` comments.
// REJECTED LOUDLY: anchors, aliases, tags, multi-document streams, tabs.
// ════════════════════════════════════════════════════════════════

export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

export class YamlLiteError extends Error {
  constructor(message: string, line: number) {
    super(`edge-v1.yaml:${line + 1}: ${message}`);
    this.name = 'YamlLiteError';
  }
}

interface Line {
  readonly indent: number;
  readonly text: string;
  readonly no: number;
}

function stripComment(raw: string): string {
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!;
    if (quote !== null) {
      if (ch === '\\' && quote === '"') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    // A quote opens a quoted scalar only where a scalar can start; the
    // apostrophe in `officer's` is text.
    if ((ch === '"' || ch === "'") && (i === 0 || /[\s:[{,]/.test(raw[i - 1]!))) quote = ch;
    else if (ch === '#' && (i === 0 || raw[i - 1] === ' ')) return raw.slice(0, i);
  }
  return raw;
}

function scalar(token: string, no: number): YamlValue {
  const t = token.trim();
  if (t === '' || t === '~' || t === 'null') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^[&*!]/.test(t)) throw new YamlLiteError(`anchors, aliases and tags are not supported: ${t}`, no);
  if (t.startsWith("'")) {
    if (!t.endsWith("'") || t.length < 2) throw new YamlLiteError(`unterminated single-quoted scalar: ${t}`, no);
    return t.slice(1, -1).replace(/''/g, "'");
  }
  if (t.startsWith('"')) {
    if (!t.endsWith('"') || t.length < 2) throw new YamlLiteError(`unterminated double-quoted scalar: ${t}`, no);
    return JSON.parse(t) as string;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
  return t;
}

/** Parse a flow collection starting at text[pos] ('{' or '['). Returns the value and the index after it. */
function flow(text: string, pos: number, no: number): { value: YamlValue; end: number } {
  const open = text[pos];
  const close = open === '{' ? '}' : ']';
  const isMap = open === '{';
  const map: { [key: string]: YamlValue } = {};
  const list: YamlValue[] = [];
  let i = pos + 1;
  const skip = (): void => {
    while (i < text.length && /\s/.test(text[i]!)) i += 1;
  };
  const readToken = (stops: string): string => {
    skip();
    const start = i;
    let quote: string | null = null;
    while (i < text.length) {
      const ch = text[i]!;
      if (quote !== null) {
        if (ch === '\\' && quote === '"') i += 1;
        else if (ch === quote) quote = null;
      } else if ((ch === '"' || ch === "'") && i === start) quote = ch;
      else if (stops.includes(ch)) break;
      i += 1;
    }
    return text.slice(start, i).trim();
  };
  const readValue = (): YamlValue => {
    skip();
    if (text[i] === '{' || text[i] === '[') {
      const nested = flow(text, i, no);
      i = nested.end;
      return nested.value;
    }
    return scalar(readToken(`,${close}`), no);
  };
  skip();
  while (i < text.length && text[i] !== close) {
    if (isMap) {
      const key = readToken(':,}');
      if (text[i] === ':') {
        i += 1;
        map[String(scalar(key, no))] = readValue();
      } else {
        // YAML 1.2: a flow-mapping entry without ':' is a key with a null value.
        // The backend writes `{ description: Category, agency, or … }`, which a
        // conforming parser reads as description "Category" plus null keys; so
        // does this one, and descriptions are therefore read as best-effort text.
        map[String(scalar(key, no))] = null;
      }
    } else {
      list.push(readValue());
    }
    skip();
    if (text[i] === ',') i += 1;
    skip();
  }
  if (text[i] !== close) throw new YamlLiteError(`unterminated flow collection`, no);
  return { value: isMap ? map : list, end: i + 1 };
}

function inlineValue(rest: string, no: number): YamlValue {
  const t = rest.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    const parsed = flow(t, 0, no);
    if (t.slice(parsed.end).trim() !== '') throw new YamlLiteError(`trailing text after flow collection: ${t}`, no);
    return parsed.value;
  }
  return scalar(t, no);
}

/** Split `key: value` at the first ':' outside quotes that is followed by space or end. */
function splitKey(text: string): { key: string; rest: string } | null {
  let quote: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quote !== null) {
      if (ch === quote) quote = null;
      continue;
    }
    if ((ch === '"' || ch === "'") && i === 0) quote = ch;
    else if (ch === '{' || ch === '[') return null;
    else if (ch === ':' && (i + 1 === text.length || text[i + 1] === ' ')) {
      const rawKey = text.slice(0, i).trim();
      return { key: String(scalar(rawKey, 0)), rest: text.slice(i + 1) };
    }
  }
  return null;
}

export function parseYamlLite(source: string): YamlValue {
  if (/\t/.test(source)) throw new YamlLiteError('tabs are not supported', 0);
  const raw = source.split('\n');
  const lines: Line[] = [];
  for (let no = 0; no < raw.length; no += 1) {
    const r = raw[no]!;
    if (r.trim() === '---') throw new YamlLiteError('multi-document streams are not supported', no);
    const stripped = stripComment(r).replace(/\s+$/, '');
    if (stripped.trim() === '') continue;
    lines.push({ indent: stripped.length - stripped.trimStart().length, text: stripped.trimStart(), no });
  }

  let index = 0;

  const blockScalar = (style: string, parentIndent: number): string => {
    const body: string[] = [];
    let blockIndent: number | null = null;
    // Block scalars keep blank lines; read raw lines between this and the next less-indented line.
    const startNo = lines[index - 1]!.no + 1;
    let no = startNo;
    while (no < raw.length) {
      const r = raw[no]!;
      if (r.trim() === '') {
        body.push('');
        no += 1;
        continue;
      }
      const ind = r.length - r.trimStart().length;
      if (ind <= parentIndent) break;
      blockIndent ??= ind;
      body.push(r.slice(blockIndent));
      no += 1;
    }
    while (index < lines.length && lines[index]!.no < no) index += 1;
    while (body.length > 0 && body[body.length - 1] === '') body.pop();
    const folded = style.startsWith('>')
      ? body.reduce((acc, l) => (acc === '' ? l : l === '' ? `${acc}\n` : acc.endsWith('\n') ? acc + l : `${acc} ${l}`), '')
      : body.join('\n');
    return style.endsWith('-') ? folded : `${folded}\n`;
  };

  const valueAfterKey = (rest: string, indent: number, no: number): YamlValue => {
    const t = rest.trim();
    if (/^[|>]-?$/.test(t)) return blockScalar(t, indent);
    if (t !== '') return inlineValue(t, no);
    const next = lines[index];
    if (next === undefined || next.indent < indent || (next.indent === indent && !next.text.startsWith('- '))) return null;
    return node(next.indent);
  };

  const node = (indent: number): YamlValue => {
    const first = lines[index]!;
    if (first.text.startsWith('- ') || first.text === '-') {
      const list: YamlValue[] = [];
      while (index < lines.length && lines[index]!.indent === indent && (lines[index]!.text.startsWith('- ') || lines[index]!.text === '-')) {
        const line = lines[index]!;
        index += 1;
        const item = line.text.slice(1).trim();
        if (item === '') {
          list.push(index < lines.length && lines[index]!.indent > indent ? node(lines[index]!.indent) : null);
          continue;
        }
        const kv = splitKey(item);
        if (kv === null) {
          list.push(inlineValue(item, line.no));
          continue;
        }
        // `- key: value` plus continuation keys indented under the item.
        const itemIndent = indent + 2;
        const map: { [key: string]: YamlValue } = { [kv.key]: valueAfterKey(kv.rest, itemIndent, line.no) };
        while (index < lines.length && lines[index]!.indent === itemIndent && !lines[index]!.text.startsWith('- ')) {
          const cont = lines[index]!;
          const ckv = splitKey(cont.text);
          if (ckv === null) throw new YamlLiteError(`expected a key in sequence item: ${cont.text}`, cont.no);
          index += 1;
          map[ckv.key] = valueAfterKey(ckv.rest, itemIndent, cont.no);
        }
        list.push(map);
      }
      return list;
    }
    const map: { [key: string]: YamlValue } = {};
    while (index < lines.length && lines[index]!.indent === indent && !lines[index]!.text.startsWith('- ')) {
      const line = lines[index]!;
      const kv = splitKey(line.text);
      if (kv === null) throw new YamlLiteError(`expected "key: value": ${line.text}`, line.no);
      index += 1;
      map[kv.key] = valueAfterKey(kv.rest, indent, line.no);
    }
    if (index < lines.length && lines[index]!.indent > indent) {
      throw new YamlLiteError(`unexpected indentation: ${lines[index]!.text}`, lines[index]!.no);
    }
    return map;
  };

  if (lines.length === 0) return null;
  const root = node(lines[0]!.indent);
  if (index < lines.length) throw new YamlLiteError(`could not parse: ${lines[index]!.text}`, lines[index]!.no);
  return root;
}
