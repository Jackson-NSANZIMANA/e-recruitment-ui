import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

// Statically import locale bundles so they are available offline (PWA).
import enCommon from "./locales/en/common.json" with { type: "json" };
import rwCommon from "./locales/rw/common.json" with { type: "json" };
import frCommon from "./locales/fr/common.json" with { type: "json" };

export const SUPPORTED_LANGUAGES = ["en", "rw", "fr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  rw: "Kinyarwanda",
  fr: "Français",
};

/** The namespace every host app gets for free. Slices register their own. */
export const COMMON_NAMESPACE = "common";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon },
      rw: { common: rwCommon },
      fr: { common: frCommon },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: COMMON_NAMESPACE,
    interpolation: {
      // React already escapes output — no need for i18next to double-escape.
      escapeValue: false,
    },
    detection: {
      // Prefer explicit user choice, then browser language, then saved cookie.
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "usrp_lang",
    },
  });

// ══════════════════════════════════════════════════════════════════════════
// FEATURE-SLICE NAMESPACE REGISTRY
//
// READ THIS BEFORE MOUNTING A SLICE.
//
// Until this existed, `init()` above registered exactly ONE namespace. All six
// feature slices call `useTranslation('identity' | 'applications' | ...)` and
// ship their own locales/{en,rw,fr}.json, and NONE of those namespaces was
// registered anywhere.
//
// i18next returns THE KEY when a namespace is missing. It does not throw and it
// does not warn in production. So mounting a slice would have rendered the
// literal string `identity.officer.title` as visible text to a citizen on a
// national government portal: a screen that looks finished and communicates
// nothing. That is a worse failure than a blank page, because a blank page gets
// reported.
//
// WHY A FUNCTION AND NOT A STATIC IMPORT. @usrp/i18n cannot import the slices:
// every slice already depends on @usrp/i18n, so a static import here would
// create a package cycle and .dependency-cruiser.cjs would reject it. The host
// app composes instead — it is the only layer that knows which slices it mounts,
// which is exactly the layer that should decide which bundles ship in its chunk.
// ══════════════════════════════════════════════════════════════════════════

/** One locale's worth of a namespace, i.e. the parsed contents of `en.json`. */
export type NamespaceBundle = Readonly<Record<string, unknown>>;

/** All three locales for one namespace. All three are REQUIRED — see below. */
export type NamespaceBundles = Readonly<Record<SupportedLanguage, NamespaceBundle>>;

const REGISTERED = new Map<string, NamespaceBundles>();

/**
 * Make a feature slice's locale bundles resolvable.
 *
 * Idempotent for the same bundle object, so two slices sharing a namespace
 * (none do today) or a double-invoked entrypoint under StrictMode is harmless.
 *
 * REFUSES a conflicting re-registration rather than silently overwriting,
 * because a namespace collision that resolves to whichever slice registered
 * last is a bug that only shows up in one language.
 *
 * REQUIRES all three locales. A slice cannot ship English-only and quietly
 * degrade Kinyarwanda and French to raw keys — the two languages most of this
 * system's applicants actually read.
 */
export function registerNamespace(namespace: string, bundles: NamespaceBundles): void {
  if (namespace === COMMON_NAMESPACE) {
    throw new Error(
      `Refusing to re-register the "${COMMON_NAMESPACE}" namespace. It is owned by @usrp/i18n and loaded at init.`,
    );
  }

  const existing = REGISTERED.get(namespace);
  if (existing !== undefined) {
    if (existing === bundles) return;
    throw new Error(
      `i18n namespace "${namespace}" is already registered with a different bundle set. ` +
        `Two slices claiming one namespace resolve to whichever registered last.`,
    );
  }

  for (const language of SUPPORTED_LANGUAGES) {
    const bundle = bundles[language];
    if (bundle === undefined || Object.keys(bundle).length === 0) {
      throw new Error(`i18n namespace "${namespace}" has no "${language}" bundle. All three locales are required.`);
    }
  }

  REGISTERED.set(namespace, bundles);
  for (const language of SUPPORTED_LANGUAGES) {
    // deep = true, overwrite = false: additive, and never clobbers `common`.
    i18n.addResourceBundle(language, namespace, bundles[language], true, false);
  }
}

/** Namespaces resolvable right now, `common` included. Sorted, for diffing. */
export function registeredNamespaces(): readonly string[] {
  return [COMMON_NAMESPACE, ...REGISTERED.keys()].sort();
}

/**
 * Throw unless `namespace` will resolve.
 *
 * Call it from a host entrypoint after registration and before render. It turns
 * "this screen renders raw keys in production" into "this app refuses to start",
 * which is the trade every gate in this repository already makes.
 */
export function assertNamespaceRegistered(...namespaces: readonly string[]): void {
  const missing = namespaces.filter(
    (namespace) => namespace !== COMMON_NAMESPACE && !REGISTERED.has(namespace),
  );
  if (missing.length > 0) {
    throw new Error(
      `i18n namespaces not registered: ${missing.join(", ")}. ` +
        `Call the slice's register*Locales() from the host entrypoint before render. ` +
        `Registered: ${registeredNamespaces().join(", ")}.`,
    );
  }
}

export default i18n;
