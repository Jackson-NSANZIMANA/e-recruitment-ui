/**
 * The accessibility floor, as constants and predicates rather than prose.
 *
 * The HCI research behind USRP produced real constraints. Prose constraints
 * get read once and drift; these are imported by components, asserted by unit
 * tests (test/a11y-contract.test.mjs), and enforced by a lint rule
 * (usrp/min-touch-target), so they cannot quietly stop being true.
 */

/**
 * Minimum interactive target, in CSS pixels.
 *
 * WCAG 2.1 AA SC 2.5.5 (Target Size) asks for 44x44. USRP's floor is 48. The
 * extra 4px are not padding for its own sake: applicants use this service
 * outdoors, one-handed, in queues, on low-end Android devices, and officers
 * operate field devices with gloved hands. 48 is also the ADS touch-comfortable
 * size, so nothing has to be hand-rolled to hit it.
 */
export const MIN_TOUCH_TARGET_PX = 48;

/**
 * Minimum body text size, in CSS pixels.
 *
 * Below 16px, mobile browsers zoom on focus and small type loses to sunlight
 * glare on a cheap screen. ADS `Text size="medium"` already satisfies this;
 * the constant exists so a test can assert it.
 */
export const MIN_BODY_TEXT_PX = 16;

/**
 * Contrast floors from WCAG 2.1 AA. axe-core enforces these against rendered
 * stories; the numbers live here so a story or a test references one source.
 */
export const CONTRAST_AA_NORMAL_TEXT = 4.5;
export const CONTRAST_AA_LARGE_TEXT = 3;
export const CONTRAST_AA_NON_TEXT = 3;

/**
 * USRP renders in POSITIVE POLARITY (dark text on light surfaces) and does not
 * ship a dark theme.
 *
 * This is a sunlight-readability decision, not an aesthetic one. Cheap LCD
 * panels at partial brightness in direct sun lose dark-mode contrast almost
 * entirely, while a light surface stays legible. Officers indoors lose nothing
 * by it. If a dark theme is ever requested, it needs a field-readability study
 * attached, not a preference.
 */
export const COLOR_MODE = 'light' as const;
export type ColorMode = typeof COLOR_MODE;

/**
 * True when a pixel dimension is large enough to be an interactive target.
 * The predicate a test asserts and a component can guard with.
 */
export function isAcceptableTouchTarget(
  px: number,
  min: number = MIN_TOUCH_TARGET_PX,
): boolean {
  return Number.isFinite(px) && px >= min;
}

/**
 * The pixel value that clears the touch floor, expressed once so components
 * never reach for a raw dimension string of their own choosing.
 */
export const TOUCH_TARGET_TOKEN_PX = '48px' as const;
