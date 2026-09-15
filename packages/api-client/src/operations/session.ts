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

export interface OtpRequestInput {
  readonly nationalId: string;
}

export interface OtpRequestResponse {
  readonly status: 'otp_requested';
  readonly expiresIn: number; // seconds
}

/**
 * Request OTP for applicant authentication.
 *
 * Initiates the OTP flow by sending a one-time password to the applicant.
 * Returns 202 Accepted on successful request, or 429 on rate limit.
 * Retryable on transient failure (x-usrp-retry-on-g2g: true).
 */
export function requestOtp(client: ApiClient, input: OtpRequestInput, correlationId?: string): Promise<OtpRequestResponse> {
  return client.call<OtpRequestResponse>('requestOtp', {
    body: input,
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

export interface OtpVerifyInput {
  readonly nationalId: string;
  readonly otp: string;
}

export interface OtpVerifyResponse {
  readonly status: 'verified';
  readonly applicantId: string;
}

/**
 * Verify OTP and complete applicant authentication.
 *
 * Validates the OTP code provided by the applicant and establishes an
 * authenticated session. Returns 200 with applicantId on success, or 401
 * if the OTP is invalid or expired.
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
