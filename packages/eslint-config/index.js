// @ts-check
/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    "plugin:@atlaskit/design-system/recommended",
    "plugin:@atlaskit/ui-styling-standard/recommended",
  ],
  rules: {
    // Enforce token usage over raw CSS values
    "@atlaskit/design-system/ensure-design-token-usage": "error",
    "@atlaskit/design-system/no-deprecated-design-token-usage": "warn",
    // Prevent raw color / spacing literals in styles
    "@atlaskit/ui-styling-standard/enforce-style-prop": "error",
    "@atlaskit/ui-styling-standard/no-unsafe-values": "warn",
    // Accessibility: enforce sensible heading hierarchy
    "@atlaskit/design-system/use-heading": "warn",
  },
};
