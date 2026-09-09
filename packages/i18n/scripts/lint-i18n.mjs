#!/usr/bin/env node
/**
 * GATE: the three shipped locale bundles are complete, safe and interpolation-
 * compatible.
 *
 * WHY THIS PACKAGE HAS A GATE AT ALL, when it declared only `typecheck` for
 * months: a recruitment portal for Rwandan citizens that silently falls back to
 * English excludes the applicants it exists to serve. `tsc --noEmit` cannot see
 * a missing Kinyarwanda key, an empty French value, or a dropped {{name}} token
 * - every one of those is valid JSON and valid TypeScript. Completeness here is
 * a legal-access property, so it is a gate, not an aspiration.
 *
 * Zero dependencies; runs on a bare checkout. Exits non-zero on any finding.
 *
 * Usage: node packages/i18n/scripts/lint-i18n.mjs
 */
import { collectFindings, discoverLocales, discoverBundles, REFERENCE_LOCALE } from './locale-rules.mjs';

const locales = discoverLocales();
const findings = collectFindings();

console.log(
  '[i18n] ' +
    locales.length +
    ' locale(s): ' +
    locales.join(', ') +
    '  |  reference: ' +
    REFERENCE_LOCALE +
    '  |  bundle(s): ' +
    discoverBundles(REFERENCE_LOCALE).join(', '),
);

if (findings.length === 0) {
  console.log('[i18n] PASS - key parity, no empty or placeholder values, interpolation intact,');
  console.log('[i18n]        no National-ID literals, no enumerating OTP copy.');
  process.exit(0);
}

// Group by rule so a reviewer sees the shape of the problem, not a flat wall.
// An unactionable failure gets skipped; a grouped one gets fixed.
const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}

console.error('');
console.error('[i18n] FAIL - ' + findings.length + ' finding(s) across ' + byRule.size + ' rule(s):');
for (const [rule, items] of [...byRule.entries()].sort()) {
  console.error('');
  console.error('  ' + rule + '  (' + items.length + ')');
  for (const f of items) {
    console.error('    ' + (f.locale + '/' + f.file).padEnd(20) + ' ' + f.key + ' - ' + f.detail);
  }
}
console.error('');
console.error('A missing key falls back to English. An EMPTY key renders nothing at all,');
console.error('which is why an empty value is treated as worse than an absent one.');
process.exit(1);
