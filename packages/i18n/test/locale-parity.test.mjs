/**
 * @usrp/i18n test suite. `node --test`, zero dependencies, no node_modules
 * required - the same reasoning @usrp/contracts recorded for choosing Node's
 * runner over vitest: neither vitest nor any test framework is a dependency of
 * this package, and CI installs with --frozen-lockfile, so a framework would
 * have to be added to the graph before a single assertion could run.
 *
 * Two halves:
 *   1. THE RULES hold on the shipped bundles.
 *   2. Corrected translation inventory remains aligned across English,
 *      French, and Kinyarwanda.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectFindings,
  discoverLocales,
  discoverBundles,
  loadBundle,
  flatten,
  interpolationTokens,
  REFERENCE_LOCALE,
} from "../scripts/locale-rules.mjs";

const REQUIRED_LOCALES = ["en", "fr", "rw"];
const EXPECTED_STATUS_COUNT = 19;
const EXPECTED_DOCUMENT_TYPE_COUNT = 11;

// ── 1. Shape ────────────────────────────────────────────────────────────────

test("all three official languages are present", () => {
  const locales = discoverLocales();

  for (const locale of REQUIRED_LOCALES) {
    assert.ok(
      locales.includes(locale),
      `locale '${locale}' is missing. Kinyarwanda, English and French are all required: ` +
        "a portal that falls back to English excludes the applicants it serves.",
    );
  }
});

test("Kinyarwanda is a first-class locale, not an afterthought", () => {
  const bundles = discoverBundles("rw");

  assert.ok(bundles.length > 0, "rw has no bundle files at all");

  assert.deepEqual(
    bundles,
    discoverBundles(REFERENCE_LOCALE),
    "rw does not carry the same bundle files as en",
  );
});

// ── 2. The rules hold on the shipped bundles ────────────────────────────────

test("every locale rule passes on the shipped bundles", () => {
  const findings = collectFindings();

  assert.deepEqual(
    findings,
    [],
    "locale findings:\n" +
      findings
        .map(
          (finding) =>
            `  [${finding.rule}] ${finding.locale}/${finding.file} ${finding.key} - ${finding.detail}`,
        )
        .join("\n"),
  );
});

test("key sets are identical across all three locales", () => {
  for (const file of discoverBundles(REFERENCE_LOCALE)) {
    const reference = [
      ...flatten(loadBundle(REFERENCE_LOCALE, file)).keys(),
    ].sort();

    for (const locale of REQUIRED_LOCALES) {
      const actual = [...flatten(loadBundle(locale, file)).keys()].sort();

      assert.deepEqual(
        actual,
        reference,
        `${locale}/${file} key set diverges from ${REFERENCE_LOCALE}`,
      );
    }
  }
});

test("no value is empty in any locale", () => {
  for (const file of discoverBundles(REFERENCE_LOCALE)) {
    for (const locale of REQUIRED_LOCALES) {
      for (const [key, value] of flatten(loadBundle(locale, file))) {
        assert.equal(
          typeof value,
          "string",
          `${locale}/${file} ${key} is not a string`,
        );

        assert.notEqual(value.trim(), "", `${locale}/${file} ${key} is empty`);
      }
    }
  }
});

// ── 3. The rule engine is proven to go RED ──────────────────────────────────

test("placeholder-parity detects a dropped interpolation token", () => {
  const english = "File type not allowed: {{name}}";
  const brokenKinyarwanda = "Ubwoko bw’idosiye ntibwemewe";

  const expected = interpolationTokens(english);
  const actual = interpolationTokens(brokenKinyarwanda);

  assert.ok(expected.has("name"), "reference token not detected");
  assert.ok(!actual.has("name"), "token wrongly detected in the broken string");
});

test("interpolation detection handles whitespace and dotted paths", () => {
  assert.deepEqual([...interpolationTokens("a {{ name }} b")], ["name"]);
  assert.deepEqual([...interpolationTokens("{{user.first}}")], ["user.first"]);
  assert.deepEqual([...interpolationTokens("none here")], []);
  assert.deepEqual([...interpolationTokens("{{a}} and {{b}}")], ["a", "b"]);
});

test("flatten ignores //-prefixed human notes", () => {
  const flat = flatten({
    "//note": "not copy",
    real: "copy",
    nested: {
      "//x": "no",
      y: "yes",
    },
  });

  assert.deepEqual([...flat.keys()].sort(), ["nested.y", "real"]);
});

// ── 4. Corrected translation inventory ─────────────────────────────────────
//
// These tests protect the corrected implementation instead of preserving old
// defects from the deprecated shared-types model.
//
// @usrp/contracts is the source of truth for legal statuses and agency-aware
// document types. i18n must provide complete, non-empty labels for the
// corrected translation inventory.

test("status map contains the corrected 19-status union in every locale", () => {
  for (const locale of REQUIRED_LOCALES) {
    const { status } = loadBundle(locale, "common.json");

    assert.equal(
      Object.keys(status).length,
      EXPECTED_STATUS_COUNT,
      `${locale}: status map must contain ${EXPECTED_STATUS_COUNT} corrected labels`,
    );
  }
});

test("status keys are identical across all locales", () => {
  const referenceStatusKeys = Object.keys(
    loadBundle(REFERENCE_LOCALE, "common.json").status,
  ).sort();

  assert.equal(
    referenceStatusKeys.length,
    EXPECTED_STATUS_COUNT,
    `en: expected ${EXPECTED_STATUS_COUNT} status labels`,
  );

  for (const locale of REQUIRED_LOCALES) {
    const status = loadBundle(locale, "common.json").status;
    const actualKeys = Object.keys(status).sort();

    assert.deepEqual(
      actualKeys,
      referenceStatusKeys,
      `${locale}: status labels diverge from ${REFERENCE_LOCALE}`,
    );

    for (const statusKey of actualKeys) {
      assert.equal(
        typeof status[statusKey],
        "string",
        `${locale}: status '${statusKey}' is not a string`,
      );

      assert.notEqual(
        status[statusKey].trim(),
        "",
        `${locale}: status '${statusKey}' label is empty`,
      );
    }
  }
});

test("corrected real statuses have labels", () => {
  const requiredStatuses = [
    "ACADEMIC_VETTING",
    "WALK_IN_REGISTERED",
    "WALK_IN_ON_SITE_VETTING",
    "WALK_IN_PHYSICAL_TEST",
    "WALK_IN_REJECTED",
  ];

  for (const locale of REQUIRED_LOCALES) {
    const { status } = loadBundle(locale, "common.json");

    for (const statusKey of requiredStatuses) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(status, statusKey),
        `${locale}: '${statusKey}' is a real status and must have a translation label`,
      );

      assert.notEqual(
        status[statusKey].trim(),
        "",
        `${locale}: '${statusKey}' label is empty`,
      );
    }
  }
});

test("officer authentication uses login-handle terminology, not email", () => {
  for (const locale of REQUIRED_LOCALES) {
    const { auth } = loadBundle(locale, "common.json");

    assert.ok(
      Object.prototype.hasOwnProperty.call(auth, "login_handle"),
      `${locale}: auth.login_handle is required for officer authentication`,
    );

    assert.notEqual(
      auth.login_handle.trim(),
      "",
      `${locale}: auth.login_handle must not be empty`,
    );

    assert.ok(
      !Object.prototype.hasOwnProperty.call(auth, "email"),
      `${locale}: auth.email must not return because officers authenticate using login handles`,
    );
  }
});

test("English invalid-credentials copy refers to login handle, not email", () => {
  const { auth } = loadBundle(REFERENCE_LOCALE, "common.json");

  assert.match(
    auth.invalid_credentials,
    /login handle/i,
    "en: auth.invalid_credentials must refer to the login handle",
  );

  assert.doesNotMatch(
    auth.invalid_credentials,
    /e-?mail/i,
    "en: auth.invalid_credentials must not incorrectly mention email",
  );
});

test("the login rejection does NOT reveal which half was wrong", () => {
  // iam-service returns one 401 INVALID_CREDENTIALS for unknown handle, wrong
  // password, and disabled account. The message must not become an account
  // enumeration oracle.
  for (const locale of REQUIRED_LOCALES) {
    const { auth } = loadBundle(locale, "common.json");
    const copy = auth.invalid_credentials.toLowerCase();

    for (const leak of [
      "no account",
      "account not found",
      "user not found",
      "wrong password",
      "incorrect password",
      "account disabled",
      "account is disabled",
      "compte introuvable",
      "mot de passe incorrect",
      "compte désactiv",
      "konti ntibonetse",
      "ijambo banga ritari ryo",
    ]) {
      assert.ok(
        !copy.includes(leak),
        `${locale}: auth.invalid_credentials reveals which credential was wrong ("${leak}"). ` +
          "The backend deliberately returns one rejection for unknown handle, wrong " +
          "password, and disabled account. Copy must not widen it.",
      );
    }
  }
});

test("document-type labels cover the corrected 11-item union", () => {
  for (const locale of REQUIRED_LOCALES) {
    const { document_type: documentTypes } = loadBundle(locale, "common.json");

    assert.equal(
      Object.keys(documentTypes).length,
      EXPECTED_DOCUMENT_TYPE_COUNT,
      `${locale}: document_type must contain ${EXPECTED_DOCUMENT_TYPE_COUNT} corrected labels`,
    );

    for (const documentType of [
      "NATIONAL_ID",
      "OLEVEL_CERTIFICATE",
      "CELIBACY_CERTIFICATE",
    ]) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(documentTypes, documentType),
        `${locale}: '${documentType}' must have a translation label`,
      );

      assert.notEqual(
        documentTypes[documentType].trim(),
        "",
        `${locale}: '${documentType}' label is empty`,
      );
    }
  }
});

test("document-type keys are identical across all locales", () => {
  const referenceDocumentTypes = Object.keys(
    loadBundle(REFERENCE_LOCALE, "common.json").document_type,
  ).sort();

  for (const locale of REQUIRED_LOCALES) {
    const actualDocumentTypes = Object.keys(
      loadBundle(locale, "common.json").document_type,
    ).sort();

    assert.deepEqual(
      actualDocumentTypes,
      referenceDocumentTypes,
      `${locale}: document_type labels diverge from ${REFERENCE_LOCALE}`,
    );
  }
});

// ── 5. PII and secrets never live in copy ───────────────────────────────────

test("no bundle contains a National-ID-shaped literal in any locale", () => {
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
