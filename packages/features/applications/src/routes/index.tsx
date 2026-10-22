// ══════════════════════════════════════════════════════════════════
// applications — the routes this slice contributes to apps/officer-console
//
// A factory, because the workspace calls the edge and the slice must not reach
// into an app's env for the client (ADR-FE-007). Paths are relative to the
// officer branch; each has a surface manifest (docs/ui-surfaces).
// ══════════════════════════════════════════════════════════════════

import React, { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import type { ApiClient } from "@usrp/api-client";

const List = lazy(() => import("./list.tsx"));
const Detail = lazy(() => import("./detail.tsx"));

export function createApplicationsRoutes({ client }: { readonly client: ApiClient }): readonly RouteObject[] {
  return [
    { path: "applications", element: <List client={client} /> },
    { path: "applications/:id", element: <Detail client={client} /> },
  ];
}
