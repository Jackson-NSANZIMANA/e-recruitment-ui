/**
 * Test environment setup for the applicant portal.
 *
 * jsdom implements the DOM but not the media-query API, and @atlaskit/tokens
 * calls `window.matchMedia` at IMPORT time (it binds a colour-mode listener
 * while `configure-page.js` is evaluated). Without this stub, any test that
 * imports an Atlaskit component dies before its first assertion with
 * "window.matchMedia is not a function" — a harness gap, not a product defect.
 *
 * Only the DOM tests need it, so the guard keeps this file inert under the
 * default `node` environment.
 */

/** A media query jsdom always answers "no" to: no ADS component branches on it here. */
function fakeMatchMedia(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = fakeMatchMedia;
}
