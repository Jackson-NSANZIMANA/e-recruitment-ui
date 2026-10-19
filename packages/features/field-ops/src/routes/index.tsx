// ══════════════════════════════════════════════════════════════════
// field-ops — the routes this slice contributes to apps/field-station
//
// A FACTORY, not a constant, because the stations call the edge and the slice
// must not reach into an app's env for the client (ADR-FE-007). The host app
// calls createFieldOpsRoutes({ client }) once and mounts the result inside its
// OfficerGuard branch. Paths are relative to that branch.
//
// Readiness is NOT decided here. The host passes the table through
// mountByReadiness (ADR-FE-009); docs/ui-surfaces/field.*.json declare each
// path's rung, so check-in and conflicts (placeholders until S08) never reach a
// production build.
// ══════════════════════════════════════════════════════════════════

import React, { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import type { ApiClient } from "@usrp/api-client";

const StationPicker = lazy(() => import("./stations.tsx"));
const GatePage = lazy(() => import("./gate.tsx"));
const WalkInPage = lazy(() => import("./walk-in.tsx"));
const CheckIn = lazy(() => import("./check-in.tsx"));
const Conflicts = lazy(() => import("./conflicts.tsx"));

export interface FieldOpsRouteOptions {
  readonly client: ApiClient;
}

/** The field-station route table. Every path here has a surface manifest. */
export function createFieldOpsRoutes({ client }: FieldOpsRouteOptions): readonly RouteObject[] {
  return [
    { path: "stations", element: <StationPicker /> },
    { path: "gate", element: <GatePage client={client} /> },
    { path: "walk-in", element: <WalkInPage client={client} /> },
    { path: "check-in", element: <CheckIn /> },
    { path: "conflicts", element: <Conflicts /> },
  ];
}
