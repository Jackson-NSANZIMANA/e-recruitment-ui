import type { Agency, OfficerRole } from "@usrp/shared-types";

/**
 * Decoded payload of a USRP JWT.  The raw token is kept in an httpOnly cookie;
 * the frontend never reads the signature bytes — only the /auth/me endpoint
 * parses + validates the JWT and returns this shape.
 */
export interface AuthToken {
  /** USRP-internal user ID (not the NID). */
  readonly sub: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: OfficerRole;
  /** Present only on officer JWTs; absent for superadmin. */
  readonly agency?: Agency;
  /** Unix epoch seconds. */
  readonly exp: number;
  readonly iat: number;
}

/** Public-facing auth state that components consume via useAuth(). */
export interface AuthUser {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: OfficerRole;
  readonly agency: Agency | null;
}

export type AuthState =
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "authenticated"; readonly user: AuthUser };
