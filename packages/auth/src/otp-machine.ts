// ══════════════════════════════════════════════════════════════════
// @usrp/auth — the OTP challenge state machine (ADR-018)
//
// A PURE reducer with no React and no network, for one reason: the 5-minute TTL
// and the 5-attempt lockout are safety-relevant states that must be tested
// directly rather than inferred from a rendered component. Every transition
// below is asserted in the selfcheck.
//
// The hard constraint this file is built around: the API TELLS US NOTHING.
// `otp/request` returns a byte-identical 202 whether a code was sent, the NID is
// unknown, the identity is unverified, or the NIDA record has no phone.
// `otp/verify` returns ONE 401 for wrong, expired, replayed and LOCKED OUT.
//
// So the client cannot LEARN its state from responses; it must TRACK it. The
// attempt counter here is OUR count of submissions, and the expiry is OUR clock
// from the moment the 202 arrived. Both are honest local approximations of a
// server state we are deliberately not shown — and both are named as such so
// nobody later "improves" them by reading a response field that does not exist.
// ══════════════════════════════════════════════════════════════════

/** ADR-018: five attempts per challenge, then the correct code fails too. */
export const OTP_MAX_ATTEMPTS = 5;
/** ADR-018: a 5-minute TTL on the scrypt-digested challenge. */
export const OTP_TTL_MS = 5 * 60 * 1000;

export type OtpState =
  /** Nothing requested yet. */
  | { readonly status: 'idle' }
  /** A request is in flight. */
  | { readonly status: 'requesting' }
  /**
   * A 202 came back. This says NOTHING about whether an SMS was sent — that is
   * the invariant, and the field name says so to stop anyone treating it as a
   * delivery receipt.
   */
  | {
      readonly status: 'challenged';
      readonly nationalId: string;
      /** OUR clock, from the 202. The server's real TTL is not exposed. */
      readonly expiresAtMs: number;
      /** OUR count of submissions. The server's count is not exposed. */
      readonly attemptsUsed: number;
    }
  | {
      readonly status: 'verifying';
      readonly nationalId: string;
      readonly expiresAtMs: number;
      readonly attemptsUsed: number;
    }
  /** A wrong (or expired, or locked — we cannot tell) code was submitted. */
  | {
      readonly status: 'rejected';
      readonly nationalId: string;
      readonly expiresAtMs: number;
      readonly attemptsUsed: number;
    }
  /** Our attempt budget is spent. A new challenge is the only way forward. */
  | { readonly status: 'attemptsExhausted'; readonly nationalId: string }
  /** Our 5-minute clock ran out. */
  | { readonly status: 'expired'; readonly nationalId: string }
  /**
   * A named G2G outage. DISTINCT from every other failure because it is
   * independent of whether the NID exists, so surfacing it leaks nothing and is
   * the only case where the UI can say something specific and true.
   */
  | { readonly status: 'upstreamUnavailable'; readonly authority: string }
  /** Verified. The edge has set the session cookie; there is no token here. */
  | { readonly status: 'verified' };

export type OtpEvent =
  | { readonly type: 'REQUEST'; readonly nationalId: string }
  | { readonly type: 'REQUEST_ACCEPTED'; readonly atMs: number }
  | { readonly type: 'REQUEST_UPSTREAM_UNAVAILABLE'; readonly authority: string }
  | { readonly type: 'SUBMIT' }
  | { readonly type: 'SUBMIT_REJECTED' }
  | { readonly type: 'SUBMIT_UPSTREAM_UNAVAILABLE'; readonly authority: string }
  | { readonly type: 'SUBMIT_VERIFIED' }
  /** The UI's ticking clock. Drives expiry without waiting for a submission. */
  | { readonly type: 'TICK'; readonly atMs: number }
  | { readonly type: 'RESET' };

const IDLE: OtpState = { status: 'idle' };

export function initialOtpState(): OtpState {
  return IDLE;
}

/**
 * The reducer. Exhaustive, and deliberately conservative: an event that makes no
 * sense in the current state returns the state unchanged rather than guessing.
 */
