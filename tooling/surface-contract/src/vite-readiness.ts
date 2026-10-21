// ══════════════════════════════════════════════════════════════════
// Readiness at build time (ADR-FE-009), the second of two locks.
//
// Lock 1 (runtime): each app passes its route table through mountByReadiness,
// so a production build does not MOUNT a route below SCREEN-BUILT.
//
// Lock 2 (this plugin): a production build does not SHIP the placeholder's
// code either. A route that is not mounted still has its lazy chunk emitted,
// because Rollup cannot know a runtime filter will drop it; this plugin
// replaces the source module of every below-floor route of THIS app with an
// empty component during `vite build`, so the screen is absent from dist/.
//
// Dependency-free (node:fs), and it reads the same manifests surface:verify
// proves. A source that also backs a route at or above the floor in this app
// is never stubbed.
// ══════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const LADDER = ['DECLARED', 'EDGE-AVAILABLE', 'CLIENT-WIRED', 'SCREEN-BUILT', 'E2E-PROVEN', 'LOAD-PROVEN', 'OPERATIONALLY-READY'];
const FLOOR = LADDER.indexOf('SCREEN-BUILT');

interface ManifestShape {
  readonly id?: string;
  readonly routes?: readonly { readonly app?: string; readonly source?: string }[];
  readonly readiness?: { readonly rung?: string };
}

/** Repo-relative route sources this app must not ship in a production build. */
export function unbuiltSources(repoRoot: string, app: string): ReadonlySet<string> {
  const dir = join(repoRoot, 'docs/ui-surfaces');
  const below = new Set<string>();
  const built = new Set<string>();
  if (!existsSync(dir)) return below;
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const manifest = JSON.parse(readFileSync(join(dir, name), 'utf8')) as ManifestShape;
    const rung = LADDER.indexOf(manifest.readiness?.rung ?? '');
    for (const route of manifest.routes ?? []) {
      if (route.app !== app || route.source === undefined) continue;
      (rung >= FLOOR ? built : below).add(route.source);
    }
  }
  for (const source of built) below.delete(source);
  return below;
}

interface MinimalPlugin {
  readonly name: string;
  readonly enforce: 'pre';
  readonly apply: 'build';
  transform(code: string, id: string): { code: string; map: null } | null;
}

export function readinessStubPlugin(options: { readonly app: string; readonly repoRoot: string }): MinimalPlugin {
  const root = resolve(options.repoRoot);
  const stubbed = unbuiltSources(root, options.app);
  return {
    name: 'usrp-readiness-stub',
    enforce: 'pre',
    apply: 'build',
    transform(_code: string, id: string) {
      const file = id.split('?')[0] ?? id;
      const rel = relative(root, file).split(sep).join('/');
      if (!stubbed.has(rel)) return null;
      return {
        code:
          `// ${rel}: below SCREEN-BUILT for ${options.app} (ADR-FE-009); not shipped in production.\n` +
          'export default function NotShipped() { return null; }\n',
        map: null,
      };
    },
  };
}
