// ══════════════════════════════════════════════════════════════════
// Readiness ladder — which routes a build may mount (ADR-FE-009)
//
// PURE and dependency-free, so it is tested with node:test and imported by
// the three apps.
//
// The surface manifests in docs/ui-surfaces/*.json are the single source of
// truth for a route's rung. `pnpm surface:verify` proves the evidence behind
// each declared rung; this module only READS the rung and decides:
//
//   production  -> mount a route only at SCREEN-BUILT or above. A route with
//                  no manifest is NOT mounted (fail closed): an undeclared
//                  screen is an unbuilt screen until someone declares it.
//   development -> mount everything, and mark every route below the floor so
//                  the screen carries a visible "not built" banner.
// ══════════════════════════════════════════════════════════════════

export const READINESS_RUNGS = [
  "DECLARED",
  "EDGE-AVAILABLE",
  "CLIENT-WIRED",
  "SCREEN-BUILT",
  "E2E-PROVEN",
  "LOAD-PROVEN",
  "OPERATIONALLY-READY",
] as const;

export type ReadinessRung = (typeof READINESS_RUNGS)[number];

/** The lowest rung a production build mounts. */
export const PRODUCTION_FLOOR: ReadinessRung = "SCREEN-BUILT";

/** The three deployable apps a manifest route can belong to. */
export type SurfaceApp = "applicant-portal" | "officer-console" | "field-station";

/** The subset of a surface manifest the apps read at build time. */
export interface ManifestRouteLike {
  readonly path: string;
  readonly app: string;
}

export interface ManifestReadinessLike {
  readonly rung: string;
}

export interface RouteReadiness {
  readonly rung: ReadinessRung;
  readonly surface: string;
}

export function isReadinessRung(value: unknown): value is ReadinessRung {
  return typeof value === "string" && (READINESS_RUNGS as readonly string[]).includes(value);
}

/** True when `rung` is at or above `floor`. */
export function rungAtLeast(rung: ReadinessRung, floor: ReadinessRung): boolean {
  return READINESS_RUNGS.indexOf(rung) >= READINESS_RUNGS.indexOf(floor);
}

/** A route path as manifests write it: leading slash, no trailing slash. */
export function normaliseRoutePath(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, "");
  if (trimmed === "") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** Join a parent path and a relative child path. */
export function joinRoutePath(parent: string, child: string): string {
  if (child.startsWith("/")) return normaliseRoutePath(child);
  const base = normaliseRoutePath(parent);
  return normaliseRoutePath(base === "/" ? `/${child}` : `${base}/${child}`);
}

/**
 * Index one app's routes by path from the manifests' `routes` and `readiness`
 * fields. A manifest whose rung is not on the ladder contributes nothing, so
 * its routes stay unmounted in production; surface:verify reports it.
 */
export function readinessIndex(
  surfaces: readonly {
    readonly id?: string;
    readonly routes?: readonly ManifestRouteLike[];
    readonly readiness?: ManifestReadinessLike;
  }[],
  app: SurfaceApp,
): ReadonlyMap<string, RouteReadiness> {
  const index = new Map<string, RouteReadiness>();
  for (const surface of surfaces) {
    const rung = surface.readiness?.rung;
    if (!isReadinessRung(rung)) continue;
    for (const route of surface.routes ?? []) {
      if (route.app !== app) continue;
      index.set(normaliseRoutePath(route.path), { rung, surface: surface.id ?? "(unnamed surface)" });
    }
  }
  return index;
}

export type MountDecision =
  | { readonly kind: "mount" }
  | { readonly kind: "mount-with-banner"; readonly rung: ReadinessRung | null; readonly surface: string | null }
  | { readonly kind: "omit" };

/**
 * The whole policy in one total function.
 *
 * `readiness` is null when no manifest declares the route.
 */
export function mountDecision(readiness: RouteReadiness | null, production: boolean): MountDecision {
  const built = readiness !== null && rungAtLeast(readiness.rung, PRODUCTION_FLOOR);
  if (built) return { kind: "mount" };
  if (production) return { kind: "omit" };
  return {
    kind: "mount-with-banner",
    rung: readiness?.rung ?? null,
    surface: readiness?.surface ?? null,
  };
}