export function otpReducer(state: OtpState, event: OtpEvent): OtpState {
  switch (event.type) {
    case 'RESET':
      return IDLE;

    case 'REQUEST':
      return { status: 'requesting' };

    case 'REQUEST_ACCEPTED':
      // A fresh challenge resets the attempt budget, because the server's
      // per-challenge counter reset too.
      return {
        status: 'challenged',
        nationalId: nationalIdOf(state) ?? '',
        expiresAtMs: event.atMs + OTP_TTL_MS,
        attemptsUsed: 0,
      };

    case 'REQUEST_UPSTREAM_UNAVAILABLE':
      return { status: 'upstreamUnavailable', authority: event.authority };

    case 'SUBMIT':
      if (state.status !== 'challenged' && state.status !== 'rejected') return state;
      return {
        status: 'verifying',
        nationalId: state.nationalId,
        expiresAtMs: state.expiresAtMs,
        attemptsUsed: state.attemptsUsed,
      };

    case 'SUBMIT_REJECTED': {
      if (state.status !== 'verifying') return state;
      const attemptsUsed = state.attemptsUsed + 1;
      if (attemptsUsed >= OTP_MAX_ATTEMPTS) {
        // We reached OUR cap. The server reached its cap at the same count, so
        // continuing to submit would burn attempts against a locked challenge
        // and get the same opaque 401 forever.
        return { status: 'attemptsExhausted', nationalId: state.nationalId };
      }
      return {
        status: 'rejected',
        nationalId: state.nationalId,
        expiresAtMs: state.expiresAtMs,
        attemptsUsed,
      };
    }

    case 'SUBMIT_UPSTREAM_UNAVAILABLE':
      // NOT an attempt. A 503 never reached the challenge, so charging the
      // citizen an attempt for our own outage would be a real injustice: five
      // upstream blips would lock them out of a code that was never checked.
      return { status: 'upstreamUnavailable', authority: event.authority };

    case 'SUBMIT_VERIFIED':
      return { status: 'verified' };

    case 'TICK': {
      if (state.status !== 'challenged' && state.status !== 'rejected') return state;
      if (event.atMs < state.expiresAtMs) return state;
      return { status: 'expired', nationalId: state.nationalId };
    }

    default:
      return assertNever(event);
  }
}

/** Attempts remaining, for the UI. Zero once the budget is spent. */
export function attemptsRemaining(state: OtpState): number {
  if (state.status === 'challenged' || state.status === 'rejected' || state.status === 'verifying') {
    return Math.max(0, OTP_MAX_ATTEMPTS - state.attemptsUsed);
  }
  if (state.status === 'attemptsExhausted') return 0;
  return OTP_MAX_ATTEMPTS;
}

/** Milliseconds left on our local clock, floored at zero. */
export function millisRemaining(state: OtpState, nowMs: number): number {
  if (state.status !== 'challenged' && state.status !== 'rejected' && state.status !== 'verifying') return 0;
  return Math.max(0, state.expiresAtMs - nowMs);
}

/**
 * Whether the walk-in lane should be OFFERED.
 *
 * Offered to everyone who is stuck — exhausted attempts, an expired challenge,
 * or a second failed code — and never gated on "we detected you have no phone",
 * because the uniform 202 means we cannot detect that and must not pretend to.
 * A citizen with a stale NIDA record looks exactly like one who mistyped.
 */
export function shouldOfferWalkIn(state: OtpState): boolean {
  if (state.status === 'attemptsExhausted' || state.status === 'expired') return true;
  if (state.status === 'rejected') return state.attemptsUsed >= 2;
  return false;
}

/** Whether submitting another code can possibly succeed. */
export function canSubmit(state: OtpState): boolean {
  return state.status === 'challenged' || state.status === 'rejected';
}

function nationalIdOf(state: OtpState): string | null {
  if ('nationalId' in state) return state.nationalId;
  return null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled OTP event: ${JSON.stringify(value)}`);
}
