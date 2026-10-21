// ══════════════════════════════════════════════════════════════════
// field-station — readiness-gated mounting (ADR-FE-009)
//
// The surface manifests in docs/ui-surfaces/*.json are read AT BUILD TIME:
// only their `id`, `routes` and `readiness` fields are imported, so no
// other manifest content reaches the bundle. `pnpm surface:verify` proves the
// evidence behind every declared rung; this file only applies the rung.
//
// Production mounts SCREEN-BUILT and above, and nothing a manifest does not
// declare. Development mounts everything below the floor behind a visible
// "not built" banner (owner decision, S02).
// ══════════════════════════════════════════════════════════════════

import type { RouteObject } from "react-router-dom";
import { mountByReadiness } from "@usrp/ui";

interface ManifestRoute {
  readonly path: string;
  readonly app: string;
}

const ids = import.meta.glob<string>("../../../../docs/ui-surfaces/*.json", { eager: true, import: "id" });
const routes = import.meta.glob<readonly ManifestRoute[]>("../../../../docs/ui-surfaces/*.json", { eager: true, import: "routes" });
const readiness = import.meta.glob<{ readonly rung: string }>("../../../../docs/ui-surfaces/*.json", { eager: true, import: "readiness" });

export const SURFACES = Object.keys(routes).map((file) => ({
  id: ids[file] ?? file,
  routes: routes[file] ?? [],
  ...(readiness[file] === undefined ? {} : { readiness: readiness[file] }),
}));

if (SURFACES.length === 0) {
  // Fail loudly: an empty glob would silently unmount every route in production.
  throw new Error("No surface manifests matched docs/ui-surfaces/*.json; the readiness gate cannot run.");
}

/** Apply the readiness ladder to this app's route table. */
export function gateByReadiness(table: readonly RouteObject[]): RouteObject[] {
  return mountByReadiness(table, { app: "field-station", surfaces: SURFACES, production: import.meta.env.PROD });
}
