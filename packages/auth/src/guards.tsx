import React from "react";
import { Navigate } from "react-router-dom";
import type { Agency } from "@usrp/shared-types";
import { useAuth } from "./context.js";

// ─── Route guard ──────────────────────────────────────────────────────────────

interface RouteGuardProps {
  /** Component to render while the session is loading. */
  readonly fallback?: React.ReactNode;
  /** Where to redirect if unauthenticated — defaults to "/login". */
  readonly redirectTo?: string;
  readonly children: React.ReactNode;
}

/**
 * Wrap any route tree with this to enforce authentication.
 * While the /auth/me check is in flight it renders `fallback`; once resolved
 * it either renders children (authenticated) or hard-redirects.
 */
export function RouteGuard({
  fallback = null,
  redirectTo = "/login",
  children,
}: RouteGuardProps): React.ReactElement | null {
  const { state } = useAuth();

  if (state.status === "loading") {
    return <>{fallback}</>;
  }

  if (state.status === "unauthenticated") {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

// ─── Agency guard ─────────────────────────────────────────────────────────────

interface AgencyGuardProps {
  readonly requiredAgency: Agency;
  /** Rendered when the JWT agency claim does not match. */
  readonly forbidden?: React.ReactNode;
  readonly children: React.ReactNode;
}

/**
 * Renders children only when the authenticated user's agency claim matches
 * `requiredAgency`.  Relies on the BFF — the JWT agency is authoritative;
 * this guard is purely presentational / routing; data access is enforced by RLS.
 */
export function AgencyGuard({
  requiredAgency,
  forbidden = null,
  children,
}: AgencyGuardProps): React.ReactElement {
  const { state } = useAuth();

  if (state.status === "authenticated" && state.user.role === "SUPERADMIN") {
    return <>{children}</>;
  }

  const userAgency =
    state.status === "authenticated" ? state.user.agency : null;

  if (userAgency !== requiredAgency) {
    return <>{forbidden}</>;
  }

  return <>{children}</>;
}
