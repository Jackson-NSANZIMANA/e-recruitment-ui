/**
 * @usrp/i18n test suite. `node --test`, zero dependencies, no node_modules
 * required - the same reasoning @usrp/contracts recorded for choosing Node's
 * runner over vitest: neither vitest nor any test framework is a dependency of
 * this package, and CI installs with --frozen-lockfile, so a framework would
 * have to be added to the graph before a single assertion could run.
 *
 * Two halves:
 *   1. THE RULES hold on the shipped bundles (and the rule engine itself is
 *      proven to go RED on a planted violation - a gate nobody has watched fail
 *      is a gate nobody should trust).
 *   2. THE FICTION LEDGER is still accurate, so it cannot quietly become a lie.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectFindings,
  discoverLocales,
  discoverBundles,
  loadBundle,
  flatten,
  interpolationTokens,
  REFERENCE_LOCALE,
  FICTIONAL_STATUSES,
  UNLABELLED_REAL_STATUSES,
  CORRECTLY_LABELLED_STATUSES,
} from '../scripts/locale-rules.mjs';

const REQUIRED_LOCALES = ['en', 'fr', 'rw'];

// ── 1. Shape ────────────────────────────────────────────────────────────────

test('all three official languages are present', () => {
  const locales = discoverLocales();
  for (const l of REQUIRED_LOCALES) {
    assert.ok(
      locales.includes(l),
      `locale '${l}' is missing. Kinyarwanda, English and French are all required: ` +
        'a portal that falls back to English excludes the applicants it serves.',
    );
  }
});

test('Kinyarwanda is a first-class locale, not an afterthought', () => {
  // rw is the language most applicants actually read. Asserted separately from
  // the loop above so a regression names it specifically in the failure output.
  const bundles = discoverBundles('rw');
  assert.ok(bundles.length > 0, 'rw has no bundle files at all');
  assert.deepEqual(
    bundles,
    discoverBundles(REFERENCE_LOCALE),
    'rw does not carry the same bundle files as en',
  );
});

// ── 2. The rules hold on the shipped bundles ────────────────────────────────

test('every locale rule passes on the shipped bundles', () => {
  const findings = collectFindings();
  assert.deepEqual(
    findings,
    [],
    'locale findings:\n' +
      findings.map((f) => `  [${f.rule}] ${f.locale}/${f.file} ${f.key} - ${f.detail}`).join('\n'),
  );
});

test('key sets are identical across all three locales', () => {
  for (const file of discoverBundles(REFERENCE_LOCALE)) {
    const reference = [...flatten(loadBundle(REFERENCE_LOCALE, file)).keys()].sort();
    for (const locale of REQUIRED_LOCALES) {
      const actual = [...flatten(loadBundle(locale, file)).keys()].sort();
      assert.deepEqual(actual, reference, `${locale}/${file} key set diverges from ${REFERENCE_LOCALE}`);
    }
  }
});

test('no value is empty in any locale', () => {
  for (const file of discoverBundles(REFERENCE_LOCALE)) {
    for (const locale of REQUIRED_LOCALES) {
      for (const [key, value] of flatten(loadBundle(locale, file))) {
        assert.equal(typeof value, 'string', `${locale}/${file} ${key} is not a string`);
        assert.notEqual(value.trim(), '', `${locale}/${file} ${key} is empty`);
      }
    }
  }
});

// ── 3. The rule engine is proven to go RED ──────────────────────────────────

test('placeholder-parity detects a dropped interpolation token', () => {
  // Proven directly against the predicate rather than by mutating the tree: a
  // test that writes into src/ to prove a point is a test that can leave the
  // repository dirty when it fails.
  const en = 'File type not allowed: {{name}}';
  const broken = 'Ubwoko bw\u2019idosiye ntibwemewe';
  const expected = interpolationTokens(en);
  const actual = interpolationTokens(broken);
  assert.ok(expected.has('name'), 'reference token not detected');
  assert.ok(!actual.has('name'), 'token wrongly detected in the broken string');
});

test('interpolation detection handles whitespace and dotted paths', () => {
  assert.deepEqual([...interpolationTokens('a {{ name }} b')], ['name']);
  assert.deepEqual([...interpolationTokens('{{user.first}}')], ['user.first']);
  assert.deepEqual([...interpolationTokens('none here')], []);
  assert.deepEqual([...interpolationTokens('{{a}} and {{b}}')], ['a', 'b']);
});

test('flatten ignores //-prefixed human notes', () => {
  const flat = flatten({ '//note': 'not copy', real: 'copy', nested: { '//x': 'no', y: 'yes' } });
  assert.deepEqual([...flat.keys()].sort(), ['nested.y', 'real']);
});

// ── 4. The fiction ledger is still accurate ─────────────────────────────────
//
// These assert that KNOWN DEFECTS ARE STILL PRESENT. If one is fixed without
// updating this ledger, the ledger becomes a lie that the next reader trusts.
// Fixing a defect therefore requires editing this file in the same commit -
// which is exactly the coupling that keeps documentation true.

test('LEDGER: the status map still carries exactly 17 keys', () => {
  const status = loadBundle(REFERENCE_LOCALE, 'common.json').status;
  assert.equal(
    Object.keys(status).length,
    17,
    'The status map changed size. If you corrected it against @usrp/contracts, ' +
      'update this ledger and the four tests below in the same commit.',
  );
});

test('LEDGER: twelve fictional statuses are still labelled', () => {
  const status = loadBundle(REFERENCE_LOCALE, 'common.json').status;
  assert.equal(FICTIONAL_STATUSES.length, 12, 'the fictional-status list itself changed');
  for (const s of FICTIONAL_STATUSES) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(status, s),
      `'${s}' is no longer labelled. It exists in no ops schema, so removing it is ` +
        'CORRECT - drop it from FICTIONAL_STATUSES in the same commit.',
    );
  }
});

test('LEDGER: thirteen real statuses are still unlabelled, including every WALK_IN_*', () => {
  const status = loadBundle(REFERENCE_LOCALE, 'common.json').status;
  assert.equal(UNLABELLED_REAL_STATUSES.length, 13, 'the unlabelled-status list itself changed');
  for (const s of UNLABELLED_REAL_STATUSES) {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(status, s),
      `'${s}' now HAS a label. That is a fix - remove it from UNLABELLED_REAL_STATUSES.`,
    );
  }
  const walkIn = UNLABELLED_REAL_STATUSES.filter((s) => s.startsWith('WALK_IN_'));
  assert.equal(
    walkIn.length,
    4,
    'RDF is the only agency with a walk-in lane and none of its four states has a label',
  );
});

test('LEDGER: the five genuinely-real statuses are labelled in all three locales', () => {
  // The half of the map that is CORRECT. Asserted so a cleanup pass cannot
  // delete a real label while removing the fictional ones.
  for (const locale of REQUIRED_LOCALES) {
    const status = loadBundle(locale, 'common.json').status;
    for (const s of CORRECTLY_LABELLED_STATUSES) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(status, s),
        `${locale}: '${s}' is real and MUST keep its label`,
      );
      assert.notEqual(status[s].trim(), '', `${locale}: '${s}' label is empty`);
    }
  }
});

test('LEDGER: auth.email still asks officers for a credential that does not exist', () => {
  // officer_accounts.login_handle is varchar(128). There is no email column in
  // the credential store, and the wire field is `loginHandle`. Every officer in
  // all three agencies is currently asked for an "Email address".
  const auth = loadBundle(REFERENCE_LOCALE, 'common.json').auth;
  assert.ok(
    Object.prototype.hasOwnProperty.call(auth, 'email'),
    "auth.email is gone. If you renamed it to auth.login_handle, that is the fix - " +
      'delete this ledger entry and the one below.',
  );
  assert.match(
    auth.email,
    /e-?mail/i,
    'auth.email no longer says "email" - if it now names the login handle, drop this entry',
  );
});

test('LEDGER: the login rejection message still names email', () => {
  const auth = loadBundle(REFERENCE_LOCALE, 'common.json').auth;
  assert.match(
    auth.invalid_credentials,
    /e-?mail/i,
    'auth.invalid_credentials no longer names email - drop this ledger entry',
  );
});

test('LEDGER: the login rejection does NOT reveal which half was wrong', () => {
  // This one asserts a property that is currently CORRECT and must stay so.
  // iam-service returns one 401 INVALID_CREDENTIALS for unknown handle, wrong
  // password AND disabled account. A message that distinguishes them turns a
  // deliberate non-enumeration property into a staff-directory oracle for the
  // national security services.
  for (const locale of REQUIRED_LOCALES) {
    const auth = loadBundle(locale, 'common.json').auth;
    const copy = auth.invalid_credentials.toLowerCase();
    for (const leak of [
      'no account', 'account not found', 'user not found', 'wrong password',
      'incorrect password', 'account disabled', 'account is disabled',
      'compte introuvable', 'mot de passe incorrect', 'compte d\u00e9sactiv',
      'konti ntibonetse', 'ijambo banga ritari ryo',
    ]) {
      assert.ok(
        !copy.includes(leak),
        `${locale}: auth.invalid_credentials reveals which credential was wrong ("${leak}"). ` +
          'The backend deliberately returns ONE rejection for unknown handle, wrong ' +
          'password and disabled account. Copy must not widen it.',
      );
    }
  }
});

test('LEDGER: document_type is still modelled agency-agnostically', () => {
  // Six values, modelled as if all three agencies accept the same set. Per the
  // @usrp/shared-types freeze, one is real and the three agencies accept three
  // different sets. Recorded, not fixed: the correct sets belong in
  // @usrp/contracts, per agency.
  const docs = loadBundle(REFERENCE_LOCALE, 'common.json').document_type;
  assert.equal(
    Object.keys(docs).length,
    6,
    'document_type changed size - if it is now per-agency, drop this ledger entry',
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(docs, 'NATIONAL_ID'),
    'NATIONAL_ID is the one value with a real counterpart and must survive any correction',
  );
});

// ── 5. PII and secrets never live in copy ───────────────────────────────────

test('no bundle contains a National-ID-shaped literal in any locale', () => {
  for (const file of discoverBundles(REFERENCE_LOCALE)) {
    for (const locale of REQUIRED_LOCALES) {
      for (const [key, value] of flatten(loadBundle(locale, file))) {
        assert.ok(
          !/(?<!\d)\d{16}(?!\d)/.test(value),
          `${locale}/${file} ${key} contains a 16-digit National-ID-shaped literal. ` +
            'A "sample" NID in example copy is real PII in a shipped bundle.',
        );
      }
    }
  }
});
