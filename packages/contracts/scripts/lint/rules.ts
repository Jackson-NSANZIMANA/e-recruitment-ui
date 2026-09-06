// ════════════════════════════════════════════════════════════════
// The lint rules for @usrp/contracts and @usrp/shared-types.
//
// WHY THIS IS NOT ESLINT. It should be, and one day it will be: see the REQUEST
// in the branch report. `eslint` is not a declared dependency of either package
// and CI installs with `--frozen-lockfile`, so adding one here would turn a
// green pipeline red on `pnpm install` — before a single rule ever ran. What
// follows is therefore deliberately NOT a general-purpose linter. It is the set
// of platform invariants that a general-purpose linter could not check anyway:
// exact-path routing, hash containment, credential kinds, and the import-
// extension discipline whose absence produced this package's 15 typecheck
// errors. It has zero dependencies and runs on a machine that has never seen
// node_modules.
//
// EVERY RULE IS PROVEN TO GO RED. scripts/lint/selftest.ts feeds each rule a
// crafted violation and a crafted clean file and fails if either verdict is
// wrong. A rule that cannot go red is decoration, and this package does not
// ship decoration.
// ════════════════════════════════════════════════════════════════

export interface LintFile {
  /** Package-relative, POSIX separators, e.g. `src/generated/routes.ts`. */
  readonly path: string;
  readonly source: string;
}

export interface LintViolation {
  readonly rule: string;
  readonly file: string;
  /** 1-based, so it can be pasted into an editor. */
  readonly line: number;
  readonly message: string;
}

export interface Rule {
  readonly id: string;
  /** The invariant this rule defends, in one sentence, for the failure output. */
  readonly why: string;
  readonly check: (file: LintFile) => readonly LintViolation[];
}

// ─── Shared plumbing ───────────────────────────────────────────────────

/**
 * Blank out comments, preserving every byte offset and newline so reported line
 * numbers stay true. Rules that care about SHIPPED TEXT (a hash, a colour, a
 * cookie) run against this, because prose that names a forbidden thing in order
 * to forbid it is not a violation — documentation is how the prohibition
 * survives contact with the next engineer.
 *
 * KNOWN LIMIT, stated rather than hidden: a `//` inside a template literal is
 * treated as a comment start. That direction of error can only make a rule miss
 * a violation, never invent one, which is the safe direction for a gate that
 * blocks merges.
 */
export function stripComments(source: string): string {
  const out: string[] = [];
  let mode: 'code' | 'line' | 'block' = 'code';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] ?? '';
    const next = source[i + 1] ?? '';
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line';
        out.push('  ');
        i += 1;
        continue;
      }
      if (ch === '/' && next === '*') {
        mode = 'block';
        out.push('  ');
        i += 1;
        continue;
      }
      out.push(ch);
      continue;
    }
    if (mode === 'line') {
      if (ch === '\n') {
        mode = 'code';
        out.push('\n');
        continue;
      }
      out.push(' ');
      continue;
    }
    if (ch === '*' && next === '/') {
      mode = 'code';
      out.push('  ');
      i += 1;
      continue;
    }
    out.push(ch === '\n' ? '\n' : ' ');
  }
  return out.join('');
}

function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

export interface StringLiteral {
  readonly value: string;
  readonly offset: number;
}

/**
 * Every string / template literal in a file, with its offset. Used by the
 * exact-path rule, which must look INSIDE literals — a templated URL is only
 * ever expressed as one.
 */
export function stringLiterals(source: string): readonly StringLiteral[] {
  const found: StringLiteral[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i] ?? '';
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      const start = i + 1;
      let j = start;
      while (j < source.length) {
        const cur = source[j] ?? '';
        if (cur === '\\') {
          j += 2;
          continue;
        }
        if (cur === quote) break;
        if (cur === '\n' && quote !== '`') break;
        j += 1;
      }
      found.push({ value: source.slice(start, j), offset: start });
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return found;
}

const under = (file: LintFile, prefix: string): boolean => file.path.startsWith(prefix);

/**
 * THE ONE EXEMPTION, and why it is not a loophole.
 *
 * A rule that forbids the literal `nationalIdHash` cannot be written without
 * writing `nationalIdHash`. A test that proves the templated-path rule goes red
 * must contain a templated path. The detector and its proof both have to spell
 * the thing they detect, so the CONTENT rules skip two places: the linter's own
 * sources and the test suite.
 *
 * What that does NOT exempt is everything that ships or generates: src/** and
 * scripts/** outside scripts/lint/ are fully covered, which is the entire
 * surface a browser or a codegen run ever sees. The STRUCTURAL rules (import
 * extensions, generated banners) apply everywhere with no exemption at all, and
 * scripts/lint/selftest.ts proves each exempted rule still goes red on a file
 * outside these two paths. The exemption buys a rule the right to name its
 * target; it buys nothing else.
 */
