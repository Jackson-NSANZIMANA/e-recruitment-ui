// ══════════════════════════════════════════════════════════════════
// edge-dev — the edge session store
//
// THE ONE IDEA THIS FILE EXISTS TO IMPLEMENT: the browser holds an opaque
// HANDLE and nothing else. The upstream credential — an officer's Ed25519
// bearer JWT or a citizen's opaque identity-service session token — is stored
// HERE, server-side, and never crosses to the client in any form.
//
// Two TTLs, because one is a bug (mirrors `loadEdgeSessionConfig`):
//   idle     sliding, refreshed on activity. 1800s = the 30 min of ADR-018.
//   absolute a hard ceiling no activity extends. Without it a sliding TTL is
//            an immortal session: a thief's own traffic keeps it alive forever.
//
// The handle is stored KEYED-HASHED (HMAC-SHA-256), never verbatim. A dump of
// this table is then not a set of replayable sessions, because the key lives
// in the process and not the row. The same posture the backend applies to
// NATIONAL_ID_HMAC_KEY — and, pointedly, the posture ADR-018's follow-on #2
// says identity-service does NOT yet apply to its own session tokens.
// ══════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The two backend credential kinds, discriminated. They are NOT
 * interchangeable and this union is what makes mixing them a type error at the
 * only place both exist.
 */
export type UpstreamCredential =
  | {
      readonly kind: 'officer';
      /** Ed25519 bearer JWT from iam-service. Non-revocable until expiry, by design. */
      readonly token: string;
      readonly expiresAt: string;
      readonly agency: string;
      readonly roles: readonly string[];
      readonly subject: string;
    }
  | {
      readonly kind: 'applicant';
      /** Opaque 32-byte revocable DB session token from identity-service. */
      readonly token: string;
      readonly expiresAt: string;
    };

export type SessionKind = UpstreamCredential['kind'];

export interface EdgeSession {
  readonly handleHash: string;
  readonly credential: UpstreamCredential;
  readonly createdAtMs: number;
  /** Sliding. Advanced on every authenticated request. */
  lastSeenAtMs: number;
  /** Fixed at creation. Never advanced. */
  readonly absoluteExpiresAtMs: number;
  readonly csrfToken: string;
}

export interface EdgeSessionConfig {
  readonly handleHmacKey: string;
  readonly idleTtlSeconds: number;
  readonly absoluteTtlSeconds: number;
}

/** Why a lookup failed. The route layer maps every one of these to ONE 401. */
export type SessionRejection = 'NO_HANDLE' | 'UNKNOWN' | 'IDLE_EXPIRED' | 'ABSOLUTE_EXPIRED' | 'REVOKED';

export type SessionLookup =
  | { readonly ok: true; readonly session: EdgeSession }
  | { readonly ok: false; readonly reason: SessionRejection };

/** The public view of a session. Note what is ABSENT: the upstream token. */
export interface SessionView {
  readonly kind: SessionKind;
  readonly agency: string | null;
  readonly roles: readonly string[];
  /** When inactivity will end it. Advances as the citizen keeps working. */
  readonly idleExpiresAt: string;
  /** The ceiling. Does not move, so the UI can tell the truth about re-login. */
  readonly absoluteExpiresAt: string;
}

export class EdgeSessionStore {
  private readonly sessions = new Map<string, EdgeSession>();
  private readonly config: EdgeSessionConfig;

  constructor(config: EdgeSessionConfig) {
    if (config.handleHmacKey.length < 32) {
      throw new Error('EDGE_SESSION_HMAC_KEY must be at least 32 characters.');
    }
    if (config.absoluteTtlSeconds < config.idleTtlSeconds) {
      throw new Error(
        'EDGE_SESSION_ABSOLUTE_TTL_SECONDS must be >= EDGE_SESSION_IDLE_TTL_SECONDS ' +
          '(an absolute ceiling below the sliding window expires active sessions).',
      );
    }
    this.config = config;
  }

  private hash(handle: string): string {
    return createHmac('sha256', this.config.handleHmacKey).update(handle).digest('hex');
  }

  /**
   * Mint a session. Returns the handle ONCE — it is never recoverable from the
   * store, only comparable against it.
   */
  create(credential: UpstreamCredential, nowMs: number = Date.now()): { handle: string; csrfToken: string } {
    const handle = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const handleHash = this.hash(handle);
    this.sessions.set(handleHash, {
      handleHash,
      credential,
      createdAtMs: nowMs,
      lastSeenAtMs: nowMs,
      absoluteExpiresAtMs: nowMs + this.config.absoluteTtlSeconds * 1000,
      csrfToken,
    });
    return { handle, csrfToken };
  }

  /**
   * Resolve a handle and SLIDE the idle window.
   *
   * Order matters: the absolute ceiling is checked before the slide, so a
   * request arriving at the ceiling cannot extend past it.
   */
  touch(handle: string | undefined, nowMs: number = Date.now()): SessionLookup {
    if (handle === undefined || handle.length === 0) return { ok: false, reason: 'NO_HANDLE' };
    const session = this.sessions.get(this.hash(handle));
    if (session === undefined) return { ok: false, reason: 'UNKNOWN' };
    if (nowMs >= session.absoluteExpiresAtMs) {
      this.sessions.delete(session.handleHash);
      return { ok: false, reason: 'ABSOLUTE_EXPIRED' };
    }
    if (nowMs - session.lastSeenAtMs >= this.config.idleTtlSeconds * 1000) {
      this.sessions.delete(session.handleHash);
      return { ok: false, reason: 'IDLE_EXPIRED' };
    }
    session.lastSeenAtMs = nowMs;
    return { ok: true, session };
  }

  /** Read WITHOUT sliding — for diagnostics that must not extend a session. */
  peek(handle: string | undefined): EdgeSession | undefined {
    if (handle === undefined || handle.length === 0) return undefined;
    return this.sessions.get(this.hash(handle));
  }

  /** Immediate revocation. This is the property ADR-018 bought and the SPA lost. */
  revoke(handle: string | undefined): boolean {
    if (handle === undefined || handle.length === 0) return false;
    return this.sessions.delete(this.hash(handle));
  }

  size(): number {
    return this.sessions.size;
  }

  /** Constant-time CSRF comparison. A length mismatch alone is a rejection. */
  csrfMatches(session: EdgeSession, presented: string | undefined): boolean {
    if (presented === undefined) return false;
    const expected = Buffer.from(session.csrfToken, 'utf8');
    const actual = Buffer.from(presented, 'utf8');
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }

  /**
   * What the browser may know about its own session.
   *
   * The upstream token is structurally unreachable from here: this function
   * cannot return it, so no route can accidentally serialize it.
   */
  view(session: EdgeSession): SessionView {
    const idleExpiresAtMs = session.lastSeenAtMs + this.config.idleTtlSeconds * 1000;
    return {
      kind: session.credential.kind,
      agency: session.credential.kind === 'officer' ? session.credential.agency : null,
      roles: session.credential.kind === 'officer' ? session.credential.roles : [],
      idleExpiresAt: new Date(Math.min(idleExpiresAtMs, session.absoluteExpiresAtMs)).toISOString(),
      absoluteExpiresAt: new Date(session.absoluteExpiresAtMs).toISOString(),
    };
  }
}
