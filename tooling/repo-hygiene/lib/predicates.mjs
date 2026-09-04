/**
 * Shared, dependency-free predicates behind every USRP frontend hygiene gate.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The backend's doctrine (docs/architecture/ci-quality-gate.md) is "prove it,
 * don't assert it", and its hardest-won lesson is that CI must run the SAME
 * code a developer runs. A gate re-implemented in YAML drifts from the gate
 * implemented in a script, and a drifted gate is a green-but-hollow gate.
 *
 * So every rule here has exactly ONE implementation: a pure predicate. It is
 * consumed twice:
 *
 *   1. packages/eslint-config/rules/index.cjs -> real ESLint rules, so a
 *      developer sees the violation in the editor as they type.
 *   2. tooling/repo-hygiene/check-boundaries.mjs -> a standalone sweep needing
 *      NO node_modules, so CI enforces it before `pnpm install` and no
 *      dependency problem can silently disable it.
 *
 * Zero imports. Node >=20. Never add a dependency to this file.
 */

// --- Invariant 5: ADS is the only design system ------------------------------

/**
 * Package scopes the domain-free design-system layer may NEVER import.
 *
 * `@usrp/i18n` is on this list deliberately. A design system that resolves its
 * own user-facing strings cannot be rendered in a test, a story, or a second
 * product without booting a translation provider. Strings arrive as props.
 * That is the price of being a primitive.
 */
export const FORBIDDEN_DOMAIN_SCOPES = Object.freeze([
  '@usrp/shared-types',
  '@usrp/contracts',
  '@usrp/api-client',
  '@usrp/auth',
  '@usrp/features',
  '@usrp/i18n',
  '@usrp/ui',
]);

/**
 * Domain vocabulary that must not appear in the design-system layer at all,
 * even as a locally declared type or a string literal.
 *
 * `nationalId` / `nationalIdHash` are here for a reason that outranks tidiness:
 * brief invariant 2 says raw National ID is request-only and the hash must
 * never reach the browser. A presentational primitive that knows the word has
 * no business existing, and this list makes that structurally impossible in
 * the one package every screen imports.
 */
export const FORBIDDEN_DOMAIN_IDENTIFIERS = Object.freeze([
  'Agency',
  'AgencyTokenSet',
  'agencyTokens',
  'ApplicationStatus',
  'statusLozenge',
  'Applicant',
  'nationalId',
  'nationalIdHash',
  'RDF',
  'RNP',
  'RCS',
]);

/**
 * WCAG 2.1 AA SC 2.5.5 (Target Size) asks for 44x44 CSS px. USRP's floor is 48
 * and the extra 4px are not decoration: the HCI research behind this service
 * describes outdoor, one-handed, sunlight-glare use by applicants queueing at
 * recruitment centres, plus officers on field devices with gloves. 48 is the
 * touch-comfortable minimum and the number this repo enforces.
 */
export const MIN_TOUCH_TARGET_PX = 48;

/** Dimensional CSS properties that decide how big a thing is to hit. */
export const TOUCH_TARGET_PROPERTIES = Object.freeze([
  'width',
  'height',
  'minWidth',
  'minHeight',
  'min-width',
  'min-height',
  'blockSize',
  'inlineSize',
  'minBlockSize',
  'minInlineSize',
  'block-size',
  'inline-size',
]);

/** Escape hatches, so an exemption is a deliberate and greppable act. */
export const ALLOW_HEX_MARKER = 'hygiene-allow-hex';
export const ALLOW_SMALL_TARGET_MARKER = 'hygiene-allow-small-target';
export const ALLOW_DOMAIN_MARKER = 'hygiene-allow-domain';

// --- comment-aware scanning --------------------------------------------------

/**
 * Blank out comments while preserving line numbers and line count.
 *
 * WHY THIS MATTERS. The ESLint rules built on these predicates walk an AST and
 * therefore never see a comment. The standalone sweep reads raw text and would,
 * which would make the two implementations disagree - and a text gate that
 * flags the sentence explaining a rule is a gate developers learn to ignore.
 *
 * Handles single-quote, double-quote and template strings (so a `//` inside
 * "https://x" is not mistaken for a comment), line comments, block comments and
 * HTML comments (for .svg). Deliberately not a full parser: it is a lexer for
 * exactly the four cases that produce false positives here.
 *
 * @param {string} text
 * @returns {string} same length and line structure, comment bodies replaced by spaces
 */
export function stripComments(text) {
  const src = String(text);
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    // strings - copied verbatim, they are code
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i += 1;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        out += src[i];
        if (src[i] === quote) { i += 1; break; }
        i += 1;
      }
      continue;
    }

    // line comment
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i += 1; }
      continue;
    }

    // block comment
    if (c === '/' && next === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += '  ';
      i += 2;
      continue;
    }

    // html comment (svg / html)
    if (c === '<' && src.startsWith('<!--', i)) {
      while (i < n && !src.startsWith('-->', i)) {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += '   ';
      i += 3;
      continue;
    }

    out += c;
    i += 1;
  }

  return out;
}

// --- Import boundary ---------------------------------------------------------

/**
 * True when an import specifier crosses out of the domain-free layer.
 * Matches the scope itself and any subpath beneath it.
 *
 * @param {string} specifier raw module specifier, e.g. "@usrp/ui/tokens"
 * @returns {boolean}
 */
export function isForbiddenDomainImport(specifier) {
  if (typeof specifier !== 'string' || specifier.length === 0) return false;
  return FORBIDDEN_DOMAIN_SCOPES.some(
    (scope) => specifier === scope || specifier.startsWith(scope + '/'),
  );
}

