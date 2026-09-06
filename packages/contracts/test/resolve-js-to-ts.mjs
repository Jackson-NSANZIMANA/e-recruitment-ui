// Resolve hook: map a relative `./x.js` specifier onto `./x.ts` when only the
// TypeScript file exists.
//
// WHY THIS IS NEEDED AND WHY IT IS NOT A HACK. src/** is compiled by tsc for a
// bundler, where the emitted specifier must be `.js`. Node's
// --experimental-strip-types does NO extension remapping, so those same files
// cannot be executed directly. Rather than weaken the shipped surface to suit
// the test runner, the test runner adapts: this hook is loaded only by
// `pnpm test`, it never ships, and it changes nothing about what tsc sees.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && specifier.endsWith('.js')) {
    const candidate = `${specifier.slice(0, -3)}.ts`;
    try {
      const resolved = await nextResolve(candidate, context);
      if (existsSync(fileURLToPath(resolved.url))) return resolved;
    } catch {
      // fall through to the real specifier and let node report it
    }
  }
  return nextResolve(specifier, context);
}
