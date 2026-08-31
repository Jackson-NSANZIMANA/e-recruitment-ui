import React from 'react';
import { Navigate } from 'react-router-dom';
import type { Agency } from '@usrp/contracts';
import { useAuth } from './context.js';

// ══════════════════════════════════════════════════════════════════
// @usrp/auth — route guards
//
// READ THIS BEFORE CHANGING ANYTHING HERE:
//
// THESE GUARDS ARE NOT SECURITY. They are routing and presentation. Every one of
// them can be defeated by a user with developer tools in about four seconds, and
// that is FINE, because they defend nothing.
//
// Agency isolation is enforced by PostgreSQL row-level security: FORCE'd RLS,
// per-agency NOLOGIN group roles, and no bypass principal anywhere in the
// platform. An officer whose browser is tricked into rendering another agency's
// screen sees an empty list, because the database returns no rows. The edge also
// asserts the agency and returns 403 — also not the control, just a clearer
// error than a blank page.
//
// The previous version of this file said "Relies on the BFF — the JWT agency is
// authoritative", which reads as though the guard participates in enforcement.
// It does not, and describing a presentational component as a security boundary
// is how a real control gets removed later by someone who thinks it is redundant.
// ══════════════════════════════════════════════════════════════════

interface RouteGuardProps {
  /** Rendered while the session probe is in flight. */
  readonly fallback?: React.ReactNode;
  readonly redirectTo?: string;
  readonly children: React.ReactNode;
}

/**
 * Gate a route tree on an authenticated session.
 *
 * `checking` renders `fallback` rather than redirecting, which is the difference
 * between a reload that works and a reload that bounces an authenticated user to
 * the login page every time.
 */
export function RouteGuard({ fallback = null, redirectTo = '/login', children }: RouteGuardProps): React.ReactElement | null {
  const { state } = useAuth();

  if (state.status === 'checking') return <>{fallback}</>;
  if (state.status === 'anonymous' || state.status === 'expired') {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}

interface OfficerGuardProps {
  readonly fallback?: React.ReactNode;
  readonly redirectTo?: string;
  readonly children: React.ReactNode;
}

/**
 * Gate a route tree on an OFFICER session specifically.
 *
 * Needed because the two credential kinds are not interchangeable: a citizen
 * session reaching an officer screen would render controls whose every request
 * fails, which looks like a broken product rather than a wrong door.
 */
export function OfficerGuard({ fallback = null, redirectTo = '/login', children }: OfficerGuardProps): React.ReactElement | null {
  const { state } = useAuth();

  if (state.status === 'checking') return <>{fallback}</>;
  if (state.status !== 'authenticated' || state.session.kind !== 'officer') {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}

interface ApplicantGuardProps {
  readonly fallback?: React.ReactNode;
  readonly redirectTo?: string;
  readonly children: React.ReactNode;
}

export function ApplicantGuard({ fallback = null, redirectTo = '/', children }: ApplicantGuardProps): React.ReactElement | null {
  const { state } = useAuth();

  if (state.status === 'checking') return <>{fallback}</>;
  if (state.status !== 'authenticated' || state.session.kind !== 'applicant') {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}

interface AgencyGuardProps {
  readonly requiredAgency: Agency;
  readonly forbidden?: React.ReactNode;
  readonly children: React.ReactNode;
}

/**
 * Render children only for an officer of `requiredAgency`.
 *
 * PRESENTATIONAL. See the file header. There is no `SUPERADMIN` escape hatch
 * here, and its absence is deliberate: the old version granted one, and no such
 * principal exists — RLS is FORCE'd and `officer_accounts` carries
 * `roles: string[]` with no cross-agency role behind it. A UI that renders a
 * cross-agency view for a role the database will not honour shows an officer an
 * empty screen and calls it permission.
 */
export function AgencyGuard({ requiredAgency, forbidden = null, children }: AgencyGuardProps): React.ReactElement {
  const { state } = useAuth();
  const agency = state.status === 'authenticated' && state.session.kind === 'officer' ? state.session.agency : null;

  if (agency !== requiredAgency) return <>{forbidden}</>;
  return <>{children}</>;
}