const isPatternFixture = (file: LintFile): boolean =>
  file.path.startsWith('scripts/lint/') || file.path.startsWith('test/');

const violation = (
  rule: string,
  file: LintFile,
  offset: number,
  message: string,
): LintViolation => ({ rule, file: file.path, line: lineOf(file.source, offset), message });

// ─── The rules ───────────────────────────────────────────────────────

/** INVARIANT 1. shared-http routes by exact path; ids travel in the body. */
const exactPathOnly: Rule = {
  id: 'exact-path-only',
  why: 'shared-http routes by EXACT PATH ONLY. Any `/resource/${id}` URL is a bug, and a contract that describes one is a bug the whole frontend will build on.',
  check: (file) => {
    if (isPatternFixture(file)) return [];
    const out: LintViolation[] = [];
    for (const literal of stringLiterals(file.source)) {
      // Path-ish means: opens with `/` followed by an alphanumeric, and holds no
      // whitespace. That excludes the two things in this package that legitimately
      // begin with a slash and interpolate — `//` line-comment templates and `/**`
      // docblock templates in the code generator — without excluding any URL,
      // because no URL in this platform contains a space.
      if (!/^\/[A-Za-z0-9]/.test(literal.value)) continue;
      if (/\s/.test(literal.value)) continue;
      if (literal.value.includes('${')) {
        out.push(
          violation(
            'exact-path-only',
            file,
            literal.offset,
            `interpolated path segment in "${literal.value}" — the id belongs in the request body, not the URL`,
          ),
        );
        continue;
      }
      if (/\{[A-Za-z_]/.test(literal.value) || /\/:[A-Za-z_]/.test(literal.value)) {
        out.push(
          violation(
            'exact-path-only',
            file,
            literal.offset,
            `templated path "${literal.value}" — no service in this platform registers a path parameter`,
          ),
        );
      }
    }
    return out;
  },
};

/** INVARIANT 2. nationalIdHash is an internal cross-service key. */
const noNationalIdHash: Rule = {
  id: 'no-national-id-hash',
  why: 'nationalIdHash is an INTERNAL cross-service key and must not reach the browser. src/** is the shipped surface, so naming it in shipped code — not in prose about it — puts it one import away from a component.',
  check: (file) => {
    if (!under(file, 'src/')) return [];
    const code = stripComments(file.source);
    const out: LintViolation[] = [];
    for (const match of code.matchAll(/nationalIdHash/g)) {
      out.push(
        violation(
          'no-national-id-hash',
          file,
          match.index ?? 0,
          'nationalIdHash appears in shipped code. Raw National ID is request-only and its hash is service-internal; neither has a browser-side representation.',
        ),
      );
    }
    return out;
  },
};

/** INVARIANT 5. ADS tokens for every colour; zero raw hex, anywhere. */
const noRawHexColour: Rule = {
  id: 'no-raw-hex-colour',
  why: 'The design system is @atlaskit/tokens. A raw hex literal anywhere in the repo is a colour that cannot follow a theme, and the contract layer has no business holding one at all.',
  check: (file) => {
    if (isPatternFixture(file)) return [];
    const code = stripComments(file.source);
    const out: LintViolation[] = [];
    for (const match of code.matchAll(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)) {
      out.push(
        violation(
          'no-raw-hex-colour',
          file,
          match.index ?? 0,
          `raw hex literal ${match[0] ?? ''} — use @atlaskit/tokens`,
        ),
      );
    }
    return out;
  },
};

/** A contract typed `any` is not a contract. */
const noAny: Rule = {
  id: 'no-any',
  why: 'This package exists so the frontend stops guessing about the wire. `any` is the guess, spelled formally.',
  check: (file) => {
    if (isPatternFixture(file)) return [];
    const code = stripComments(file.source);
    const out: LintViolation[] = [];
    for (const match of code.matchAll(/\b(?:as\s+any|:\s*any|Array<any>|any\[\])\b/g)) {
      out.push(
        violation('no-any', file, match.index ?? 0, `\`${(match[0] ?? '').trim()}\` in the contract layer`),
      );
    }
    return out;
  },
};

/** Generated output must be labelled as generated, and nothing else may claim it. */
const generatedBanner: Rule = {
  id: 'generated-banner',
  why: 'A generated file that is not labelled invites a hand edit that the next `generate` silently erases. A hand-written file that IS labelled invites the opposite mistake.',
  check: (file) => {
    if (!under(file, 'src/')) return [];
    const marker = 'GENERATED FILE';
    const head = file.source.split('\n').slice(0, 20).join('\n');
    const isGenerated = under(file, 'src/generated/');
    if (isGenerated && !head.includes(marker)) {
      return [
        violation(
          'generated-banner',
          file,
          0,
          'file lives in src/generated/ but carries no GENERATED FILE banner in its first 20 lines',
        ),
      ];
    }
    if (!isGenerated && file.source.includes(marker)) {
      return [
        violation(
          'generated-banner',
          file,
          file.source.indexOf(marker),
          'hand-written file claims to be generated. Move it under src/generated/ or drop the banner.',
        ),
      ];
    }
    return [];
  },
};

/**
 * Normalise a relative specifier into a package-relative target path, so the
 * rule below can ask WHERE the import lands rather than where it was written.
 */
function resolveTarget(file: LintFile, specifier: string): string {
  const slash = file.path.lastIndexOf('/');
  const dir = slash === -1 ? '' : file.path.slice(0, slash);
  const parts = (dir === '' ? specifier : `${dir}/${specifier}`).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join('/');
}

/**
 * THE RULE THAT PINS THIS PACKAGE'S OWN BUG SHUT.
 *
 * `scripts/**` is EXECUTED by `node --experimental-strip-types`, which does no
 * extension remapping: a `./foo.js` specifier there is a runtime
 * ERR_MODULE_NOT_FOUND. `src/**` is COMPILED by tsc for a bundler, where the
 * specifier must be `.js`. Both halves are right; they are simply not
 * interchangeable — and the 15 typecheck errors this branch cleared were exactly
 * those two halves drifting apart with nothing watching.
 *
 * The rule keys off the import TARGET, not the importing file, because a test in
 * test/** legitimately imports both: `../src/agency.js` (bundler discipline,
 * remapped for execution by test/resolve-js-to-ts.mjs) and
 * `../scripts/lint/rules.ts` (executed directly).
 */
const runtimeImportExtension: Rule = {
  id: 'runtime-import-extension',
  why: 'The extension follows the TARGET: src/** is compiled for a bundler and must be imported as `.js`; scripts/** is executed by node --experimental-strip-types and must be imported as `.ts`. Getting it backwards fails at runtime in one direction and at compile time in the other.',
  check: (file) => {
    const code = stripComments(file.source);
    const out: LintViolation[] = [];
    const pattern = /(?:^|[\s;])(?:import|export)\b[^;'"`]*?from\s*['"](\.[^'"]*)['"]/gms;
    for (const match of code.matchAll(pattern)) {
      const specifier = match[1] ?? '';
      if (specifier.endsWith('.json') || specifier.endsWith('.mjs')) continue;
      const target = resolveTarget(file, specifier);
      const expected = target.startsWith('src/') ? '.js' : '.ts';
      if (specifier.endsWith(expected)) continue;
      out.push(
        violation(
          'runtime-import-extension',
          file,
          match.index ?? 0,
          `relative specifier "${specifier}" resolves to ${target}, which must be imported with "${expected}" (${
            expected === '.js' ? 'src/** is bundler-compiled' : 'scripts/** runs under node type-stripping'
          })`,
        ),
      );
    }
    return out;
  },
};

/** INVARIANT 4. Neither human credential is a cookie today. */
const noCookieCredential: Rule = {
  id: 'no-cookie-credential',
  why: 'Officers hold an Ed25519 bearer JWT; citizens hold an opaque revocable DB session. Neither is a cookie, and no server exists that would set one — a contract that mentions cookies is describing software nobody wrote.',
  check: (file) => {
    if (isPatternFixture(file)) return [];
    const code = stripComments(file.source);
    const out: LintViolation[] = [];
    for (const match of code.matchAll(/httpOnly|document\.cookie|Set-Cookie/gi)) {
      out.push(
        violation(
          'no-cookie-credential',
          file,
          match.index ?? 0,
          `"${match[0] ?? ''}" — there is no cookie in either credential model (ADR-016 bearer JWT, ADR-018 opaque session)`,
        ),
      );
    }
    return out;
  },
};

/** Rules applied to @usrp/contracts. */
export const CONTRACT_RULES: readonly Rule[] = [
  exactPathOnly,
  noNationalIdHash,
  noRawHexColour,
  noAny,
  generatedBanner,
  runtimeImportExtension,
  noCookieCredential,
];

// ─── @usrp/shared-types: a quarantine, not a contract ───────────────────────

/**
 * The deprecated package's fiction, enumerated. Every one of these was read out
 * of packages/shared-types/src/index.ts and checked against backend source:
 * none of them exists in any `*_ops` enum or any controller.
 *
 * The ledger is the gate. `shared-types` may SHRINK freely; it may not grow, and
 * it may not invent a fifteenth fictional status while nobody is looking.
 */
export const SHARED_TYPES_KNOWN_FICTION: readonly string[] = [
  'UNDER_REVIEW',
  'SHORTLISTED',
  'PHYSICAL_SCHEDULED',
  'PHYSICAL_PASSED',
  'PHYSICAL_FAILED',
  'MEDICAL_SCHEDULED',
  'MEDICAL_PASSED',
  'MEDICAL_FAILED',
  'VETTING_IN_PROGRESS',
  'VETTING_PASSED',
  'VETTING_FAILED',
  'EXPIRED',
  'SUPERADMIN',
  'PASSPORT_PHOTO',
  'ACADEMIC_CERTIFICATE',
  'MEDICAL_REPORT',
  'POLICE_CLEARANCE',
  'PROOF_OF_RESIDENCE',
  'DocumentQuality',
  'PENDING_REVIEW',
  'OTHER',
];

/** Deprecated packages must say so, in the file, at the top. */
const deprecationNotice: Rule = {
  id: 'deprecation-notice',
  why: '@usrp/contracts is the only legal source of domain types. A deprecated module that does not announce it will be imported by the next person who greps for ApplicationStatus.',
  check: (file) => {
    if (!under(file, 'src/')) return [];
    const head = file.source.split('\n').slice(0, 30).join('\n');
    if (head.includes('@deprecated')) return [];
    return [
      violation(
        'deprecation-notice',
        file,
        0,
        'no `@deprecated` marker in the first 30 lines. This package is slated for deletion; say so where an editor will show it.',
      ),
    ];
  },
};

/** Values in shared-types that DO exist in backend source. */
const KNOWN_REAL: readonly string[] = [
  'RDF',
  'RNP',
  'RCS',
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'NATIONAL_ID',
  'MALE',
  'FEMALE',
  'SYSTEM',
  'APPLICANT',
  'RECRUITMENT_OFFICER',
  'MEDICAL_OFFICER',
  'VETTING_OFFICER',
  'SENIOR_OFFICER',
];

/** Nothing new may be invented here. */
const frozenSurface: Rule = {
  id: 'frozen-surface',
  why: 'shared-types shipped 17 application statuses of which 5 were real. It is frozen: it may shrink as call sites migrate to @usrp/contracts, and it may not grow.',
  check: (file) => {
    if (!under(file, 'src/')) return [];
    const code = stripComments(file.source);
    const out: LintViolation[] = [];
    for (const match of code.matchAll(/"([A-Z][A-Z0-9_]{2,})"|'([A-Z][A-Z0-9_]{2,})'/g)) {
      const token = match[1] ?? match[2] ?? '';
      if (token.length === 0) continue;
      if (KNOWN_REAL.includes(token)) continue;
      if (SHARED_TYPES_KNOWN_FICTION.includes(token)) continue;
      out.push(
        violation(
          'frozen-surface',
          file,
          match.index ?? 0,
          `"${token}" is neither a value verified against backend source nor a listed known-fiction. Add it to @usrp/contracts if it is real; do not add it here.`,
        ),
      );
    }
    return out;
  },
};

export const SHARED_TYPES_RULES: readonly Rule[] = [
  deprecationNotice,
  frozenSurface,
  noRawHexColour,
  noAny,
  noCookieCredential,
  exactPathOnly,
];

export function runRules(
  rules: readonly Rule[],
  files: readonly LintFile[],
): readonly LintViolation[] {
  const out: LintViolation[] = [];
  for (const file of files) {
    for (const rule of rules) out.push(...rule.check(file));
  }
  return out.sort((a, b) =>
    a.file === b.file ? (a.line === b.line ? a.rule.localeCompare(b.rule) : a.line - b.line) : a.file.localeCompare(b.file),
  );
}
