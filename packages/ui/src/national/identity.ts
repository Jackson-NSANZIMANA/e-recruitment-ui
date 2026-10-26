/**
 * The statutory identity of the Republic of Rwanda, as this platform renders it.
 *
 * WHY THIS FILE HOLDS RAW COLOUR VALUES (ADR-FE-020). Every other colour in the
 * product is an @atlaskit/tokens token and must stay one. These are different
 * in kind: they are not design choices that a theme may move, they are the
 * colours of national symbols fixed in law (Law N° 34/2008 on the national
 * flag, as amended by Law N° 42/2018) and published as the Government of
 * Rwanda brand by RISA (Government of Rwanda Websites Guideline, Branding
 * Elements, guidelines.risa.gov.rw). Re-deriving them from a token ramp would
 * be a counterfeit flag. They are used ONLY where a national symbol is drawn
 * (the flag rule, the theme's brand seed, the PWA manifest) - never for text,
 * status, or chrome, which stay on ADS semantic tokens.
 */

export const NATIONAL_COLOURS = {
  /** Flag blue - Pantone 3005 (RISA "Blue"). Identity only: 2.9:1 on white, never text. */
  // eslint-disable-next-line usrp/no-raw-hex -- statutory national colour, see the file header (ADR-FE-020)
  flagBlue: "#00A1DE", // hygiene-allow-hex: statutory flag colour, Law 34/2008 + RISA brand sheet
  /** Flag yellow - Pantone 109 (RISA "Yellow"). */
  // eslint-disable-next-line usrp/no-raw-hex -- statutory national colour, see the file header (ADR-FE-020)
  flagYellow: "#FAD201", // hygiene-allow-hex: statutory flag colour, Law 34/2008 + RISA brand sheet
  /** Flag green - Pantone 3415 (RISA "Green", "Primary Green"). */
  // eslint-disable-next-line usrp/no-raw-hex -- statutory national colour, see the file header (ADR-FE-020)
  flagGreen: "#20603D", // hygiene-allow-hex: statutory flag colour, Law 34/2008 + RISA brand sheet
  /** Sun gold - Pantone 130 (RISA "Secondary Gold"). */
  // eslint-disable-next-line usrp/no-raw-hex -- statutory national colour, see the file header (ADR-FE-020)
  sunGold: "#E5BE01", // hygiene-allow-hex: statutory flag colour, Law 34/2008 + RISA brand sheet
  /**
   * RISA "Primary Blue": the Government of Rwanda's interface colour for
   * headings, links and buttons (10.32:1 on white, WCAG AAA). It seeds the ADS
   * brand ramp, so ADS derives every brand/link/focus token from it.
   */
  // eslint-disable-next-line usrp/no-raw-hex -- statutory national colour, see the file header (ADR-FE-020)
  primaryBlue: "#003F82", // hygiene-allow-hex: RISA GoR Primary Blue, seeds the ADS brand theme
} as const;

export type NationalColour = keyof typeof NATIONAL_COLOURS;

/**
 * The ADS theme for every USRP app: the stock light theme with the brand ramp
 * generated from GoR Primary Blue. Passed to AppProvider's `defaultTheme`.
 * Positive polarity stays pinned (AGENTS.md §5) - this changes hue, not mode.
 */
export const NATIONAL_THEME = {
  UNSAFE_themeOptions: { brandColor: NATIONAL_COLOURS.primaryBlue },
} as const;

/**
 * The flag's horizontal proportions read left to right as a ribbon: blue is
 * the upper half of the flag, yellow and green a quarter each (Law 34/2008).
 */
export const FLAG_RIBBON: readonly { readonly colour: NationalColour; readonly share: number }[] = [
  { colour: "flagBlue", share: 2 },
  { colour: "flagYellow", share: 1 },
  { colour: "flagGreen", share: 1 },
];

/**
 * RISA lockup geometry for "coat of arms + Republic of Rwanda": the gap is a
 * third of the symbol height, the text half of it, letter-spacing -2%, and the
 * clear space around the whole lockup a third of the symbol height.
 */
export const LOCKUP = {
  gapRatio: 1 / 3,
  textRatio: 1 / 2,
  letterSpacing: "-0.02em",
  clearSpaceRatio: 1 / 3,
} as const;

/** Laws the interface cites. Citations are shown verbatim, never paraphrased into a different number. */
export const LEGAL = {
  dataProtection: "Law N° 058/2021 of 13/10/2021",
  nationalFlag: "Law N° 34/2008, as amended by Law N° 42/2018",
} as const;

/** Rwanda Investigation Bureau toll-free line, for reporting recruitment fraud. */
export const RIB_HOTLINE = "166";

/** The official government second-level domain (RISA Digital Adoption Guidelines 2025). */
export const GOV_DOMAIN_SUFFIX = ".gov.rw";

/**
 * The statutory name of the state, by language. Shown as the lockup text in the
 * user's language and, on official documents, in all three at once - the way a
 * Rwandan passport's cover and data page carry it.
 */
export const STATE_NAME = {
  rw: "Repubulika y'u Rwanda",
  en: "Republic of Rwanda",
  fr: "République du Rwanda",
} as const;

export type StateNameLanguage = keyof typeof STATE_NAME;

export function stateNameFor(language: string): string {
  const key = language.slice(0, 2) as StateNameLanguage;
  return STATE_NAME[key] ?? STATE_NAME.en;
}

/** The national motto on the coat of arms: Unity, Work, Patriotism. */
export const NATIONAL_MOTTO = "Ubumwe · Umurimo · Gukunda Igihugu";
