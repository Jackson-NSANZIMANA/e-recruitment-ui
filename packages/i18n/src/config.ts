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
    defaultNS: "common",
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

export default i18n;
