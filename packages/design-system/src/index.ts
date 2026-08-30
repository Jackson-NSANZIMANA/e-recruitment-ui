/**
 * @usrp/design-system - the domain-free presentation layer.
 *
 * THE HARD RULE, enforced by lint and by tooling/repo-hygiene/check-boundaries.mjs:
 * nothing in this package may import a @usrp domain package, name a domain
 * concept, hardcode a colour, or ship an interactive target under 48px.
 *
 * If a component needs to know what an agency is, what an application status
 * means, or who an applicant is, it does not belong here. See
 * tooling/repo-hygiene/MIGRATION-MAP.md for where it goes instead.
 */

// --- Token seam --------------------------------------------------------------
export { token, createSemanticRoleMap } from './tokens/index.js';
export type { SemanticRoleMap } from './tokens/index.js';

// --- Accessibility floor -----------------------------------------------------
export {
  MIN_TOUCH_TARGET_PX,
  MIN_BODY_TEXT_PX,
  CONTRAST_AA_NORMAL_TEXT,
  CONTRAST_AA_LARGE_TEXT,
  CONTRAST_AA_NON_TEXT,
  COLOR_MODE,
  isAcceptableTouchTarget,
  TOUCH_TARGET_TOKEN_PX,
} from './a11y/index.js';
export type { ColorMode } from './a11y/index.js';

// --- Primitives --------------------------------------------------------------
export { ErrorBoundary } from './components/ErrorBoundary/index.js';
export { RouterLink } from './components/RouterLink/index.js';
export { TouchTarget } from './components/TouchTarget/index.js';
