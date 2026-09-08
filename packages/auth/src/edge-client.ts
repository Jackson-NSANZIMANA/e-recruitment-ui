// ══════════════════════════════════════════════════════════════════
// @usrp/auth — the auth calls, aimed at the edge that will exist
//
// WHAT WAS DELETED AND WHY:
//
//   POST /auth/login  — no service in the platform serves it. The real route is
//                       iam-service `POST /v1/auth/officer/login`, and it takes
//                       {loginHandle, password}, NOT {email, password}.
//                       `officer_accounts.login_handle` is a varchar(128); there
//                       is no email column anywhere in the credential store, so
//                       the old signature could never have worked.
//   GET  /auth/me     — no service serves it either. It was also the wrong
//                       shape: it returned a decoded JWT payload including
//                       `email` and a `SUPERADMIN` role. RLS is FORCE'd with
//                       NOLOGIN group roles and there is NO bypass principal, so
//                       a "superadmin, no RLS" role is not merely absent — it is
//                       unrepresentable.
//
// Replaced by `GET /edge/v1/session`, which returns session metadata and no
// credential, and by the two real login flows below.
//
// Every call sends `credentials: 'include'` and NO Authorization header. There is
// nothing here to put in one: the officer JWT and the citizen opaque token live
// at the edge. That is the design, not an omission.
// ══════════════════════════════════════════════════════════════════

import { parseSessionResponse, type Session } from './session.js';

/** Edge paths. Exact, and centralised so no component improvises one. */
export const EDGE_PATHS = {
  session: '/edge/v1/session',
  refresh: '/edge/v1/session/refresh',
  officerLogin: '/edge/v1/auth/officer/login',
  officerLogout: '/edge/v1/auth/officer/logout',
  otpRequest: '/edge/v1/auth/applicant/otp/request',
  otpVerify: '/edge/v1/auth/applicant/otp/verify',
  applicantLogout: '/edge/v1/auth/applicant/logout',
} as const;

/** The readable half of the CSRF double-submit pair, by deployment posture. */
export const CSRF_COOKIE_SECURE = '__Host-usrp_csrf';
export const CSRF_COOKIE_DEV = 'usrp_csrf_dev';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Read the CSRF echo cookie.
 *
 * This is the ONE cookie the SPA is meant to read, which is why it is not
 * httpOnly. It is not a credential: on its own it authenticates nothing, and it
 * is useless without the session cookie no script can touch.
 *
 * Both names are tried because dev cannot use the `__Host-` prefix over plain
 * http (browsers silently drop such a cookie) while production must.
 */
export function readCsrfToken(cookieHeader: string = typeof document === 'undefined' ? '' : document.cookie): string | null {
  for (const pair of cookieHeader.split(';')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    if (name === CSRF_COOKIE_SECURE || name === CSRF_COOKIE_DEV) {
      return pair.slice(eq + 1).trim();
    }
  }
  return null;
}

export interface EdgeAuthClientOptions {
  /** e.g. "http://localhost:4021". NEVER a microservice port. */
  readonly baseUrl: string;
  /** Injectable for tests; defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable for tests; defaults to reading document.cookie. */
  readonly readCsrf?: () => string | null;
}

/** What the caller learns from an auth attempt. Never more than the API told us. */
export type AuthAttempt =
  | { readonly outcome: 'ok' }
  /** ONE failure for every credential problem. No enumeration, ever. */
  | { readonly outcome: 'rejected' }
  /** A named foreign-government outage — distinct, and safe to distinguish. */
  | { readonly outcome: 'upstreamUnavailable'; readonly authority: string }
  /** Our own fault. Never shown as a credential problem. */
  | { readonly outcome: 'error'; readonly code: string };

export interface EdgeAuthClient {
  readonly loadSession: () => Promise<Session | null>;
  readonly refreshSession: () => Promise<Session | null>;
  readonly officerLogin: (loginHandle: string, password: string) => Promise<AuthAttempt>;
  readonly officerLogout: () => Promise<void>;
  readonly requestOtp: (nationalId: string, channel?: string) => Promise<AuthAttempt>;
  readonly verifyOtp: (nationalId: string, otp: string, channel?: string) => Promise<AuthAttempt>;
  readonly applicantLogout: () => Promise<void>;
}

const G2G_CODES = new Set([
  'NIDA_UNAVAILABLE',
  'NESA_UNAVAILABLE',
  'RIB_UNAVAILABLE',
  'HEC_UNAVAILABLE',
  'SCANNER_UNAVAILABLE',
  'ELIGIBILITY_STORE_UNAVAILABLE',
  'UPSTREAM_UNAVAILABLE',
]);

export function createEdgeAuthClient(options: EdgeAuthClientOptions): EdgeAuthClient {
  const doFetch = options.fetchImpl ?? fetch;
  const csrf = options.readCsrf ?? (() => readCsrfToken());

  const send = async (path: string, body?: unknown): Promise<Response> => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = csrf();
    if (token !== null) headers[CSRF_HEADER] = token;
    return doFetch(`${options.baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      // The cookie is the credential and the browser attaches it. There is no
      // Authorization header here and there must never be one.
      credentials: 'include',
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  };

  const classify = async (response: Response): Promise<AuthAttempt> => {
    if (response.ok) return { outcome: 'ok' };
    let code = 'UNEXPECTED';
    try {
      const parsed = (await response.json()) as Record<string, unknown>;
      const error = parsed['error'];
      const status = parsed['status'];
      if (typeof error === 'string') code = error;
      else if (typeof status === 'string') code = status;
    } catch {
      // A non-JSON error body is our problem, not the caller's.
    }
    if (response.status === 503 && G2G_CODES.has(code)) {
      return { outcome: 'upstreamUnavailable', authority: code };
    }
    if (response.status === 401 || response.status === 400) return { outcome: 'rejected' };
    return { outcome: 'error', code };
  };

  const loadSession = async (): Promise<Session | null> => {
    const response = await send(EDGE_PATHS.session);
    if (!response.ok) return null;
    return parseSessionResponse(await response.json());
  };

  return {
    loadSession,

    refreshSession: async (): Promise<Session | null> => {
      const response = await send(EDGE_PATHS.refresh, {});
      if (!response.ok) return null;
      return parseSessionResponse(await response.json());
    },

    /**
     * Officer login. `loginHandle`, not email — see the header of this file.
     *
     * The 401 is returned as a bare `rejected` with no detail, so a caller
     * physically cannot render a message that distinguishes an unknown handle
     * from a wrong password from a disabled account.
     */
    officerLogin: async (loginHandle: string, password: string): Promise<AuthAttempt> =>
      classify(await send(EDGE_PATHS.officerLogin, { loginHandle, password })),

    officerLogout: async (): Promise<void> => {
      await send(EDGE_PATHS.officerLogout, {});
    },

    /**
     * Request an OTP. A 202 means the request was ACCEPTED — nothing more.
     * Whether an SMS was sent is not knowable here and must not be implied.
     */
    requestOtp: async (nationalId: string, channel: string = 'WEB'): Promise<AuthAttempt> =>
      classify(await send(EDGE_PATHS.otpRequest, { nationalId, channel })),

    /** Verify an OTP. On success the edge sets the cookie; nothing is returned. */
    verifyOtp: async (nationalId: string, otp: string, channel: string = 'WEB'): Promise<AuthAttempt> =>
      classify(await send(EDGE_PATHS.otpVerify, { nationalId, otp, channel })),

    applicantLogout: async (): Promise<void> => {
      await send(EDGE_PATHS.applicantLogout, {});
    },
  };
}
