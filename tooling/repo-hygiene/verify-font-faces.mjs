#!/usr/bin/env node
/**
 * PROOF: every @font-face the design system declares reaches every app's production CSS intact.
 *
 * Not "the woff2 files exist" and not "they return 200": @compiled/css 3.1.0's merge-duplicate-at-rules
 * (run by @compiled/vite-plugin on every CSS asset holding an atomic class) merged the four faces of
 * packages/design-system/src/fonts/fonts.css into ONE rule. Every font file was still emitted and
 * served, and the browser registered a single face, "Atlassian Mono" italic, so the whole UI fell back
 * to a system font. patches/@compiled__css@3.1.0.patch fixes the merger; this gate keeps it fixed
 * through every Compiled upgrade.
 *
 * For each app: each source face appears exactly once as its own @font-face (same family, style and
 * weight), no built @font-face repeats a descriptor, and its src is the matching emitted woff2.
 * Zero dependencies. Requires `pnpm build` first.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fontFaceFindings, parseFontFaces, reachableAssets } from './lib/build-integrity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const root = resolve(HERE, '..', '..');
const config = JSON.parse(readFileSync(join(HERE, 'gates.config.json'), 'utf8'));
const apps = config.compiledExtraction?.apps ?? [];
const distDir = config.compiledExtraction?.distDir ?? 'dist';
const sourcePath = join(root, 'packages/design-system/src/fonts/fonts.css');
const source = readFileSync(sourcePath, 'utf8');

let failed = false;
console.log(`source: ${relative(root, sourcePath)} declares ${parseFontFaces(source).length} face(s)`);
for (const app of apps) {
  const dist = join(root, app, distDir);
  console.log('\n  ' + app);
  if (!existsSync(dist)) {
    console.error(`    FAIL no build output at ${relative(root, dist)} - run \`pnpm build\`.`);
    failed = true;
    continue;
  }
  // Judge what the app loads (index.html and everything it reaches), not every file in dist/: a cache
  // restore leaves other builds' files behind, and those must neither fail nor pass this gate.
  const read = (p) => (existsSync(join(dist, p)) ? readFileSync(join(dist, p), 'utf8') : null);
  const files = reachableAssets(read('index.html') ?? '', read);
  const css = files.filter((f) => f.endsWith('.css')).map((f) => read(f)).join('\n');
  const findings = fontFaceFindings(source, css, files);
  if (findings.length > 0) {
    failed = true;
    for (const f of findings) console.error('    FAIL ' + f);
  } else {
    console.log(`    PASS ${parseFontFaces(css).length} @font-face rule(s), each face once, each src emitted`);
  }
}
console.log('');
if (failed) {
  console.error('[font-faces] FAIL - the production CSS does not carry the design-system faces intact.');
  process.exit(1);
}
console.log('[font-faces] PASS - every design-system face survives the production build.');
