export interface DesignSystemRuntimeCheck {
  theme: string | null;
  colorMode: string | null;
  fontFamilyBody: string;
  fontFamilyHeading: string;
  fontFamilyCode: string;
  atlassianSansLoaded: boolean;
  atlassianMonoLoaded: boolean;
}

/**
 * Call from the browser (dev console or a Playwright probe) to prove:
 *  1. AppProvider has mounted a theme on <html>.
 *  2. The ADS font-family tokens resolve to the "Atlassian Sans/Mono" stack.
 *  3. Our @font-face WOFF2 files actually loaded under those names.
 *
 * Any field returning null, '', or false is a configuration bug — not a hint
 * to add setGlobalTheme or hardcode a family.
 */
export async function verifyDesignSystemRuntime(): Promise<DesignSystemRuntimeCheck> {
  const html = document.documentElement;
  const styles = getComputedStyle(html);
  const get = (name: string) => styles.getPropertyValue(name).trim();

  await document.fonts.ready;

  return {
    theme: html.dataset["theme"] ?? null,
    colorMode: html.dataset["colorMode"] ?? null,
    fontFamilyBody: get("--ds-font-family-body"),
    fontFamilyHeading: get("--ds-font-family-heading"),
    fontFamilyCode: get("--ds-font-family-code"),
    atlassianSansLoaded:
      document.fonts.check('1em "Atlassian Sans"') &&
      document.fonts.check('700 1em "Atlassian Sans"'),
    atlassianMonoLoaded: document.fonts.check('1em "Atlassian Mono"'),
  };
}
