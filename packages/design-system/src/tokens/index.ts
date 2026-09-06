/**
 * The single seam through which USRP touches the Atlassian token layer.
 *
 * Every colour, space, radius, and elevation in this repo resolves through
 * `token()`. Components import it from here rather than from @atlaskit/tokens
 * directly, so that if the token layer ever needs wrapping (a theme override,
 * a high-contrast variant, an audit hook) there is exactly one place to do it.
 *
 * WHAT DELIBERATELY IS NOT HERE
 * -----------------------------
 * The agency colour map and the status lozenge map used to live in @usrp/ui's
 * token file. They are NOT here, and their absence is the whole point of this
 * package.
 *
 * The DECISION they encode is preserved exactly and is not up for revisiting:
 * agency identity is expressed as ADS SEMANTIC COLOUR ROLES
 * (color.background.brand.bold / discovery.bold / success.bold), never as a
 * hand-picked hex, so light, dark and high-contrast themes keep working for
 * free. What changes is only WHERE that map lives: a table keyed by the three
 * agencies is domain knowledge, and domain knowledge in the layer every screen
 * imports is how a design system rots into an app.
 *
 * The map moves to the branding feature slice. See
 * tooling/repo-hygiene/MIGRATION-MAP.md. The lint rules in @usrp/eslint-config
 * will reject any attempt to bring it back here.
 */

export { token } from '@atlaskit/tokens';

/**
 * Build a frozen lookup from an arbitrary key to ADS semantic colour roles.
 *
 * This is the domain-free machinery that a feature slice uses to declare its
 * own branding table. It is generic on purpose: this package supplies the
 * mechanism and the constraint (ADS role names only, never a literal colour);
 * the feature slice supplies the meaning.
 *
 * Throwing rather than warning is deliberate. A hardcoded colour that reaches
 * production is invisible until someone opens the service in high-contrast mode
 * or under bright sun, and by then it is a support ticket rather than a build
 * failure.
 *
 * @example
 *   // in a feature slice that is ALLOWED to know about agencies:
 *   const roles = createSemanticRoleMap({
 *     ABC: { background: 'color.background.brand.bold', text: 'color.text.inverse' },
 *   });
 */
export function createSemanticRoleMap<
  const T extends Record<string, Record<string, string>>,
>(map: T): Readonly<T> {
  for (const [key, roles] of Object.entries(map)) {
    for (const [role, value] of Object.entries(roles)) {
      if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
        throw new Error(
          'createSemanticRoleMap: "' +
            key +
            '.' +
            role +
            '" is a literal colour ("' +
            value +
            '"). Pass an ADS token name such as "color.background.brand.bold" instead.',
        );
      }
    }
  }
  return Object.freeze(map);
}

export type SemanticRoleMap = Readonly<Record<string, Readonly<Record<string, string>>>>;
