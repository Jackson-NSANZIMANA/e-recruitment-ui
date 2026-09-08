/**
 * The shared predicate engine behind BOTH `pnpm lint` and `pnpm test` in this
 * package.
 *
 * ONE IMPLEMENTATION, TWO CONSUMERS - the same choice tooling/repo-hygiene made
 * for its ESLint rules and its CI sweep, and for the same reason: a lint rule
 * and a test that check "the same" thing with two bodies of code are two things
 * that will disagree, and the disagreement surfaces as a gate that passes in one
 * place and fails in the other.
 *
 * ZERO DEPENDENCIES. node:fs and node:path only. This module is importable from
 * a checkout with no node_modules at all, which is the whole point: on
 * 2026-09-08 `pnpm install` failed repo-wide for eleven hours, and during that
 * window nothing that needed a dependency could prove anything.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(join(HERE, '..'));
export const LOCALES_DIR = join(PACKAGE_ROOT, 'src', 'locales');

/** The reference locale. Every other locale is compared against this key set. */
export const REFERENCE_LOCALE = 'en';

/**
 * Values that are present-but-useless. A key with an empty string is WORSE than
 * an absent key: i18next falls back to the reference language on a missing key
 * and renders nothing at all on an empty one, so the empty case is the one that
 * ships a blank label to a citizen.
 */
const PLACEHOLDER_VALUE = /^(?:\s*|todo|fixme|xxx|tbd|translate ?me|untranslated|-+|\.+)$/i;
const PLACEHOLDER_SUBSTRING = /\b(?:TODO|FIXME|XXX|TBD|UNTRANSLATED|TRANSLATE ?ME)\b/i;

/** i18next interpolation tokens: {{name}}, {{ maxSize }}, {{agencyName}}. */
const INTERPOLATION = /\{\{\s*([A-Za-z0-9_$.]+)\s*\}\}/g;

/**
 * Anything shaped like a Rwandan National ID (16 digits) must never appear in a
 * locale bundle. A "sample" NID in example copy is real PII in a shipped bundle,
 * and locale files are the least-reviewed text in any frontend.
 */
const NID_SHAPED = /(?<!\d)\d{16}(?!\d)/;

/**
 * OTP NON-ENUMERATION, IN COPY.
 *
 * The platform answers a byte-identical 202 across at least four input classes:
 * real send, unknown National ID, unverified identity, and a NIDA record with no
 * phone number. That property is a deliberate cost the backend pays so that a
 * person holding a list of national IDs cannot learn which of them are applying
 * to the security services.
 *
 * UI copy is the last place that property can leak and the easiest place to
 * break it, out of ordinary helpfulness, in any of three languages. A translator
 * asked to make an error message "clearer" will reach straight for the
 * enumerating phrasing.
 *
 * There is no OTP copy in the bundle yet. Installing the rule now - while the
 * cost is zero - is cheaper than installing it after the phrase ships.
 */
const ENUMERATING_PHRASES = [
  // English
  'no such applicant', 'no such user', 'not registered', 'does not exist',
  "doesn't exist", 'unknown national id', 'no phone', 'no number on record',
  'not found in nida', 'never applied', 'no account with that',
  // French
  "n'existe pas", 'introuvable dans nida', 'aucun candidat', 'non enregistr',
  'aucun num', 'aucun compte avec',
  // Kinyarwanda
  'ntabwo yanditse', 'ntibonetse muri nida', 'nta musaba', 'nta nimero',
];

/** Key paths whose copy is subject to the non-enumeration rule. */
function isEnumerationSensitive(keyPath) {
  const k = keyPath.toLowerCase();
  return k.includes('otp') || k.includes('challenge') || k.startsWith('auth.');
}

