/**
 * App and platform-package composition rules (S02, ADR-FE-007 / ADR-FE-010).
 *
 *   field-ledger   is a platform package: it imports no feature slice and no
 *                  React (it has no UI). Features may import it.
 *   field-station  composes ONLY identity, scheduling, field-ops and the
 *                  applications MODEL. The applications screens (the officer
 *                  workspace) are desktop administration and stay out of the
 *                  tablet bundle.
 *
 * PURE: text in, violations out. Zero dependencies, like the rest of this gate.
 */

export const FIELD_STATION_ALLOWED_SLICES = Object.freeze(['identity', 'scheduling', 'field-ops', 'applications']);
/** Names exported by @usrp/feature-applications that are screens, not model. */
export const APPLICATIONS_SCREEN_EXPORTS = Object.freeze(['ApplicationsPage', 'ApplicationDetailPage', 'StatusLozenge']);

const IMPORT_RE = /(?:import|export)\s+(type\s+)?(?:(\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function importsOf(text) {
  const out = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const specifier = m[3] ?? m[4];
    const names = (m[2] ?? '').replace(/[{}]/g, '').split(',').map((n) => n.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim()).filter(Boolean);
    out.push({ specifier, names, typeOnly: Boolean(m[1]), line: lineOf(text, m.index) });
  }
  return out;
}

/** Violations for one source file of packages/field-ledger. */
export function fieldLedgerViolations(text) {
  const out = [];
  for (const imp of importsOf(text)) {
    if (/^@usrp\/feature-/.test(imp.specifier)) out.push({ line: imp.line, detail: `imports "${imp.specifier}" - field-ledger is a platform package and must not know a feature` });
    else if (/^react(?:-dom)?(?:\/|$)/.test(imp.specifier) || /^@atlaskit\//.test(imp.specifier)) out.push({ line: imp.line, detail: `imports "${imp.specifier}" - field-ledger has no UI` });
  }
  return out;
}

/** Violations for one source file of apps/field-station. */
export function fieldStationViolations(text) {
  const out = [];
  for (const imp of importsOf(text)) {
    const slice = /^@usrp\/feature-([a-z-]+)/.exec(imp.specifier)?.[1];
    if (slice === undefined) continue;
    if (!FIELD_STATION_ALLOWED_SLICES.includes(slice)) {
      out.push({ line: imp.line, detail: `imports "@usrp/feature-${slice}" - field-station composes only ${FIELD_STATION_ALLOWED_SLICES.join(', ')} (ADR-FE-007)` });
      continue;
    }
    if (slice === 'applications') {
      for (const name of imp.names) {
        if (APPLICATIONS_SCREEN_EXPORTS.includes(name) || name.startsWith('*')) {
          out.push({ line: imp.line, detail: `imports "${name}" from @usrp/feature-applications - field-station may use the applications MODEL only` });
        }
      }
    }
  }
  return out;
}
