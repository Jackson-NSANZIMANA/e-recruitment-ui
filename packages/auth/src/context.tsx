import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createEdgeAuthClient, type AuthAttempt, type EdgeAuthClient } from './edge-client.js';
import { planRefresh, startRefreshLoop } from './refresh.js';
import {
  initialOtpState,
  otpReducer,
  attemptsRemaining,
  canSubmit,
  millisRemaining,
  shouldOfferWalkIn,
  type OtpState,
} from './otp-machine.js';
import {
  requireOfficerSession,
  type AuthState,
  type OfficerSession,
  type Session,
  type SessionExpiryReason,
} from './session.js';
import { G2G_UNAVAILABLE, OFFICER_LOGIN_FAILED, OTP_ATTEMPTS_EXHAUSTED, OTP_EXPIRED, OTP_INVALID, OTP_REQUEST_ACCEPTED, SESSION_EXPIRED, UNEXPECTED_ERROR } from './copy.js';

// ══════════════════════════════════════════════════════════════════
// @usrp/auth — the React surface
//
// One provider, two flows, and a hard line between them. `useOfficerAuth` and
// `useApplicantAuth` both narrow the session, so a component cannot reach for a
// credential the current user does not hold. The bare `useAuth` exists for the
// shell (headers, redirects) that legitimately does not care which kind it has.
//
// The provider mounts by asking `GET /edge/v1/session`. It cannot read a cookie
// and it does not try: the httpOnly handle is invisible to this code by design,
// so the server is the only authority on whether a session exists.
// ══════════════════════════════════════════════════════════════════

interface AuthContextValue {
  readonly state: AuthState;
  /**
   * Officer sign-in. Resolves to a message on failure, `null` on success.
   *
   * A MESSAGE rather than an error code, because the caller must not be able to
   * branch on the reason: iam-service returns one 401 for an unknown handle, a
   * wrong password and a disabled account, and a UI that could tell them apart
   * would undo that on the first "helpful" error state.
   */
  readonly signInOfficer: (loginHandle: string, password: string) => Promise<string | null>;
  readonly signOut: () => Promise<void>;
  /** Warning window before the ABSOLUTE ceiling. Null when not near it. */
  readonly expiryWarning: { readonly endsAt: string; readonly millisLeft: number } | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  /** Edge base URL — e.g. "http://localhost:4021". NEVER a service port. */
  readonly edgeBaseUrl: string;
  /** Injectable for tests and Storybook. */
  readonly client?: EdgeAuthClient;
  readonly children: React.ReactNode;
}

export function AuthProvider({ edgeBaseUrl, client, children }: AuthProviderProps): React.ReactElement {
  const auth = useMemo(() => client ?? createEdgeAuthClient({ baseUrl: edgeBaseUrl }), [client, edgeBaseUrl]);
  const [state, setState] = useState<AuthState>({ status: 'checking' });
  const [expiryWarning, setExpiryWarning] = useState<{ endsAt: string; millisLeft: number } | null>(null);
  const session = state.status === 'authenticated' ? state.session : null;

  // Mount: ask the edge. There is no cookie to read and no token to decode.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await auth.loadSession();
      if (cancelled) return;
      setState(loaded === null ? { status: 'anonymous' } : { status: 'authenticated', session: loaded });
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  // Silent refresh against the sliding window; stops short of the ceiling and
  // warns instead, so a long form is never lost without notice.
  useEffect(() => {
    if (session === null) return undefined;
    setExpiryWarning(null);
    return startRefreshLoop({
      session,
      refresh: () => auth.refreshSession(),
      onRefreshed: (refreshed) => { setState({ status: 'authenticated', session: refreshed }); },
      onWarn: (endsAt, millisLeft) => { setExpiryWarning({ endsAt, millisLeft }); },
      onExpired: (reason: SessionExpiryReason) => {
        setExpiryWarning(null);
        setState({ status: 'expired', reason });
      },
    });
  }, [auth, session]);

  const signInOfficer = useCallback(
    async (loginHandle: string, password: string): Promise<string | null> => {
      const attempt = await auth.officerLogin(loginHandle, password);
      if (attempt.outcome === 'ok') {
        const loaded = await auth.loadSession();
        setState(loaded === null ? { status: 'anonymous' } : { status: 'authenticated', session: loaded });
        return null;
      }
      return messageFor(attempt, OFFICER_LOGIN_FAILED);
    },
    [auth],
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (session?.kind === 'applicant') await auth.applicantLogout();
    else await auth.officerLogout();
    setState({ status: 'anonymous' });
  }, [auth, session]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signInOfficer, signOut, expiryWarning }),
    [state, signInOfficer, signOut, expiryWarning],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth must be used inside <AuthProvider />');
  return ctx;
}

/**
 * The officer session, or null.
 *
 * Returns `OfficerSession` rather than `Session`, so an officer-only operation
 * takes the narrow type and an applicant session cannot be passed to it — the
 * compile-time half of ADR-016/ADR-018's "not interchangeable".
 */
