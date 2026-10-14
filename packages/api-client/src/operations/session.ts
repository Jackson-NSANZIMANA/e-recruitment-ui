// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — session and authentication operations
//
// Every auth endpoint mapped to its operation, providing a typed wrapper
// around the edge gateway's session and credential endpoints. These are
// called at app bootstrap (readSession), on user action (logout),
// and on special workflows (officer/applicant login, OTP flow).
// ══════════════════════════════════════════════════════════════════

import type { ApiClient } from '../transport.js';

// ── Session ─────────────────────────────────────────────────────

/**
 * Read the current session state.
 *
 * Returns 200 with session data if the edge has an active httpOnly session
 * cookie, or 401 Unauthorized if there is no session.
 */
export function readSession(client: ApiClient, correlationId?: string): Promise<{ readonly status: 'authenticated' | 'anonymous' }> {
  return client.call<{ readonly status: 'authenticated' | 'anonymous' }>('readSession', correlationId === undefined ? {} : { correlationId });
}

/**
 * Refresh the session handle and CSRF token.
 *
 * Moves the httpOnly session cookie forward and returns a new CSRF token
 * for the next unsafe operation.
 */
export function refreshSession(client: ApiClient, correlationId?: string): Promise<{ readonly csrfToken: string }> {
  return client.call<{ readonly csrfToken: string }>('refreshSession', correlationId === undefined ? {} : { correlationId });
}

// ── Officer Auth ────────────────────────────────────────────────

export interface OfficerLoginInput {
  readonly username: string;
  readonly password: string;
}

export interface OfficerLoginResponse {
  readonly status: 'authenticated';
  readonly agency: string;
  readonly officer: string;
}

/**
 * Officer login with credentials.
 *
 * Returns 200 on success with officer identity and agency, or 401 on invalid
 * credentials. The response is httpOnly secure session cookie set by the edge.
 */
export function officerLogin(client: ApiClient, input: OfficerLoginInput, correlationId?: string): Promise<OfficerLoginResponse> {
  return client.call<OfficerLoginResponse>('officerLogin', {
    body: input,
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

export interface OfficerLogoutResponse {
  readonly status: 'logged_out';
}

/**
 * Officer logout (idempotent).
 *
 * Revokes the session and clears the httpOnly session cookie. Safe to call
 * without a session (returns 204).
 */
export function officerLogout(client: ApiClient, correlationId?: string): Promise<OfficerLogoutResponse> {
  return client.call<OfficerLogoutResponse>('officerLogout', correlationId === undefined ? {} : { correlationId });
}

// ── Applicant Auth (OTP flow) ───────────────────────────────────

/** Onboarding step 1 (ADR-029): National ID + date of birth (YYYY-MM-DD). */
export interface OnboardingBeginInput {
  readonly nationalId: string;
  readonly dateOfBirth: string;
}

export interface OnboardingBeginResponse {
  /** Signed, 15 minutes, not a session. Hold in memory only. */
  readonly onboardingToken: string;
  readonly expiresAt: string | null;
}

/**
 * Step 1. A 422 IDENTITY_NOT_CONFIRMED is the ONE answer for an unknown ID, a
 * non-citizen, a wrong date of birth and a locked ID — do not distinguish them.
 */
export function beginApplicantOnboarding(
  client: ApiClient,
  input: OnboardingBeginInput,
  correlationId?: string,
): Promise<OnboardingBeginResponse> {
  return client.call<OnboardingBeginResponse>('beginApplicantOnboarding', {
    body: input,
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

/** Step 2: the phone the citizen typed. NIDA holds no phone; the National ID is not re-sent. */
export interface OtpRequestInput {
  readonly onboardingToken: string;
  readonly phoneNumber: string;
}

/** The edge answers `{ accepted: true }` — acceptance, never delivery. */
export interface OtpRequestResponse {
  readonly accepted: true;
}

/**
 * Step 2. 202 means the request was accepted — NOT that an SMS was sent.
 * 401 ONBOARDING_EXPIRED means start again from step 1; 400
 * INVALID_PHONE_NUMBER means the number is not a deliverable MTN/Airtel line.
 * Not retried automatically past the registry's own policy.
 */
export function requestOtp(client: ApiClient, input: OtpRequestInput, correlationId?: string): Promise<OtpRequestResponse> {
  return client.call<OtpRequestResponse>('requestOtp', {
    body: input,
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

/** Step 3: the token, the SAME phone, and the code. */
export interface OtpVerifyInput {
  readonly onboardingToken: string;
  readonly phoneNumber: string;
  readonly otp: string;
}

/** The edge sets the session cookie and answers 204 — there is no body and no token here. */
export type OtpVerifyResponse = Readonly<Record<string, never>>;

/**
 * Step 3. One 401 for wrong / expired / replayed / locked. On success the edge
 * sets the session cookie; the browser never sees a token.
 */
export function verifyOtp(client: ApiClient, input: OtpVerifyInput, correlationId?: string): Promise<OtpVerifyResponse> {
  return client.call<OtpVerifyResponse>('verifyOtp', {
    body: input,
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

export interface ApplicantLogoutResponse {
  readonly status: 'logged_out';
}

/**
 * Applicant logout (idempotent).
 *
 * Revokes the session and clears the httpOnly session cookie. Safe to call
 * without a session (returns 204).
 */
export function applicantLogout(client: ApiClient, correlationId?: string): Promise<ApplicantLogoutResponse> {
  return client.call<ApplicantLogoutResponse>('applicantLogout', correlationId === undefined ? {} : { correlationId });
}
