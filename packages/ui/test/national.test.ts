import { test } from "node:test";
import assert from "node:assert/strict";
import { FLAG_RIBBON, NATIONAL_COLOURS, NATIONAL_THEME, STATE_NAME, stateNameFor } from "../src/national/identity.ts";

// The statutory values, restated here from the RISA Government of Rwanda
// Websites Guideline (Branding Elements) so a well-meaning edit to identity.ts
// fails a test instead of shipping a counterfeit flag.
const RISA = { flagBlue: "00A1DE", flagYellow: "FAD201", flagGreen: "20603D", sunGold: "E5BE01", primaryBlue: "003F82" };

function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrastOnWhite = (hex: string): number => 1.05 / (luminance(hex) + 0.05);

test("national colours are the RISA / Law 34/2008 values, unaltered", () => {
  for (const [name, hex] of Object.entries(RISA)) {
    assert.equal(NATIONAL_COLOURS[name as keyof typeof NATIONAL_COLOURS].slice(1).toUpperCase(), hex, name);
  }
});

test("the ADS brand seed is GoR Primary Blue and clears WCAG AAA on white", () => {
  assert.equal(NATIONAL_THEME.UNSAFE_themeOptions.brandColor, NATIONAL_COLOURS.primaryBlue);
  const ratio = contrastOnWhite(RISA.primaryBlue);
  assert.ok(ratio >= 7, `primary blue ${ratio.toFixed(2)}:1`);
  // RISA publishes 10.32:1; allow for rounding in their figure.
  assert.ok(Math.abs(ratio - 10.32) < 0.1, `expected ~10.32:1, got ${ratio.toFixed(2)}:1`);
});

test("flag blue is identity-only: it fails text contrast, which is why it never carries text", () => {
  assert.ok(contrastOnWhite(RISA.flagBlue) < 4.5);
});

test("the ribbon keeps the flag's proportions: blue half, yellow and green a quarter each", () => {
  assert.deepEqual(FLAG_RIBBON.map((b) => [b.colour, b.share]), [["flagBlue", 2], ["flagYellow", 1], ["flagGreen", 1]]);
});

test("the state's name follows the language, falling back to English", () => {
  assert.equal(stateNameFor("rw"), "Repubulika y'u Rwanda");
  assert.equal(stateNameFor("fr-FR"), "République du Rwanda");
  assert.equal(stateNameFor("en-GB"), STATE_NAME.en);
  assert.equal(stateNameFor("sw"), STATE_NAME.en);
});
