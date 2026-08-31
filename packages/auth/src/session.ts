// ══════════════════════════════════════════════════════════════════
// @usrp/auth — the session model
//
// THE CENTRAL FACT: there are TWO human credential kinds in this platform and
// they are not interchangeable (ADR-016, ADR-018).
//
//   OFFICER   an Ed25519 bearer JWT from iam-service. Stateless, verified by
//             every service with the public key alone, and NON-REVOCABLE until
//             expiry by design.
//   APPLICANT an opaque 32-byte crypto-random DB session token from
//             identity-service, with a 30-minute sliding TTL, revocable at the
//             next request.
//
// Neither is a cookie today, and NEITHER EVER REACHES THIS PACKAGE. What the
// browser holds is an edge session handle in an httpOnly cookie that no
// JavaScript here can read. That is not a limitation to work around — it is the
// entire security property. ADR-018 chose a revocable token precisely so a
// stolen session could be killed, and revocability is worth nothing if the
// token lives somewhere script can read it.
//
// So this file models the SESSION VIEW, not the credential. The discriminated
// union below exists to make one specific bug impossible at compile time:
// passing an applicant session where an officer credential is required. That
// mistake is one keystroke in a dynamic model and a build failure here.
// ══════════════════════════════════════════════════════════════════

import type { Agency } from '@usrp/contracts';

/**
 * A nominal brand. Two `string`s are interchangeable; an `OfficerAgency` and a
 * bare `string` are not, so a function that needs a verified officer agency
 * cannot be handed a value read off a form.
 */
declare const brand: unique symbol;
type Branded<T, B extends string> = T & { readonly [brand]: B };

/** An agency scope that came from a verified officer session, not from the UI. */
export type OfficerAgency = Branded<Agency, 'OfficerAgency'>;

/**
 * The officer session as the browser may know it.
 *
 * Note the absence of `token`. There is no field for it, so no component can
 * read one, log one, or put one in a request — the type system removes the
 * option rather than the code review catching it.
 */
export interface OfficerSession {
  readonly kind: 'officer';
  /** The agency this console serves and this officer belongs to. */
  readonly agency: OfficerAgency;
  readonly roles: readonly string[];
  /** When inactivity ends the session. Advances as the officer works. */
  readonly idleExpiresAt: string;
  /** The hard ceiling. Does NOT advance, so the UI can tell the truth. */
  readonly absoluteExpiresAt: string;
}

/**
 * The citizen session as the browser may know it.
 *
 * No agency: a citizen is cross-agency by construction (ADR-014's accept lock
 * spans all three, and `me/applications` unions all three ops schemas). A UI
 * that asks a citizen to "choose your agency portal" is modelling the officer's
 * world, not theirs.
 */
export interface ApplicantSession {
  readonly kind: 'applicant';
  readonly idleExpiresAt: string;
  readonly absoluteExpiresAt: string;
}

export type Session = OfficerSession | ApplicantSession;
export type SessionKind = Session['kind'];

/**
 * Auth state. `checking` is distinct from `anonymous` because conflating them is
 * how a UI flashes a login screen at an authenticated user on every reload.
 */
export type AuthState =
  | { readonly status: 'checking' }
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated'; readonly session: Session }
  /**
   * The session ended and we know WHICH way. `idle` deserves "you were away too
   * long"; `absolute` deserves "sessions end after 12 hours, please sign in
   * again". Telling a user the wrong one makes the product look broken.
   */
  | { readonly status: 'expired'; readonly reason: SessionExpiryReason };

export type SessionExpiryReason = 'idle' | 'absolute' | 'revoked';

export function isOfficerSession(session: Session): session is OfficerSession {
  return session.kind === 'officer';
}

export function isApplicantSession(session: Session): session is ApplicantSession {
  return session.kind === 'applicant';
}

/**
 * Narrow to an officer session or throw.
 *
 * The throw is the point. Every officer-only operation takes an
 * `OfficerSession`, so the ONLY way an applicant session can reach one is
 * through this function, which fails loudly at the boundary instead of silently
 * issuing a request that upstream will refuse with a confusing 403.
 */
export function requireOfficerSession(session: Session): OfficerSession {
  if (session.kind !== 'officer') {
    throw new SessionKindError('officer', session.kind);
  }
  return session;
}

export function requireApplicantSession(session: Session): ApplicantSession {
  if (session.kind !== 'applicant') {
    throw new SessionKindError('applicant', session.kind);
  }
  return session;
}

export class SessionKindError extends Error {
  readonly expected: SessionKind;
  readonly actual: SessionKind;

  constructor(expected: SessionKind, actual: SessionKind) {
    super(
      `This operation requires a ${expected} session but the current session is ${actual}. ` +
        'Officer bearer tokens and citizen opaque sessions are not interchangeable (ADR-016, ADR-018).',
    );
    this.name = 'SessionKindError';
    this.expected = expected;
    this.actual = actual;
  }
}

/** Parse the edge's `GET /edge/v1/session` body. Unknown shapes yield null. */
export function parseSessionResponse(value: unknown): Session | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const idleExpiresAt = record['idleExpiresAt'];
  const absoluteExpiresAt = record['absoluteExpiresAt'];
  if (typeof idleExpiresAt !== 'string' || typeof absoluteExpiresAt !== 'string') return null;

  if (record['kind'] === 'officer') {
    const agency = record['agency'];
    if (agency !== 'RDF' && agency !== 'RNP' && agency !== 'RCS') return null;
    const roles = Array.isArray(record['roles'])
      ? record['roles'].filter((role): role is string => typeof role === 'string')
      : [];
    return { kind: 'officer', agency: agency as OfficerAgency, roles, idleExpiresAt, absoluteExpiresAt };
  }
  if (record['kind'] === 'applicant') {
    return { kind: 'applicant', idleExpiresAt, absoluteExpiresAt };
  }
  return null;
}

/** Milliseconds until the idle window closes. Negative means already closed. */
export function millisUntilIdleExpiry(session: Session, nowMs: number = Date.now()): number {
  return Date.parse(session.idleExpiresAt) - nowMs;
}

export function millisUntilAbsoluteExpiry(session: Session, nowMs: number = Date.now()): number {
  return Date.parse(session.absoluteExpiresAt) - nowMs;
}
