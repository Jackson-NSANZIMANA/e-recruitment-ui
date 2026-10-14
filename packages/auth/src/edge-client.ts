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
  identity: '/edge/v1/auth/applicant/identity',
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
  /** The onboarding token lapsed or was refused — start again from step 1. */
  | { readonly outcome: 'onboardingExpired' }
  /** The number is not a deliverable Rwandan MTN/Airtel mobile. */
  | { readonly outcome: 'invalidPhone' }
  /** Our own fault. Never shown as a credential problem. */
  | { readonly outcome: 'error'; readonly code: string };

/** Onboarding step 1. Never more than the edge said. */
export type IdentityAttempt =
  | { readonly outcome: 'confirmed'; readonly onboardingToken: string }
  /** One outcome for unknown NID, non-citizen, wrong DOB and a locked NID. */
  | { readonly outcome: 'notConfirmed' }
  | { readonly outcome: 'upstreamUnavailable'; readonly authority: string }
  | { readonly outcome: 'error'; readonly code: string };

export interface EdgeAuthClient {
  readonly loadSession: () => Promise<Session | null>;
  readonly refreshSession: () => Promise<Session | null>;
  readonly officerLogin: (loginHandle: string, password: string) => Promise<AuthAttempt>;
  readonly officerLogout: () => Promise<void>;
  /** Step 1 — National ID + date of birth (YYYY-MM-DD). */
  readonly confirmIdentity: (nationalId: string, dateOfBirth: string) => Promise<IdentityAttempt>;
  /** Step 2 — the phone the citizen typed; the code is sent THERE. */
  readonly requestOtp: (onboardingToken: string, phoneNumber: string, channel?: string) => Promise<AuthAttempt>;
  /** Step 3 — the code, for that same number. */
  readonly verifyOtp: (onboardingToken: string, phoneNumber: string, otp: string, channel?: string) => Promise<AuthAttempt>;
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
     * Step 1. 200 yields a short-lived onboarding token (kept in memory only);
     * 422 is the single "not confirmed" answer.
     */
    confirmIdentity: async (nationalId: string, dateOfBirth: string): Promise<IdentityAttempt> => {
      const response = await send(EDGE_PATHS.identity, { nationalId, dateOfBirth });
      if (response.ok) {
        try {
          const parsed = (await response.json()) as Record<string, unknown>;
          const token = parsed['onboardingToken'];
          if (typeof token === 'string' && token.length > 0) {
            return { outcome: 'confirmed', onboardingToken: token };
          }
        } catch {
          // fall through to the generic error
        }
        return { outcome: 'error', code: 'UPSTREAM_CONTRACT_MISMATCH' };
      }
      if (response.status === 422) return { outcome: 'notConfirmed' };
      const attempt = await classify(response);
      if (attempt.outcome === 'upstreamUnavailable') return attempt;
      // A 400 here is a malformed NID/date the form should have caught; the
      // citizen is told the same thing as a mismatch — nothing more specific.
      if (attempt.outcome === 'rejected') return { outcome: 'notConfirmed' };
      return { outcome: 'error', code: attempt.outcome === 'error' ? attempt.code : 'UNEXPECTED' };
    },

    /**
     * Step 2. A 202 means the request was ACCEPTED — nothing more. Whether an
     * SMS was sent is not knowable here and must not be implied.
     */
    requestOtp: async (
      onboardingToken: string,
      phoneNumber: string,
      channel: string = 'WEB',
    ): Promise<AuthAttempt> => {
      const response = await send(EDGE_PATHS.otpRequest, { onboardingToken, phoneNumber, channel });
      if (response.status === 401) return { outcome: 'onboardingExpired' };
      if (response.status === 400) {
        try {
          const parsed = (await response.clone().json()) as Record<string, unknown>;
          if (parsed['error'] === 'INVALID_PHONE_NUMBER') return { outcome: 'invalidPhone' };
        } catch {
          // non-JSON 400: fall through
        }
      }
      return classify(response);
    },

    /** Step 3. On success the edge sets the cookie; nothing is returned. */
    verifyOtp: async (
      onboardingToken: string,
      phoneNumber: string,
      otp: string,
      channel: string = 'WEB',
    ): Promise<AuthAttempt> =>
      classify(await send(EDGE_PATHS.otpVerify, { onboardingToken, phoneNumber, otp, channel })),

    applicantLogout: async (): Promise<void> => {
      await send(EDGE_PATHS.applicantLogout, {});
    },
  };
}
