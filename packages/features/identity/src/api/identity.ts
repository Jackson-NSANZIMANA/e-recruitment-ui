// ═══════════════════════════════════════════════════════════════
// identity — what this slice may and may not claim about a credential
//
// THIS FILE NO LONGER PERFORMS AUTHENTICATION, and the deletion is the point.
//
// WHAT WAS HERE, AND WHY IT WAS A SECURITY DEFECT AND NOT A NAMING ONE
//
//     export interface TokenIssued { readonly token: string; readonly expiresAt: string }
//     export const officerLogin = (t, b): Promise<TokenIssued> => t.call('officerLogin', ...)
//     export const verifyOtp = (...): Promise<{ sessionToken: string; expiresAt: string }>
//
// Both signatures assert THE BROWSER RECEIVES A BEARER CREDENTIAL. It does not,
// and it must not. edge-contract.md §2: the browser holds an opaque handle in an
// httpOnly cookie plus a readable CSRF echo that is not a credential; the
// officer's Ed25519 JWT (ADR-016) and the citizen's opaque revocable session
// token (ADR-018) never leave the server side of the edge.
//
// Those were the UPSTREAM response shapes, transcribed onto the browser layer.
//
// A type is a specification. Anyone building on that signature writes
// `const { token } = await officerLogin(...)` and then has to put the token
// somewhere a browser can hold it — localStorage, a store, an Authorization
// header. The declaration was an invitation to break the credential boundary,
// and the security scan's browser-storage check would only have caught the last
// step of it, after the design error was already load-bearing.
//
// It also named three operations the edge does not serve (`requestApplicantOtp`,
// `verifyApplicantOtp`, `logoutApplicant`), so none of it could have run.
//
// WHERE AUTHENTICATION ACTUALLY LIVES
//
// @usrp/auth. `createEdgeAuthClient` owns officer login, the citizen OTP
// request/verify pair, the session probe, sliding refresh and logout; the
// reducer in `otp-machine.ts` has its transitions asserted; `context.tsx`
// exposes `useAuth`, `useOfficerSession` and `useApplicantAuth`. It returns a
// SESSION VIEW and no token, because that is what the edge returns.
//
// This slice's routes consume that. It does not wrap it, because a wrapper would
// be a third name for one flow and the first place a future reader looks for the
// token that does not exist.
// ═══════════════════════════════════════════════════════════════

import type { ApplicationChannel } from '@usrp/contracts';

/**
 * The channel a citizen surface reports when starting an OTP challenge.
 *
 * Required by identity-service (`400 INVALID_CHANNEL` otherwise). The web portal
 * is always `WEB`; the field tablet at a venue is `WALK_IN`.
 */
export const PORTAL_CHANNEL: ApplicationChannel = 'WEB';

/**
 * What the citizen OTP request tells us: NOTHING about whether a message was sent.
 *
 * The 202 is byte-identical across a real send, an unknown National ID, an
 * unverified identity, and a NIDA record with no phone on file. That uniformity
 * IS the anti-enumeration control, so any copy that says "we sent you a code"
 * claims something the API withheld.
 *
 * Centralised here so no component can re-derive a friendlier lie.
 */
export const OTP_REQUEST_TELLS_US = {
  accepted: true,
  /** Whether a message was actually dispatched. Unknowable by design. */
  messageSent: null,
  /** Whether the National ID exists. Unknowable by design. */
  identityExists: null,
} as const;

/**
 * What `POST /v1/identities/verify` returns to an OFFICER, for reference.
 *
 * `{ status, applicantId }`. No name, no date of birth, no gender — raw NIDA PII
 * is rejected by the contract's negative fixtures. So "ask only for the National
 * ID and pre-fill the applicant's name" is not a missing feature, it is a
 * REFUSED one, and the officer confirms identity from the physical document in
 * front of them.
 *
 * A type, not a function: this slice does not call it. @usrp/api-client's
 * `useVerifyIdentity` does, from the officer walk-in desk.
 */
export type OfficerIdentityVerifyView =
  | { readonly status: 'CREATED'; readonly applicantId: string }
  | { readonly status: 'ALREADY_EXISTS'; readonly applicantId: string };