export function discoverLocales() {
  if (!existsSync(LOCALES_DIR)) return [];
  return readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function discoverBundles(locale) {
  const dir = join(LOCALES_DIR, locale);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

export function loadBundle(locale, file) {
  const path = join(LOCALES_DIR, locale, file);
  const raw = readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${locale}/${file} is not valid JSON: ${err.message}`);
  }
}

/** Flatten to dotted leaf paths. Only string leaves are translatable copy. */
export function flatten(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    // A "//"-prefixed key is a note to humans, by the convention this repo
    // already uses in package.json. It is not copy and is not translated.
    if (key.startsWith('//')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

export function interpolationTokens(value) {
  if (typeof value !== 'string') return new Set();
  const found = new Set();
  for (const m of value.matchAll(INTERPOLATION)) found.add(m[1]);
  return found;
}

/**
 * Runs every rule and returns a flat array of findings.
 * A finding is `{ rule, locale, file, key, detail }`. Empty array means clean.
 */
export function collectFindings() {
  const findings = [];
  const locales = discoverLocales();

  if (!locales.includes(REFERENCE_LOCALE)) {
    findings.push({
      rule: 'reference-locale-present',
      locale: REFERENCE_LOCALE,
      file: '-',
      key: '-',
      detail: `reference locale '${REFERENCE_LOCALE}' not found under src/locales`,
    });
    return findings;
  }

  const referenceBundles = discoverBundles(REFERENCE_LOCALE);

  for (const file of referenceBundles) {
    const reference = flatten(loadBundle(REFERENCE_LOCALE, file));

    for (const locale of locales) {
      const bundles = discoverBundles(locale);

      // RULE: bundle-parity - every locale carries every reference bundle file.
      if (!bundles.includes(file)) {
        findings.push({
          rule: 'bundle-parity',
          locale,
          file,
          key: '-',
          detail: `${REFERENCE_LOCALE}/${file} has no ${locale} counterpart`,
        });
        continue;
      }

      const bundle = flatten(loadBundle(locale, file));

      // RULE: key-parity - missing keys.
      for (const key of reference.keys()) {
        if (!bundle.has(key)) {
          findings.push({ rule: 'key-parity', locale, file, key, detail: 'missing' });
        }
      }
      // RULE: key-parity - extra keys. An extra key is dead weight that reads as
      // coverage, and it is how a bundle drifts into describing a different UI.
      for (const key of bundle.keys()) {
        if (!reference.has(key)) {
          findings.push({
            rule: 'key-parity',
            locale,
            file,
            key,
            detail: `present in ${locale} but not in ${REFERENCE_LOCALE}`,
          });
        }
      }

      for (const [key, value] of bundle) {
        if (typeof value !== 'string') {
          findings.push({
            rule: 'string-values-only',
            locale,
            file,
            key,
            detail: `leaf is ${value === null ? 'null' : typeof value}, expected string`,
          });
          continue;
        }

        // RULE: no-empty-value / no-todo-value
        if (PLACEHOLDER_VALUE.test(value)) {
          findings.push({
            rule: 'no-empty-value',
            locale,
            file,
            key,
            detail: `value is empty or a placeholder (${JSON.stringify(value)})`,
          });
        } else if (PLACEHOLDER_SUBSTRING.test(value)) {
          findings.push({
            rule: 'no-todo-value',
            locale,
            file,
            key,
            detail: `value contains an untranslated marker (${JSON.stringify(value)})`,
          });
        }

        // RULE: no-raw-national-id
        if (NID_SHAPED.test(value)) {
          findings.push({
            rule: 'no-raw-national-id',
            locale,
            file,
            key,
            detail: 'value contains a 16-digit National-ID-shaped literal',
          });
        }

        // RULE: no-enumeration-in-otp
        if (isEnumerationSensitive(key)) {
          const haystack = value.toLowerCase();
          for (const phrase of ENUMERATING_PHRASES) {
            if (haystack.includes(phrase)) {
              findings.push({
                rule: 'no-enumeration-in-otp',
                locale,
                file,
                key,
                detail: `copy reveals whether an identity exists (matched "${phrase}")`,
              });
              break;
            }
          }
        }

        // RULE: placeholder-parity
        // THE LOAD-BEARING RULE. A translator who drops {{name}} produces
        // "File type not allowed:" with no filename - valid JSON, clean
        // typecheck, useless to the person holding the file.
        if (locale !== REFERENCE_LOCALE && reference.has(key)) {
          const expected = interpolationTokens(reference.get(key));
          const actual = interpolationTokens(value);
          for (const token of expected) {
            if (!actual.has(token)) {
              findings.push({
                rule: 'placeholder-parity',
                locale,
                file,
                key,
                detail: `{{${token}}} is in ${REFERENCE_LOCALE} but not in ${locale}`,
              });
            }
          }
          for (const token of actual) {
            if (!expected.has(token)) {
              findings.push({
                rule: 'placeholder-parity',
                locale,
                file,
                key,
                detail: `{{${token}}} is in ${locale} but not in ${REFERENCE_LOCALE} - i18next will render it literally`,
              });
            }
          }
        }
      }
    }
  }

  return findings;
}

/**
 * THE FICTION LEDGER.
 *
 * Five defects in the shipped bundles, transcribed from the files rather than
 * inferred. They are NOT fixed here: src/locales is a shared bundle consumed by
 * both apps and @usrp/ui, and correcting the status map is a contract-alignment
 * change against @usrp/contracts that deserves its own reviewable commit rather
 * than being smuggled into the gate added to make it visible.
 *
 * The test asserts each is STILL PRESENT. That reads perverse and is deliberate:
 * it is the quarantine pattern @usrp/shared-types already uses. Without it,
 * someone corrects the status map, leaves this ledger untouched, and the ledger
 * now describes a repository that no longer exists - at which point the next
 * reader trusts it and is misled. Asserting presence forces the ledger and the
 * code to move in the same commit.
 */
export const FICTIONAL_STATUSES = [
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
];

/** Real platform statuses with no label in any bundle. Every WALK_IN_* included. */
export const UNLABELLED_REAL_STATUSES = [
  'ACADEMIC_VETTING',
  'CRIMINAL_CLEARANCE',
  'DOCUMENT_REVIEW_GREEN',
  'DOCUMENT_REVIEW_AMBER',
  'SLOT_ASSIGNED',
  'PHYSICAL_TEST_SCHEDULED',
  'PHYSICAL_TEST_COMPLETE',
  'MEDICAL_REVIEW',
  'FINAL_SHORTLIST',
  'WALK_IN_REGISTERED',
  'WALK_IN_ON_SITE_VETTING',
  'WALK_IN_PHYSICAL_TEST',
  'WALK_IN_REJECTED',
];

/** The five statuses that ARE real and DO have a label. */
export const CORRECTLY_LABELLED_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
];
