// ═══════════════════════════════════════════════════════════════
// officer-console — feature-slice mount table
//
// The slices own their own paths (ADR-FE-001); this file composes them and
// refuses a collision. Nothing here decides authorization: agency isolation is
// FORCE'd PostgreSQL row-level security, and these guards are routing only.
// ═══════════════════════════════════════════════════════════════

import type { RouteObject } from "react-router-dom";
import { AdjudicationRoutes } from "@usrp/feature-adjudication";
import { ComplianceOfficerRoutes } from "@usrp/feature-compliance";
import { FieldOpsRoutes } from "@usrp/feature-field-ops";
import { SchedulingRoutes } from "@usrp/feature-scheduling";

/** A slice's contribution, labelled so a collision names its owner. */
interface SliceMount {
  readonly slice: string;
  readonly routes: readonly RouteObject[];
}

/**
 * Paths this app owns OUTSIDE the slices, declared so a slice cannot quietly
 * shadow one.
 *
 * This is the list that made `ApplicationsRoutes` and `IdentityOfficerRoutes`
 * unmountable today: both collide with a real, working screen. React Router
 * ranks two identical paths and picks one WITHOUT WARNING, so the failure mode is
 * an officer losing the queue they work all day while every check stays green.
 */
const APP_OWNED_PATHS: readonly string[] = [
  "dashboard",
  "applications",
  "applications/:id",
  "walk-in",
];

const MOUNTS: readonly SliceMount[] = [
  { slice: "@usrp/feature-adjudication", routes: AdjudicationRoutes },
  { slice: "@usrp/feature-compliance", routes: ComplianceOfficerRoutes },
  { slice: "@usrp/feature-field-ops", routes: FieldOpsRoutes },
  { slice: "@usrp/feature-scheduling", routes: SchedulingRoutes },
];

/**
 * Throw if any two mounted paths are the same, or if a slice shadows an
 * app-owned path.
 *
 * A RUNTIME assertion, not a lint rule, on purpose: these route tables are
 * VALUES composed from four packages, and a static scan of four barrels is the
 * same hand-maintained list this repository has already been bitten by — the
 * Turbo env allowlist and the pnpm workspace glob were both exactly this shape.
 * An assertion over the real composed value cannot drift from it.
 */
export function assertUniqueRoutePaths(mounts: readonly SliceMount[] = MOUNTS): void {
  const owner = new Map<string, string>();
  const problems: string[] = [];

  for (const appPath of APP_OWNED_PATHS) owner.set(appPath, "apps/officer-console");

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
      `officer-console route collision:\n  ${problems.join("\n  ")}\n` +
        `Two routes at one path resolve to whichever React Router ranks first, silently. ` +
        `Rename the slice path or remove the duplicate mount.`,
    );
  }
}

assertUniqueRoutePaths();

/**
 * Every officer slice route, flattened.
 *
 * Mounted INSIDE the app's authenticated branch, so RouteGuard has already run;
 * OfficerGuard in app.tsx additionally refuses a citizen session, because a
 * citizen reaching an officer screen would render controls whose every request
 * 401s — which looks like a broken product rather than a wrong door.
 */
export const OFFICER_SLICE_ROUTES: readonly RouteObject[] = MOUNTS.flatMap((mount) => [...mount.routes]);

/** Namespaces the mounted slices resolve keys against. Registered in main.tsx. */
export const OFFICER_SLICE_NAMESPACES: readonly string[] = [
  "adjudication",
  "compliance",
  "field_ops",
  "scheduling",
];
