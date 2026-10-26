import React from "react";
import { Inline } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button/new";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, useTranslation, type SupportedLanguage } from "@usrp/i18n";

// Kinyarwanda first: it is the national language and the language most
// applicants read best (Constitution, art. 8; RISA requires a language switcher
// in every GoR header).
const ORDER: readonly SupportedLanguage[] = ["rw", "en", "fr"];

/**
 * Switch between Kinyarwanda, English and French.
 *
 * Each option is labelled in its own language and marked with `lang`, so a
 * screen reader pronounces "Français" as French whichever language the page is
 * in (WCAG 3.1.2). The choice persists through i18next's detector
 * (localStorage), and the app shells keep <html lang> in step.
 */
export function LanguageSwitcher(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const current = i18n.language.slice(0, 2);
  const languages = ORDER.filter((l) => (SUPPORTED_LANGUAGES as readonly string[]).includes(l));

  return (
    <nav aria-label={t("national.language")}>
      <Inline space="space.050" alignBlock="center" shouldWrap>
        {languages.map((language) => (
          <span key={language} lang={language}>
            <Button
              appearance="subtle"
              isSelected={current === language}
              aria-current={current === language ? "true" : undefined}
              onClick={() => { void i18n.changeLanguage(language); }}
            >
              {LANGUAGE_LABELS[language]}
            </Button>
          </span>
        ))}
      </Inline>
    </nav>
  );
}
