// ══════════════════════════════════════════════════════════════════
// One stylesheet, sorted once.
//
// Compiled emits atomic CSS (`._1e0cglyw{display:none}`) and relies on ONE
// global ordering: plain rules first, then `@media` blocks, so a media rule
// can override a plain rule of equal specificity. A production build broke
// that in two ways:
//   1. `compiled-extracted-*.css` is a SECOND <link> after the main sheet, and
//      repeats plain rules the main sheet already placed before its media block.
//   2. Lazy chunks (`select-*.css`) ship their own copies of the same rules and
//      are appended to <head> when they load.
// Either way a late `display:none` beat `@media(min-width:64rem){display:initial}`
// and the Atlaskit side nav was never visible on desktop.
//
// Fix: `build.cssCodeSplit: false` (one CSS asset for every chunk) plus this
// plugin, which folds the extracted file into it and sorts the result once with
// the same `sort` Compiled itself uses. It runs at enforce:"post", so plugin order does not matter.
// ══════════════════════════════════════════════════════════════════

import { createRequire } from "node:module";

// Structural types only: tooling/ sits outside every app's dependencies, so it
// cannot import from "vite" (same approach as surface-contract's vite-readiness).
interface BundleEntry {
  readonly type: "asset" | "chunk";
  readonly fileName: string;
  source?: string | Uint8Array;
}
interface MinimalPlugin {
  readonly name: string;
  readonly apply: "build";
  readonly enforce: "post";
  generateBundle(this: { error(message: string): never }, options: unknown, bundle: Record<string, BundleEntry>): void;
}

const EXTRACTED = /(^|\/)compiled-extracted[^/]*\.css$/;

export function singleCompiledStylesheet(appRoot: string): MinimalPlugin {
  // @compiled/css is a transitive dependency; resolve it through the plugin
  // that owns it rather than relying on hoisting.
  const requireFromApp = createRequire(`${appRoot}/package.json`);
  const requireFromPlugin = createRequire(requireFromApp.resolve("@compiled/vite-plugin"));
  const { sort } = requireFromPlugin("@compiled/css") as {
    sort: (css: string, opts: { sortAtRulesEnabled: boolean; sortShorthandEnabled: boolean }) => string;
  };

  return {
    name: "usrp:single-compiled-stylesheet",
    apply: "build",
    // Post: Vite writes the merged sheet and index.html in its own generateBundle,
    // which runs after ordinary plugins.
    enforce: "post",
    generateBundle(_options, bundle) {
      const sheets = Object.entries(bundle).filter(
        ([name, entry]) => name.endsWith(".css") && entry.type === "asset",
      );
      const extracted = sheets.filter(([name]) => EXTRACTED.test(name));
      const main = sheets.filter(([name]) => !EXTRACTED.test(name));
      if (main.length !== 1) {
        this.error(
          `[single-compiled-stylesheet] expected exactly one CSS asset besides the extracted file, found ${main.length}. ` +
            "Set build.cssCodeSplit to false.",
        );
      }
      const [, mainAsset] = main[0]!;
      let css = String(mainAsset.source);
      for (const [name, asset] of extracted) {
        css += `\n${String(asset.source)}`;
        delete bundle[name];
        // Vite already linked the extracted file from index.html; drop that link.
        for (const out of Object.values(bundle)) {
          if (out.type === "asset" && out.fileName.endsWith(".html")) {
            out.source = String(out.source).replace(new RegExp(`<link[^>]*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*>\\s*`), "");
          }
        }
      }
      mainAsset.source = sort(css, { sortAtRulesEnabled: true, sortShorthandEnabled: true });
    },
  };
}
