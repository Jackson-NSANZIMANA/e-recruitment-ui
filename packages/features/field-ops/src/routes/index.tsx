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
import { StationGuard } from "./station-guard.tsx";
import { DeviceRuntimeProvider } from "../runtime/context.tsx";

/** The on-device runtime (identity key, ledger) opens only for the stations that sign or store. */
const WithRuntime = ({ children }: { readonly children: React.ReactNode }): React.ReactElement => <DeviceRuntimeProvider>{children}</DeviceRuntimeProvider>;

const StationPicker = lazy(() => import("./stations.tsx"));
const GatePage = lazy(() => import("./gate.tsx"));
const WalkInPage = lazy(() => import("./walk-in.tsx"));
const CheckIn = lazy(() => import("./check-in.tsx"));
const Conflicts = lazy(() => import("./conflicts.tsx"));
const SetupPage = lazy(() => import("./setup.tsx"));
const PhysicalPage = lazy(() => import("./physical.tsx"));
const MedicalPage = lazy(() => import("./medical.tsx"));
const SupervisorPage = lazy(() => import("./supervisor.tsx"));

export interface FieldOpsRouteOptions {
  readonly client: ApiClient;
  /** Build-time default trust anchor (base64 PEM) for the offline signature rung, if baked in. */
  readonly defaultTrustAnchor?: string;
}

/** The field-station route table. Every path here has a surface manifest. */
export function createFieldOpsRoutes({ client, defaultTrustAnchor }: FieldOpsRouteOptions): readonly RouteObject[] {
  return [
    { path: "stations", element: <StationPicker /> },
    { path: "gate", element: <StationGuard path="/gate"><GatePage client={client} /></StationGuard> },
    { path: "walk-in", element: <StationGuard path="/walk-in"><WalkInPage client={client} /></StationGuard> },
    { path: "check-in", element: <StationGuard path="/check-in"><CheckIn client={client} /></StationGuard> },
    { path: "setup", element: <WithRuntime><SetupPage client={client} {...(defaultTrustAnchor === undefined ? {} : { defaultTrustAnchor })} /></WithRuntime> },
    { path: "physical", element: <StationGuard path="/physical"><WithRuntime><PhysicalPage client={client} /></WithRuntime></StationGuard> },
    { path: "medical", element: <StationGuard path="/medical"><MedicalPage client={client} /></StationGuard> },
    { path: "supervisor", element: <StationGuard path="/supervisor"><WithRuntime><SupervisorPage client={client} /></WithRuntime></StationGuard> },
    { path: "conflicts", element: <StationGuard path="/conflicts"><WithRuntime><Conflicts client={client} /></WithRuntime></StationGuard> },
  ];
}
