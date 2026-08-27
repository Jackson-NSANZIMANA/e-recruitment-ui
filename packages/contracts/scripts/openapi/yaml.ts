// ════════════════════════════════════════════════════════════════
// A deliberately SMALL YAML reader for the OpenAPI documents in this package.
//
// WHY NOT A YAML LIBRARY. @usrp/contracts is the type substrate every other
// frontend package will import. Pulling a general-purpose YAML parser (and its
// transitive tree) into a national deployment to read eleven files this
// repository itself authors is the wrong trade. The subset below is not
// "YAML minus the hard parts" chosen by convenience — it is the exact subset
// `openapi/*.yaml` is written in, and `verify` fails if a document strays
// outside it. A parser that silently accepts more than it understands is how a
// contract tool starts lying.
//
// SUPPORTED (and nothing else):
//   • block mappings, 2-space indentation, `key:` and `"key":`
//   • block sequences (`- item`, `- key: value` + continuation lines)
//   • flow sequences of scalars: ["a", "b"] / [200, 404]
//   • plain / single-quoted / double-quoted scalars, true|false|null, numbers
//   • folded (`>`, `>-`) and literal (`|`, `|-`) block scalars
//   • `#` comments, outside quotes
//
// UNSUPPORTED, and REJECTED LOUDLY rather than mis-read: anchors (&/*), tags
// (!!), multi-document streams (---), flow mappings ({a: b}), and tabs.
// ════════════════════════════════════════════════════════════════

export type YamlScalar = string | number | boolean | null;
export type YamlValue = YamlScalar | YamlValue[] | { [key: string]: YamlValue };

export class YamlError extends Error {
  readonly file: string;
  readonly line: number;

  constructor(message: string, file: string, line: number) {
    super(`${file}:${line + 1}: ${message}`);
    this.name = 'YamlError';
    this.file = file;
    this.line = line;
  }
}

interface PhysicalLine {
  readonly raw: string;
  readonly indent: number;
  readonly content: string;
  /** Index in the ORIGINAL file, for error messages that a human can act on. */
  readonly lineNo: number;
  readonly blank: boolean;
}

/** Strip a trailing `#` comment that is not inside a quoted scalar. */
function stripComment(raw: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote === null) {
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      // A `#` only opens a comment at the start of the line or after a space.
      if (ch === '#' && (i === 0 || raw[i - 1] === ' ')) return raw.slice(0, i);
      continue;
    }
    if (ch === '\\' && quote === '"') {
      i += 1;
      continue;
    }
    if (ch === quote) quote = null;
  }
  return raw;
}

function scan(source: string, file: string): PhysicalLine[] {
  return source.split('\n').map((raw, lineNo) => {
    if (raw.includes('\t')) {
      throw new YamlError('tab in indentation; this subset is 2-space only', file, lineNo);
    }
    const withoutComment = stripComment(raw);
    const trimmedRight = withoutComment.replace(/\s+$/, '');
    const indent = trimmedRight.length - trimmedRight.replace(/^ +/, '').length;
    const content = trimmedRight.slice(indent);
    return { raw, indent, content, lineNo, blank: content.length === 0 };
  });
}

const KEY_RE = /^(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([A-Za-z0-9_$./-]+)):(?: +(.*))?$/;

