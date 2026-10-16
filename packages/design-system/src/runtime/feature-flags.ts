/**
 * ADS platform feature flags — one reviewed allowlist for every USRP app.
 *
 * Each app installs this with `setBooleanFeatureFlagResolver(resolveAdsFeatureFlag)`
 * before the first render. Every flag defaults to OFF, so ADS behaviour stays
 * deterministic and an upstream experiment cannot reach a national portal by
 * a dependency bump. A flag is enabled only by adding it here, with the reason.
 *
 * Pure and dependency-free on purpose: the resolver is a decision, not a
 * runtime, and it must be testable without a browser.
 */
export const ADS_ENABLED_FEATURE_FLAGS: ReadonlySet<string> = new Set([
  /**
   * @atlaskit/portal's React 18 container logic. The legacy portal creates its
   * container in useMemo and removes it in an effect cleanup; React StrictMode's
   * dev-only unmount/remount then strands the content in a detached node, so
   * every ADS modal opened empty on the dev server (W1-00: the officer Accept
   * confirmation never appeared). The flagged path creates and removes the
   * container in a layout effect, which is StrictMode-safe.
   */
  'platform_design_system_team_portal_logic_r18_fix',
]);

/** Resolver for `setBooleanFeatureFlagResolver`: allowlisted flags only. */
export function resolveAdsFeatureFlag(flagName: string): boolean {
  return ADS_ENABLED_FEATURE_FLAGS.has(flagName);
}
