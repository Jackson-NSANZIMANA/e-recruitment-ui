// ══════════════════════════════════════════════════════════════════
// Readiness-gated route mounting (ADR-FE-009)
//
// Each app passes its route table and the surface manifests through
// `mountByReadiness`. Production drops every route below SCREEN-BUILT (and
// every route no manifest declares); development keeps them behind a visible
// "not built" banner so work in progress stays reachable for the people
// building it, and only for them.
// ══════════════════════════════════════════════════════════════════

import React from "react";
import type { RouteObject } from "react-router-dom";
import SectionMessage from "@atlaskit/section-message";
import Heading from "@atlaskit/heading";
// LinkButton, not the legacy Button: it renders through AppProvider's
// routerLinkComponent, so an in-app href is a client-side navigation (no full
// reload that would drop station state or re-probe the session offline).
import LinkButton from "@atlaskit/button/link";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";
import {
  joinRoutePath,
  mountDecision,
  readinessIndex,
  type ManifestReadinessLike,
  type ManifestRouteLike,
  type ReadinessRung,
  type SurfaceApp,
} from "./model.js";

export * from "./model.js";

const styles = cssMap({
  banner: {
    paddingBlock: token("space.100"),
    paddingInline: token("space.200"),
  },
  page: {
    maxWidth: "640px",
    marginInline: "auto",
    paddingBlock: token("space.600"),
    paddingInline: token("space.400"),
  },
});

export interface NotBuiltBannerProps {
  /** The declared rung, or null when no surface manifest declares the route. */
  readonly rung: ReadinessRung | null;
  readonly surface: string | null;
}

/** The development-only marker on a route below SCREEN-BUILT. */
export function NotBuiltBanner({ rung, surface }: NotBuiltBannerProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Box xcss={styles.banner} testId="readiness-not-built">
      <SectionMessage appearance="warning" title={t("readiness.not_built_title")} headingLevel="h2">
        <Text as="p">
          {rung === null
            ? t("readiness.undeclared_body")
            : t("readiness.not_built_body", { rung, surface: surface ?? "" })}
        </Text>
      </SectionMessage>
    </Box>
  );
}

/** What a production build shows for a path it does not mount. */
export function NotFoundPage({ homePath }: { readonly homePath: string }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Box xcss={styles.page} testId="route-not-found">
      <Stack space="space.300">
        <Heading size="large" as="h1">
          {t("readiness.not_found_title")}
        </Heading>
        <Text as="p">{t("readiness.not_found_body")}</Text>
        <Box>
          <LinkButton appearance="primary" href={homePath}>
            {t("readiness.not_found_home")}
          </LinkButton>
        </Box>
      </Stack>
    </Box>
  );
}

export interface MountByReadinessOptions {
  readonly app: SurfaceApp;
  readonly surfaces: readonly {
    readonly id?: string;
    readonly routes?: readonly ManifestRouteLike[];
    readonly readiness?: ManifestReadinessLike;
  }[];
  /** `import.meta.env.PROD` in the calling app. */
  readonly production: boolean;
}

/**
 * Filter (production) or annotate (development) a route table by readiness.
 *
 * Index routes, layout routes without a path, `/` and the `*` catch-all are
 * structure, not screens: they are always kept, and a layout's children are
 * judged one by one under the layout's path.
 */
export function mountByReadiness(
  routes: readonly RouteObject[],
  options: MountByReadinessOptions,
): RouteObject[] {
  const index = readinessIndex(options.surfaces, options.app);

  const walk = (list: readonly RouteObject[], parent: string): RouteObject[] => {
    const kept: RouteObject[] = [];
    for (const route of list) {
      if (route.index === true || route.path === "*") {
        kept.push(route);
        continue;
      }
      if (route.path === undefined || route.path === "/" || route.path === "") {
        const base = route.path === undefined ? parent : "/";
        kept.push(route.children === undefined ? route : { ...route, children: walk(route.children, base) });
        continue;
      }
      const path = joinRoutePath(parent, route.path);
      const decision = mountDecision(index.get(path) ?? null, options.production);
      if (decision.kind === "omit") continue;
      const children = route.children === undefined ? undefined : walk(route.children, path);
      const withChildren: RouteObject = children === undefined ? route : { ...route, children };
      if (decision.kind === "mount") {
        kept.push(withChildren);
        continue;
      }
      kept.push({
        ...withChildren,
        element: (
          <>
            <NotBuiltBanner rung={decision.rung} surface={decision.surface} />
            {route.element}
          </>
        ),
      } as RouteObject);
    }
    return kept;
  };

  return walk(routes, "/");
}
