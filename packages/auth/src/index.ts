// ══════════════════════════════════════════════════════════════════
// @usrp/auth — public surface
//
// Built on the credentials that EXIST (ADR-016, ADR-018), not on the
// httpOnly-JWT-cookie model the old version described, which had no server to
// implement it and named two endpoints (`/auth/login`, `/auth/me`) that no
// service in the platform serves.
//
// What the browser holds: an opaque edge session handle in an httpOnly cookie,
// plus a readable CSRF echo. What it never holds: an officer's Ed25519 bearer
// JWT or a citizen's opaque revocable session token.
// ══════════════════════════════════════════════════════════════════

// ── Session model ──
export type {
  Session,
  SessionKind,
  OfficerSession,
  ApplicantSession,
  OfficerAgency,
  AuthState,
  SessionExpiryReason,
} from './session.js';
export {
  isOfficerSession,
  isApplicantSession,
  requireOfficerSession,
  requireApplicantSession,
  SessionKindError,
  parseSessionResponse,
  millisUntilIdleExpiry,
  millisUntilAbsoluteExpiry,
} from './session.js';

// ── The edge auth client ──
export type { EdgeAuthClient, EdgeAuthClientOptions, AuthAttempt } from './edge-client.js';
export { createEdgeAuthClient, readCsrfToken, EDGE_PATHS, CSRF_HEADER, CSRF_COOKIE_SECURE, CSRF_COOKIE_DEV } from './edge-client.js';

// ── The OTP state machine (pure, testable without React) ──
export type { OtpState, OtpEvent } from './otp-machine.js';
export {
  initialOtpState,
  otpReducer,
  attemptsRemaining,
  millisRemaining,
  canSubmit,
  shouldOfferWalkIn,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
} from './otp-machine.js';

// ── Sliding-TTL refresh ──
export type { RefreshPlan, RefreshLoopOptions } from './refresh.js';
export {
  planRefresh,
  startRefreshLoop,
  REFRESH_AT_FRACTION_REMAINING,
  MIN_REFRESH_DELAY_MS,
  ABSOLUTE_WARNING_WINDOW_MS,
} from './refresh.js';

// ── React surface ──
export type { ApplicantAuthApi } from './context.js';
export { AuthProvider, useAuth, useOfficerSession, useApplicantAuth, useSessionExpiryMessage } from './context.js';
export { RouteGuard, OfficerGuard, ApplicantGuard, AgencyGuard } from './guards.js';

// ── Copy (centralised so no component can leak what the API withheld) ──
export {
  OFFICER_LOGIN_FAILED,
  OTP_REQUEST_ACCEPTED,
  OTP_INVALID,
  OTP_ATTEMPTS_EXHAUSTED,
  OTP_EXPIRED,
  WALK_IN_FALLBACK_TITLE,
  WALK_IN_FALLBACK_BODY,
  SESSION_EXPIRED,
  G2G_UNAVAILABLE,
  UNEXPECTED_ERROR,
} from './copy.js';