// --- Raw colour literals (invariant 5: zero raw hex) -------------------------

// 3, 4, 6 or 8 hex digits, not glued to a preceding word character, so a URL
// fragment like /docs#a1b2c3 or an id selector is not mistaken for a colour.
const HEX_RE =
  /(^|[^\w&#])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4}))(?![0-9a-fA-F\w])/g;

/**
 * Find raw hex colour literals in a source text.
 *
 * This overlaps @atlaskit/design-system/ensure-design-token-usage on purpose
 * and casts a wider net: it also catches hex in plain data (a PWA manifest, an
 * inline SVG, a chart config) where the ADS rule has no jurisdiction but the
 * "zero raw hex" invariant still does.
 *
 * @param {string} text
 * @returns {{line: number, column: number, value: string}[]}
 */
export function findRawHexColors(text) {
  /** @type {{line: number, column: number, value: string}[]} */
  const found = [];
  // Markers are read from the original (they live in comments); matches are
  // found in the comment-stripped copy.
  const original = String(text).split(/\r?\n/);
  const lines = stripComments(text).split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    if (isExempt(original[i] ?? '', original[i - 1], ALLOW_HEX_MARKER)) return;
    HEX_RE.lastIndex = 0;
    let m;
    while ((m = HEX_RE.exec(rawLine)) !== null) {
      found.push({ line: i + 1, column: m.index + m[1].length + 1, value: m[2] });
    }
  });

  return found;
}

// --- Touch targets (WCAG 2.1 AA + USRP field-use floor) ----------------------

// Property name may be bare (`width:`), quoted (`'min-height':`) or bracketed
// (`['minWidth']:`), and the value may be a string, a template literal or a
// bare number followed by px. The quoted-key form is not hypothetical: every
// kebab-case CSS property MUST be quoted in a JS object, so missing it would
// have blinded the rule to half of all possible spellings.
const PX_VALUE_RE = new RegExp(
  '(?:^|[^\\w$-])[\'"`]?(' + TOUCH_TARGET_PROPERTIES.map(escapeRe).join('|') + ')[\'"`]?' +
    '\\s*\\]?\\s*:\\s*[\'"`]?\\s*\\$?\\{?\\s*(\\d+(?:\\.\\d+)?)\\s*\\}?px',
  'g',
);

/**
 * Find dimensional declarations smaller than the interactive minimum.
 *
 * Deliberately conservative: only a literal pixel number is flagged. A token,
 * a runtime variable or a rem value is not, because guessing at a computed
 * value is how a gate earns a reputation for crying wolf, and a gate people
 * route around is worse than no gate.
 *
 * @param {string} text
 * @param {number} [min]
 * @returns {{line: number, property: string, px: number}[]}
 */
export function findUndersizedTouchTargets(text, min = MIN_TOUCH_TARGET_PX) {
  /** @type {{line: number, property: string, px: number}[]} */
  const found = [];
  const original = String(text).split(/\r?\n/);
  const lines = stripComments(text).split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    if (isExempt(original[i] ?? '', original[i - 1], ALLOW_SMALL_TARGET_MARKER)) return;
    PX_VALUE_RE.lastIndex = 0;
    let m;
    while ((m = PX_VALUE_RE.exec(rawLine)) !== null) {
      const px = Number(m[2]);
      if (Number.isFinite(px) && px > 0 && px < min) {
        found.push({ line: i + 1, property: m[1], px });
      }
    }
  });

  return found;
}

/**
 * True when a pixel size is an acceptable interactive target.
 * @param {number} px
 * @param {number} [min]
 */
export function isAcceptableTouchTarget(px, min = MIN_TOUCH_TARGET_PX) {
  return Number.isFinite(px) && px >= min;
}

// --- Domain vocabulary leakage ----------------------------------------------

const IDENTIFIER_RES = FORBIDDEN_DOMAIN_IDENTIFIERS.map((id) => [
  id,
  new RegExp('\\b' + escapeRe(id) + '\\b', 'g'),
]);

/**
 * Find domain vocabulary in a source text.
 * @param {string} text
 * @returns {{line: number, identifier: string}[]}
 */
export function findDomainIdentifiers(text) {
  /** @type {{line: number, identifier: string}[]} */
  const found = [];
  const original = String(text).split(/\r?\n/);
  const lines = stripComments(text).split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    if (isExempt(original[i] ?? '', original[i - 1], ALLOW_DOMAIN_MARKER)) return;
    for (const [id, re] of IDENTIFIER_RES) {
      re.lastIndex = 0;
      if (re.test(rawLine)) found.push({ line: i + 1, identifier: id });
    }
  });

  return found;
}

/**
 * Find forbidden import specifiers by scanning text (the no-node_modules path).
 * Covers static imports, `export ... from`, dynamic import() and require().
 *
 * @param {string} text
 * @returns {{line: number, specifier: string}[]}
 */
export function findForbiddenImports(text) {
  /** @type {{line: number, specifier: string}[]} */
  const found = [];
  const lines = stripComments(text).split(/\r?\n/);
  const re = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g;

  lines.forEach((rawLine, i) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(rawLine)) !== null) {
      if (isForbiddenDomainImport(m[1])) {
        found.push({ line: i + 1, specifier: m[1] });
      }
    }
  });

  return found;
}

// --- helpers ----------------------------------------------------------------

/** @param {string} s */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * An exemption counts when the marker is on the offending line or the line
 * directly above it, which is where a developer writes the justification.
 *
 * @param {string} line
 * @param {string | undefined} previousLine
 * @param {string} marker
 */
function isExempt(line, previousLine, marker) {
  return line.includes(marker) || (previousLine ?? '').includes(marker);
}
