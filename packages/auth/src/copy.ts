// ══════════════════════════════════════════════════════════════════
// @usrp/auth — auth copy, centralised so it cannot leak what the API withheld
//
// The backend spent real effort making failures indistinguishable:
//
//   • officer login answers ONE 401 INVALID_CREDENTIALS for an unknown handle,
//     a wrong password, AND a disabled account.
//   • otp/request answers ONE byte-identical 202 for a real send, an unknown
//     NID, an unverified identity, and a NIDA record with no phone.
//   • otp/verify answers ONE 401 for no challenge, expired, locked out, wrong
//     code, and replay.
//
// All of that is defeated by a single well-meaning error message. "No account
// with that handle" turns one 401 into a user-enumeration oracle; "we couldn't
// find your National ID" turns a uniform 202 into a NIDA lookup service for
// anyone with a list of numbers. In this domain that list identifies people
// applying to the national security services.
//
// So the copy lives HERE, as constants, with the reason attached. A component
// that needs a message imports one; there is no string to improvise at the call
// site, and a reviewer can see every user-visible auth sentence in one file.
// ══════════════════════════════════════════════════════════════════

/**
 * The ONLY message shown for a failed officer login.
 *
 * Deliberately says "handle or password" — the ambiguity is the feature, and it
 * covers the disabled-account case too, which is the one people forget.
 */
export const OFFICER_LOGIN_FAILED =
  'That handle and password combination is not valid. Check both and try again, or contact your agency administrator.';

/**
 * Shown after EVERY otp/request, whatever happened upstream.
 *
 * Note what it does NOT say: not "we sent a code to your phone" (there may be
 * no phone), not "check your messages" (nothing may have been sent), not "if
 * this NID exists" (which hints there is something to discover). It states what
 * WE did — accepted the request — and what the citizen should do next.
 */
export const OTP_REQUEST_ACCEPTED =
  'If this National ID is registered and has a phone number on file with NIDA, a 6-digit code has been sent to it. ' +
  'The code is valid for 5 minutes.';

/**
 * The ONLY message for a failed otp/verify.
 *
 * Covers a wrong code, an expired one, a replayed one, and a locked-out
 * challenge, because the API cannot tell us which and must not.
 */
export const OTP_INVALID =
  'That code is not valid. It may have expired — codes last 5 minutes. Request a new one to continue.';

/**
 * Shown when the CLIENT's own attempt counter reaches the cap.
 *
 * Truthful about the mechanism because the cap is public policy, not a secret,
 * and a citizen who does not know why they are stuck will phone a call centre.
 * Crucially this is driven by OUR count of submitted attempts, never by a
 * distinguishing response — there isn't one.
 */
export const OTP_ATTEMPTS_EXHAUSTED =
  'You have used all 5 attempts for this code. Request a new code to try again.';

/** Shown when the 5-minute challenge window elapses in the UI. */
export const OTP_EXPIRED =
  'This code has expired. Codes are valid for 5 minutes. Request a new one to continue.';

/**
 * The walk-in fallback (ADR-012), surfaced honestly.
 *
 * ADR-018 documents this cost in plain terms: a citizen whose NIDA phone record
 * is stale or absent CANNOT pass the OTP door. There is no digital workaround,
 * and pretending otherwise leaves them retrying a code that was never sent. The
 * walk-in lane is a real, staffed alternative where an officer establishes
 * identity in person — so the UI must offer it, not bury it.
 *
 * It is offered to EVERYONE who cannot complete OTP, never only to citizens we
 * have determined are phoneless — determining that in the UI would require the
 * API to tell us, which is exactly what the uniform 202 refuses to do.
 */
export const WALK_IN_FALLBACK_TITLE = 'Not receiving a code?';
export const WALK_IN_FALLBACK_BODY =
  'Codes are sent to the phone number NIDA holds for your National ID. If that number has changed or was never ' +
  'registered, no code can reach you and there is no way to update it here. You can still apply in person: bring ' +
  'your National ID to a recruitment venue, where an officer will verify your identity and register you directly.';

/** Session expiry copy, keyed by the reason the edge reported. */
export const SESSION_EXPIRED: Readonly<Record<'idle' | 'absolute' | 'revoked', string>> = {
  idle: 'You were signed out after 30 minutes of inactivity. Sign in again to continue.',
  absolute:
    'Your session reached its maximum length and ended. This happens to every session regardless of activity. ' +
    'Sign in again to continue.',
  revoked: 'This session was ended. Sign in again to continue.',
};

/**
 * Copy for a foreign-government outage.
 *
 * Named per authority ON PURPOSE. "Something went wrong" tells a citizen to
 * retry a broken thing forever; "the national ID registry is briefly
 * unavailable and your application is untouched" tells them to come back in ten
 * minutes. Only the second is both true and actionable, and the backend already
 * distinguishes these with specific 503 codes.
 */
export const G2G_UNAVAILABLE: Readonly<Record<string, string>> = {
  NIDA_UNAVAILABLE:
    'The national identity registry (NIDA) is temporarily unreachable. Nothing you entered has been lost — please try again in a few minutes.',
  NESA_UNAVAILABLE:
    'The examinations board (NESA) is temporarily unreachable, so secondary results cannot be checked right now. Please try again shortly.',
  RIB_UNAVAILABLE:
    'The investigation bureau (RIB) is temporarily unreachable. Your application continues; this check will complete automatically.',
  HEC_UNAVAILABLE:
    'The higher education council (HEC) is temporarily unreachable, so degree details cannot be checked right now. Please try again shortly.',
  SCANNER_UNAVAILABLE: 'The document scanner is temporarily unavailable. Please try your upload again shortly.',
  ELIGIBILITY_STORE_UNAVAILABLE: 'Eligibility checks are temporarily unavailable. Please try again shortly.',
  UPSTREAM_UNAVAILABLE: 'A required government service is temporarily unreachable. Please try again shortly.',
};

/** Generic last resort. Reached only when nothing more specific is known. */
export const UNEXPECTED_ERROR = 'Something went wrong on our side. Please try again, and contact support if it continues.';
