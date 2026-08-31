// ══════════════════════════════════════════════════════════════════
// edge-dev — CSRF: two independent server-side checks, because SameSite alone
// is not a control the server performs
//
// SameSite=Strict is NECESSARY AND NOT SUFFICIENT. Three reasons, all real:
//
//   1. It is BROWSER-enforced. A caller that is not a browser does not honour
//      it. It is not an assertion the server makes about a request it received.
//   2. It says nothing about SAME-SITE attackers. For cookie purposes
//      `*.gov.rw` is ONE site, so every other Rwandan government host on that
//      registrable domain is same-site — RDF, RNP, RCS, and every unrelated
//      ministry. A stored XSS on any of them sends our cookie for us. The
//      `__Host-` prefix stops such a host WRITING our cookie; nothing stops it
//      CAUSING a request that carries it.
//   3. One method-override shim or legacy carve-out voids it silently, added by
//      someone who has never read this file.
//
// So the edge asserts two things itself, server-side, on every unsafe request:
//
//   ORIGIN PINNING — `Origin` must EXACTLY equal an allow-list entry. Never
//   prefix/suffix/substring matching: suffix matching is how
//   `evil-gov.rw.attacker.com` gets in. A MISSING Origin on an unsafe method is
//   a rejection, because "absent" is the one value an attacker can always
//   arrange.
//
//   DOUBLE SUBMIT — a per-session secret in a readable cookie, echoed in
//   `x-csrf-token`, compared against the value bound to THIS session in the
//   store. A cross-site attacker can cause the cookie to be SENT but cannot
//   READ it to build the header, because reading it needs an XHR from our
//   origin and CORS refuses that.
//
// Not redundant: origin pinning fails open when a proxy strips headers,
// double-submit fails open against script on our own origin. Neither covers the
// other, so both are required.
// ══════════════════════════════════════════════════════════════════

import { HttpError, type SetCookie, type RequestContext } from './http.ts';
import type { EdgeSession, EdgeSessionStore } from './session-store.ts';

export const CSRF_HEADER_NAME = 'x-csrf-token';

export interface CookieNames {
  /** Opaque session handle. httpOnly — JS must never read it. */
  readonly session: string;
  /** The readable double-submit echo. Deliberately NOT httpOnly. */
  readonly csrf: string;
  /** True when the `__Host-` prefix is in force. */
  readonly hostPrefixed: boolean;
}

/**
 * Cookie names for a deployment.
 *
 * The prefix is conditional for a mechanical reason, not a preference: a
 * `__Host-` cookie without `Secure` is SILENTLY DROPPED by every current
 * browser, so on plain-http localhost the prefixed name would make login
 * appear to succeed and then do nothing. Dev drops the prefix and
 * `main.ts` prints why; production keeps it and the backend's production guard
 * refuses to boot with `EDGE_COOKIE_SECURE=false`.
 */
export function cookieNames(secure: boolean): CookieNames {
  if (secure) {
    return { session: '__Host-usrp_session', csrf: '__Host-usrp_csrf', hostPrefixed: true };
  }
  return { session: 'usrp_session_dev', csrf: 'usrp_csrf_dev', hostPrefixed: false };
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

/**
 * Assert the request's origin is allow-listed. Unsafe methods only: a GET with
 * no Origin is an ordinary top-level navigation, while a POST with no Origin is
 * a write whose provenance cannot be established.
 */
export function assertOriginPinned(ctx: RequestContext, allowedOrigins: readonly string[]): void {
  if (!isUnsafeMethod(ctx.method)) return;
  const origin = ctx.headers['origin'];
  if (origin === undefined || origin.length === 0) {
    throw new HttpError(403, 'ORIGIN_REQUIRED', 'An Origin header is required on state-changing requests.');
  }
  if (!allowedOrigins.includes(origin)) {
    throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not permitted.');
  }
}

/**
 * Assert the double-submit pair matches the session, in constant time.
 *
 * Bound to the server-side session rather than compared cookie-against-header:
 * a bare cookie/header comparison accepts any pair an attacker can set both
 * halves of, whereas a forged pair belongs to no session.
 */
export function assertCsrfDoubleSubmit(
  ctx: RequestContext,
  store: EdgeSessionStore,
  session: EdgeSession,
  names: CookieNames,
): void {
  if (!isUnsafeMethod(ctx.method)) return;
  const header = ctx.headers[CSRF_HEADER_NAME];
  const cookie = ctx.cookies.get(names.csrf);
  if (header === undefined || cookie === undefined) {
    throw new HttpError(403, 'CSRF_TOKEN_MISSING', 'A CSRF token cookie and header are both required.');
  }
  if (!store.csrfMatches(session, header) || !store.csrfMatches(session, cookie)) {
    throw new HttpError(403, 'CSRF_TOKEN_INVALID', 'CSRF token does not match this session.');
  }
}

/** The httpOnly handle cookie. Max-Age tracks the sliding idle TTL. */
export function sessionCookie(names: CookieNames, handle: string, idleTtlSeconds: number, secure: boolean): SetCookie {
  return {
    name: names.session,
    value: handle,
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: '/',
    maxAgeSeconds: idleTtlSeconds,
  };
}

/**
 * The CSRF echo. Readable ON PURPOSE — the SPA must read it to build the
 * header, which is the whole mechanism. It authenticates nothing by itself and
 * is useless without the session cookie.
 */
export function csrfCookie(names: CookieNames, token: string, idleTtlSeconds: number, secure: boolean): SetCookie {
  return {
    name: names.csrf,
    value: token,
    httpOnly: false,
    secure,
    sameSite: 'Strict',
    path: '/',
    maxAgeSeconds: idleTtlSeconds,
  };
}

/** Clearing must repeat every attribute, or the browser keeps the old pair. */
export function clearedCookies(names: CookieNames, secure: boolean): readonly SetCookie[] {
  return [
    { name: names.session, value: '', httpOnly: true, secure, sameSite: 'Strict', path: '/', maxAgeSeconds: 0 },
    { name: names.csrf, value: '', httpOnly: false, secure, sameSite: 'Strict', path: '/', maxAgeSeconds: 0 },
  ];
}