/** Parse one scalar token. Numbers stay numbers; quotes are honoured. */
function parseScalar(token: string, file: string, lineNo: number): YamlScalar {
  const text = token.trim();
  if (text.length === 0) return '';
  if (text.startsWith('&') || text.startsWith('*') || text.startsWith('!')) {
    throw new YamlError(`anchors/aliases/tags are not supported: ${text}`, file, lineNo);
  }
  if (text.startsWith('"')) {
    if (!text.endsWith('"') || text.length < 2) {
      throw new YamlError(`unterminated double-quoted scalar: ${text}`, file, lineNo);
    }
    return text
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (text.startsWith("'")) {
    if (!text.endsWith("'") || text.length < 2) {
      throw new YamlError(`unterminated single-quoted scalar: ${text}`, file, lineNo);
    }
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null' || text === '~') return null;
  if (/^-?\d+$/.test(text)) return Number.parseInt(text, 10);
  if (/^-?\d*\.\d+$/.test(text)) return Number.parseFloat(text);
  return text;
}

/** Split a flow sequence body on top-level commas, respecting quotes. */
function splitFlow(body: string, file: string, lineNo: number): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote !== null) {
      if (ch === '\\' && quote === '"') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    else if (ch === '{') throw new YamlError('flow mappings are not supported', file, lineNo);
    else if (ch === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function parseInline(token: string, file: string, lineNo: number): YamlValue {
  const text = token.trim();
  if (text.startsWith('[')) {
    if (!text.endsWith(']')) {
      throw new YamlError('flow sequence must open and close on one line', file, lineNo);
    }
    return splitFlow(text.slice(1, -1), file, lineNo).map((item) =>
      parseInline(item, file, lineNo),
    );
  }
  return parseScalar(text, file, lineNo);
}

export function parseYaml(source: string, file: string): YamlValue {
  const lines = scan(source, file);
  for (const line of lines) {
    if (line.content === '---' || line.content === '...') {
      throw new YamlError('multi-document streams are not supported', file, line.lineNo);
    }
  }
  let cursor = 0;

  const peek = (): PhysicalLine | null => {
    while (cursor < lines.length && lines[cursor]!.blank) cursor += 1;
    return cursor < lines.length ? lines[cursor]! : null;
  };

  /**
   * Consume a `>`/`|` block scalar owned by a key at `ownerIndent`.
   * Folded joins lines with a space and blank lines with a newline; literal
   * keeps every newline. A trailing `-` chomps the final newline.
   */
  const readBlockScalar = (header: string, ownerIndent: number): string => {
    const folded = header.startsWith('>');
    const chomp = header.includes('-');
    const collected: string[] = [];
    let bodyIndent = -1;
    while (cursor < lines.length) {
      const line = lines[cursor]!;
      if (line.blank) {
        collected.push('');
        cursor += 1;
        continue;
      }
      if (line.indent <= ownerIndent) break;
      if (bodyIndent === -1) bodyIndent = line.indent;
      collected.push(line.raw.slice(Math.min(bodyIndent, line.indent)).replace(/\s+$/, ''));
      cursor += 1;
    }
    while (collected.length > 0 && collected[collected.length - 1] === '') collected.pop();
    let text: string;
    if (!folded) {
      text = collected.join('\n');
    } else {
      // Folded: consecutive non-empty lines join with a space; a blank line is
      // a paragraph break. That is exactly how the `>-` descriptions in these
      // documents are written, and how a reader of the YAML expects them read.
      const paragraphs: string[][] = [[]];
      for (const piece of collected) {
        if (piece === '') {
          paragraphs.push([]);
          continue;
        }
        paragraphs[paragraphs.length - 1]!.push(piece);
      }
      text = paragraphs
        .filter((paragraph) => paragraph.length > 0)
        .map((paragraph) => paragraph.join(' '))
        .join('\n\n');
    }
    return chomp ? text.replace(/\n+$/, '') : `${text}\n`;
  };

  const parseValueAfterKey = (inline: string | undefined, keyIndent: number): YamlValue => {
    const token = (inline ?? '').trim();
    if (token.startsWith('>') || token.startsWith('|')) {
      return readBlockScalar(token, keyIndent);
    }
    if (token.length > 0) return parseInline(token, file, lines[cursor - 1]!.lineNo);
    const next = peek();
    if (next === null || next.indent <= keyIndent) return null;
    // A flow sequence may sit on the line AFTER its key, indented under it.
    // `required:` lists in these documents are written that way when long.
    if (next.content.startsWith('[')) {
      cursor += 1;
      return parseInline(next.content, file, next.lineNo);
    }
    return parseNode(next.indent);
  };

  function parseNode(indent: number): YamlValue {
    const first = peek();
    if (first === null) return null;
    if (first.content.startsWith('- ') || first.content === '-') {
      const seq: YamlValue[] = [];
      while (true) {
        const line = peek();
        if (line === null || line.indent !== indent) break;
        if (!line.content.startsWith('- ') && line.content !== '-') break;
        const rest = line.content === '-' ? '' : line.content.slice(2);
        cursor += 1;
        if (rest.length === 0) {
          const next = peek();
          seq.push(next !== null && next.indent > indent ? parseNode(next.indent) : null);
          continue;
        }
        const keyMatch = KEY_RE.exec(rest);
        if (keyMatch !== null) {
          // `- key: value` opens a mapping whose members sit at indent + 2.
          const memberIndent = indent + 2;
          const map: Record<string, YamlValue> = {};
          const key = keyMatch[1] ?? keyMatch[2] ?? keyMatch[3]!;
          map[key] = parseValueAfterKey(keyMatch[4], memberIndent);
          while (true) {
            const member = peek();
            if (member === null || member.indent !== memberIndent) break;
            if (member.content.startsWith('- ')) break;
            const m = KEY_RE.exec(member.content);
            if (m === null) {
              throw new YamlError(`expected "key: value", got: ${member.content}`, file, member.lineNo);
            }
            cursor += 1;
            map[m[1] ?? m[2] ?? m[3]!] = parseValueAfterKey(m[4], memberIndent);
          }
          seq.push(map);
          continue;
        }
        seq.push(parseInline(rest, file, line.lineNo));
      }
      return seq;
    }
    const map: Record<string, YamlValue> = {};
    while (true) {
      const line = peek();
      if (line === null || line.indent !== indent) break;
      if (line.content.startsWith('- ')) break;
      const m = KEY_RE.exec(line.content);
      if (m === null) {
        throw new YamlError(`expected "key: value", got: ${line.content}`, file, line.lineNo);
      }
      cursor += 1;
      map[m[1] ?? m[2] ?? m[3]!] = parseValueAfterKey(m[4], indent);
    }
    return map;
  }

  const root = peek();
  if (root === null) return null;
  const value = parseNode(root.indent);
  const trailing = peek();
  if (trailing !== null) {
    throw new YamlError(`unexpected content at indent ${trailing.indent}`, file, trailing.lineNo);
  }
  return value;
}
