// ═══════════════════════════════════════════════════════════════
// applicant-portal — feature-slice mount table
//
// ONE slice mounts here today, and the reason the list is short is worth stating:
// most citizen-facing operations the slices describe are not served by the edge.
// The citizen half of Law N 058/2021 (erasure, self-withdrawal) IS reachable, so
// that is what mounts.
// ═══════════════════════════════════════════════════════════════

import type { RouteObject } from "react-router-dom";
import { ComplianceCitizenRoutes } from "@usrp/feature-compliance";

interface SliceMount {
  readonly slice: string;
  readonly routes: readonly RouteObject[];
}

/**
 * Paths this app owns outside the slices.
 *
 * `IdentityCitizenRoutes` claims `sign-in`, which does not collide with `login`
 * — but it would be a SECOND citizen sign-in surface, and the one at `login` was
 * rebuilt on the real credential pair (National ID + a six-digit OTP against a
 * five-minute scrypt-digested challenge) because no citizen password exists
 * anywhere in the platform. Two sign-in screens is one too many places for that
 * correction to be forgotten, so the slice route stays unmounted.
 */
const APP_OWNED_PATHS: readonly string[] = [
  "home",
  "apply",
  "apply/:step",
  "status",
  "applications",
];

const MOUNTS: readonly SliceMount[] = [
  { slice: "@usrp/feature-compliance", routes: ComplianceCitizenRoutes },
];

/** See the officer-console twin for why this is a runtime assertion. */
export function assertUniqueRoutePaths(mounts: readonly SliceMount[] = MOUNTS): void {
  const owner = new Map<string, string>();
  const problems: string[] = [];

  for (const appPath of APP_OWNED_PATHS) owner.set(appPath, "apps/applicant-portal");

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
      `applicant-portal route collision:\n  ${problems.join("\n  ")}\n` +
        `Two routes at one path resolve to whichever React Router ranks first, silently. ` +
        `Rename the slice path or remove the duplicate mount.`,
    );
  }
}

assertUniqueRoutePaths();

export const CITIZEN_SLICE_ROUTES: readonly RouteObject[] = MOUNTS.flatMap((mount) => [...mount.routes]);

export const CITIZEN_SLICE_NAMESPACES: readonly string[] = ["compliance"];