export function useOfficerSession(): OfficerSession | null {
  const { state } = useAuth();
  if (state.status !== 'authenticated' || state.session.kind !== 'officer') return null;
  return requireOfficerSession(state.session);
}

export function useSessionExpiryMessage(): string | null {
  const { state } = useAuth();
  if (state.status !== 'expired') return null;
  return SESSION_EXPIRED[state.reason];
}

// ── The citizen OTP flow ────────────────────────────────────────

export interface ApplicantAuthApi {
  readonly otp: OtpState;
  /** Human-facing message for the current state. Never leaks what the API hid. */
  readonly message: string | null;
  readonly attemptsLeft: number;
  readonly millisLeft: number;
  readonly canSubmitCode: boolean;
  /** True when the walk-in lane (ADR-012) should be offered as the real path. */
  readonly offerWalkIn: boolean;
  readonly requestCode: (nationalId: string) => Promise<void>;
  readonly submitCode: (otp: string) => Promise<void>;
  readonly reset: () => void;
}

/**
 * The citizen sign-in flow as a state machine, driven by the pure reducer.
 *
 * The TTL and the attempt cap are tracked LOCALLY because the API deliberately
 * refuses to expose either. See `otp-machine.ts` — that is not a shortcut, it is
 * the only correct reading of a uniform 202 and a single opaque 401.
 */
export function useApplicantAuth(edgeBaseUrl: string, client?: EdgeAuthClient): ApplicantAuthApi {
  const auth = useMemo(() => client ?? createEdgeAuthClient({ baseUrl: edgeBaseUrl }), [client, edgeBaseUrl]);
  const [otp, dispatch] = useReducer(otpReducer, undefined, initialOtpState);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const nationalIdRef = useRef<string>('');

  // A 1s tick so the countdown and the expiry transition are driven by the clock
  // rather than by the citizen happening to submit something.
  useEffect(() => {
    if (otp.status !== 'challenged' && otp.status !== 'rejected') return undefined;
    const timer = setInterval(() => {
      const at = Date.now();
      setNowMs(at);
      dispatch({ type: 'TICK', atMs: at });
    }, 1_000);
    return () => { clearInterval(timer); };
  }, [otp.status]);

  const requestCode = useCallback(
    async (nationalId: string): Promise<void> => {
      nationalIdRef.current = nationalId;
      dispatch({ type: 'REQUEST', nationalId });
      const attempt = await auth.requestOtp(nationalId);
      if (attempt.outcome === 'upstreamUnavailable') {
        dispatch({ type: 'REQUEST_UPSTREAM_UNAVAILABLE', authority: attempt.authority });
        return;
      }
      // A 400 shape error and a 202 both land here as "accepted", because the
      // only thing we may reveal is that we took the request.
      dispatch({ type: 'REQUEST_ACCEPTED', atMs: Date.now() });
    },
    [auth],
  );

  const submitCode = useCallback(
    async (code: string): Promise<void> => {
      dispatch({ type: 'SUBMIT' });
      const attempt = await auth.verifyOtp(nationalIdRef.current, code);
      if (attempt.outcome === 'ok') {
        dispatch({ type: 'SUBMIT_VERIFIED' });
        return;
      }
      if (attempt.outcome === 'upstreamUnavailable') {
        // Not charged as an attempt: the challenge was never reached.
        dispatch({ type: 'SUBMIT_UPSTREAM_UNAVAILABLE', authority: attempt.authority });
        return;
      }
      dispatch({ type: 'SUBMIT_REJECTED' });
    },
    [auth],
  );

  const reset = useCallback((): void => { dispatch({ type: 'RESET' }); }, []);

  return {
    otp,
    message: otpMessage(otp),
    attemptsLeft: attemptsRemaining(otp),
    millisLeft: millisRemaining(otp, nowMs),
    canSubmitCode: canSubmit(otp),
    offerWalkIn: shouldOfferWalkIn(otp),
    requestCode,
    submitCode,
    reset,
  };
}

function otpMessage(state: OtpState): string | null {
  switch (state.status) {
    case 'idle':
    case 'requesting':
    case 'verifying':
    case 'verified':
      return null;
    case 'challenged':
      return OTP_REQUEST_ACCEPTED;
    case 'rejected':
      return OTP_INVALID;
    case 'attemptsExhausted':
      return OTP_ATTEMPTS_EXHAUSTED;
    case 'expired':
      return OTP_EXPIRED;
    case 'upstreamUnavailable':
      return G2G_UNAVAILABLE[state.authority] ?? UNEXPECTED_ERROR;
    default:
      return assertNever(state);
  }
}

function messageFor(attempt: AuthAttempt, rejectedMessage: string): string {
  if (attempt.outcome === 'rejected') return rejectedMessage;
  if (attempt.outcome === 'upstreamUnavailable') return G2G_UNAVAILABLE[attempt.authority] ?? UNEXPECTED_ERROR;
  return UNEXPECTED_ERROR;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled OTP state: ${JSON.stringify(value)}`);
}

export { planRefresh };
