// ═══════════════════════════════════════════════════════════════
// identity — transport
//
// This file used to declare its own `SliceTransport` interface with
// `call<T>(operationId: string)` and NO implementation anywhere in the slice.
// `string` accepts every id in the language, which is why three of this slice's
// four operation names were UPSTREAM ids the edge does not answer to:
//
//   requestApplicantOtp  →  requestOtp        (edge renames it)
//   verifyApplicantOtp   →  verifyOtp
//   logoutApplicant      →  applicantLogout
//
// Now: the real ApiClient, and a list the compiler checks.
// ═══════════════════════════════════════════════════════════════

import type { ApiClient, CallOptions, EdgeOperationId } from '@usrp/api-client';

export type { ApiClient, CallOptions };

/**
 * Edge operations in this slice's domain.
 *
 * `satisfies readonly EdgeOperationId[]` is the gate. Adding an id the edge does
 * not serve fails `pnpm typecheck`.
 *
 * NOTE these are listed for provenance, not for calling: @usrp/auth owns every
 * one of them (ADR-016 officer JWT, ADR-018 opaque citizen session) and is the
 * only place they should be invoked. A second implementation of authentication
 * is a second place for a credential bug.
 */
export const IDENTITY_OPERATIONS = [
  'officerLogin',
  'officerLogout',
  'requestOtp',
  'verifyOtp',
  'applicantLogout',
  'readSession',
  'refreshSession',
] as const satisfies readonly EdgeOperationId[];

export type IdentityOperation = (typeof IDENTITY_OPERATIONS)[number];

/**
 * Real, but NOT reachable from a citizen surface.
 *
 * `POST /v1/identities/verify` is service-internal; the edge brokers it for an
 * OFFICER at a walk-in desk only (ADR-012 D1). It returns `{ status,
 * applicantId }` — no name, no date of birth, no gender.
 *
 * A NID-existence check on an unauthenticated citizen surface is a bulk identity
 * enumeration channel at national scale, and the people being enumerated are
 * applicants to the security services. ADR-021 section 2.7 item 4 refuses it.
 * The uniform 202 on OTP request exists so it cannot be built.
 */
export const OFFICER_BROKERED_OPERATIONS = ['verifyIdentity'] as const satisfies readonly EdgeOperationId[];
