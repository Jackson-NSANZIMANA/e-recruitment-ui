// ══════════════════════════════════════════════════════════════════
// @usrp/ui — the one number formatter
//
// Why this exists: `MetricCard` printed `value.toLocaleString()` (the browser's
// locale) while the legend twelve pixels below it printed `String(value)`. In
// French the same 1024 read "1 024" and "1024" on one card. Two formatters for
// one number is how a UI starts to feel assembled rather than designed.
//
// It is also an accessibility rule, not a taste rule: a screen reader reads the
// character sequence it is given. "1024" is read as one thousand and twenty-four
// by most voices, but "1 024" with a narrow no-break space is read as "one, zero,
// two, four" by some and skipped by others. So there is exactly one place that
// decides, and it takes the language the page is actually in.
// ══════════════════════════════════════════════════════════════════

/**
 * The locale tag for a language code.
 *
 * `Intl` wants a BCP-47 tag. "rw" is a valid language subtag, but a bare tag
 * with no region can resolve differently per engine for number grouping, so the
 * region is pinned: Rwanda for Kinyarwanda, France for French. English stays
 * generic "en" because the portal is not claiming a region for it.
 */
/*
 * Declared here rather than imported from @usrp/i18n on purpose: this file is a
 * pure function over a language tag, and importing the i18n runtime would make
 * the formatter untestable without React in the process. The cost is that the
 * list exists twice, so `test/layout.test.ts` reads `packages/i18n/src/config.ts`
 * and fails if the two ever disagree - the same source-text contract style the
 * design-system package already uses for its a11y floor.
 */
const LOCALE = {
  en: "en",
  rw: "rw-RW",
  fr: "fr-FR",
} as const;

export type FormatLanguage = keyof typeof LOCALE;

/** Narrow the i18next language string to a supported language, defaulting to English. */
export function asSupportedLanguage(language: string | undefined): FormatLanguage {
  const base = (language ?? "en").split("-")[0]?.toLowerCase() ?? "en";
  return base in LOCALE ? (base as FormatLanguage) : "en";
}

/**
 * A count in the page's language.
 *
 * Grouping is on (`1,024` / `1 024` depending on locale) because an officer
 * scans a four-digit figure and grouping is what makes it scannable. A
 * non-finite or missing value formats as an em dash: a metric that has no
 * reading is not zero, and printing zero is a claim.
 */
export function formatCount(value: number | null | undefined, language: string | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE[asSupportedLanguage(language)]).format(value);
}

/**
 * A signed percentage for a trend, or an em dash when there is no baseline.
 *
 * `trendOf` already refuses to invent a percentage from a zero baseline; this
 * only makes the sign and the separator follow the locale, so French gets its
 * own spacing rather than a hyphen borrowed from English source code.
 */
export function formatPercent(value: number | null | undefined, language: string | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE[asSupportedLanguage(language)], {
    style: "percent",
    maximumFractionDigits: 0,
    signDisplay: "exceptZero",
  }).format(value / 100);
}

/**
 * A share (0..1) as an unsigned whole percentage in the reader's locale, or an
 * em dash when there is no whole to take a share of. The signed `formatPercent`
 * above is for CHANGE; this is for "how much of the total".
 */
export function formatShare(value: number | null | undefined, language: string | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE[asSupportedLanguage(language)], { style: "percent", maximumFractionDigits: 0 }).format(value);
}
