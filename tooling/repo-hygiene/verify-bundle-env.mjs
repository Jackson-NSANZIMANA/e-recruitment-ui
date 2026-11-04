#!/usr/bin/env node
/**
 * PROOF: no app bundle carries Vite's whole `import.meta.env` object.
 *
 * Vite replaces a literal `import.meta.env.VITE_X` with its value. A computed or optional access
 * (`env[key]`, `env?.["VITE_X"]`) makes it inline the object itself, and with it EVERY VITE_* variable
 * the build saw: the officer console's and field station's settings shipped inside the applicant
 * portal, and so would any VITE_* variable exported in a developer's shell. Read env values as
 * literal members; this gate fails the build output that does not.
 * Zero dependencies. Requires `pnpm build` first.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inlinedEnvKeys, reachableAssets } from './lib/build-integrity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const root = resolve(HERE, '..', '..');
const config = JSON.parse(readFileSync(join(HERE, 'gates.config.json'), 'utf8'));
const apps = config.compiledExtraction?.apps ?? [];
const distDir = config.compiledExtraction?.distDir ?? 'dist';

let failed = false;
for (const app of apps) {
  const dist = join(root, app, distDir);
  console.log('\n  ' + app);
  if (!existsSync(dist)) {
    console.error(`    FAIL no build output at ${relative(root, dist)} - run \`pnpm build\`.`);
    failed = true;
    continue;
  }
  const leaks = [];
  // The scripts the app loads (index.html and everything they reach), not orphans of another build.
  const read = (p) => (existsSync(join(dist, p)) ? readFileSync(join(dist, p), 'utf8') : null);
  for (const f of reachableAssets(read('index.html') ?? '', read).filter((p) => p.endsWith('.js'))) {
    const keys = inlinedEnvKeys(read(f));
    if (keys.length > 0) leaks.push(`${f}: ${keys.join(', ')}`);
  }
  if (leaks.length > 0) {
    failed = true;
    for (const l of leaks) console.error('    FAIL inlined env object in ' + l);
  } else {
    console.log('    PASS no inlined import.meta.env object');
  }
}
console.log('');
if (failed) {
  console.error('[bundle-env] FAIL - a bundle carries the whole env object; read import.meta.env.VITE_* as literal members.');
  process.exit(1);
}
console.log('[bundle-env] PASS - every env value is replaced statically.');
