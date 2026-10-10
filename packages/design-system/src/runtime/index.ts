/**
 * USRP design-system runtime — side effects required before React renders.
 *
 * Order matters:
 *   1. CSS reset (zeroes browser styles)
 *   2. @font-face declarations (so the token stack's first family resolves)
 *
 * AppProvider from @atlaskit/app-provider owns theme initialization and
 * mounts data-theme / data-color-mode on <html>. Do not add a second
 * initializer here.
 */
import "@atlaskit/css-reset";
import "../../fonts/index.js";

export { verifyDesignSystemRuntime } from "./verify.js";
