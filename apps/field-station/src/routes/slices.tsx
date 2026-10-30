// ═══════════════════════════════════════════════════════════════
// field-station — feature-slice mount table (ADR-FE-007)
//
// This app composes ONLY identity, scheduling, field-ops and the applications
// model; tooling/repo-hygiene/check-boundaries.mjs fails the build on any other
// slice. Nothing here decides authorization: the edge and the owning service
// refuse an unpermitted write, and these guards are routing only.
//
// HOW TO MOUNT A SLICE ROUTE HERE (hand-off for S08 and B2):
//   1. Export the route from the slice (a factory if it calls the edge, so the
//      client is injected rather than read from this app's env).
//   2. Add it to MOUNTS below. assertUniqueRoutePaths() refuses a collision.
//   3. Declare its path in a docs/ui-surfaces/field.*.json manifest with
//      `"app": "field-station"` and a readiness rung. Without a manifest a
//      route is not mounted in production (ADR-FE-009, fail closed).
//   4. Register the slice's locale namespace in FIELD_SLICE_NAMESPACES.
// ═══════════════════════════════════════════════════════════════

import type { RouteObject } from "react-router-dom";
import { createApiClient } from "@usrp/api-client";
import { createFieldOpsRoutes } from "@usrp/feature-field-ops";
import { EDGE_BASE_URL, SLOT_TRUST_ANCHOR_B64 } from "../env.js";

interface SliceMount {
  readonly slice: string;
  readonly routes: readonly RouteObject[];
}

/** The one edge client every station shares. */
export const fieldClient = createApiClient({ baseUrl: EDGE_BASE_URL });

/** Paths this app owns outside the slices, declared so a slice cannot shadow one. */
const APP_OWNED_PATHS: readonly string[] = ["login"];

const MOUNTS: readonly SliceMount[] = [
  { slice: "@usrp/feature-field-ops", routes: createFieldOpsRoutes({ client: fieldClient, ...(SLOT_TRUST_ANCHOR_B64 === undefined ? {} : { defaultTrustAnchor: SLOT_TRUST_ANCHOR_B64 }) }) },
];

/** See the officer-console twin for why this is a runtime assertion. */
export function assertUniqueRoutePaths(mounts: readonly SliceMount[] = MOUNTS): void {
  const owner = new Map<string, string>();
  const problems: string[] = [];

  for (const appPath of APP_OWNED_PATHS) owner.set(appPath, "apps/field-station");

  for (const mount of mounts) {
    for (const route of mount.routes) {
      const path = route.path;
      if (path === undefined) continue;
      const existing = owner.get(path);
      if (existing !== undefined) {
        problems.push(`"${path}" is claimed by both ${existing} and ${mount.slice}`);
        continue;
      }
      owner.set(path, mount.slice);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `field-station route collision:\n  ${problems.join("\n  ")}\n` +
        `Two routes at one path resolve to whichever React Router ranks first, silently. ` +
        `Rename the slice path or remove the duplicate mount.`,
    );
  }
}

assertUniqueRoutePaths();

/** Every field-station slice route, flattened, before the readiness gate. */
export const FIELD_SLICE_ROUTES: readonly RouteObject[] = MOUNTS.flatMap((mount) => [...mount.routes]);

/** Namespaces the mounted slices resolve keys against. Registered in main.tsx. */
export const FIELD_SLICE_NAMESPACES: readonly string[] = ["field_ops"];
