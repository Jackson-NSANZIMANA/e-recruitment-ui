// ══════════════════════════════════════════════════════════════════
// @usrp/auth — silent refresh for the 30-minute sliding TTL
//
// ADR-018 gives the citizen session a 30-minute SLIDING TTL, and the edge adds
// an absolute ceiling on top (a sliding window alone is an immortal session).
// Two consequences the UI has to handle, and they pull in opposite directions:
//
//   SLIDING means an active user must never be logged out mid-form. The cookie's
//   Max-Age has to be re-issued before it lapses, which needs a real request.
//
//   ABSOLUTE means silent refresh MUST EVENTUALLY FAIL, and the UI must warn
//   before it does. Refreshing forever against a ceiling produces the worst
//   possible UX: everything looks fine until a save fails with no warning.
//
// So the schedule below refreshes against the idle window and STOPS refreshing
// as the absolute ceiling approaches, handing the UI a warning window instead.
// Pure functions and an injectable clock, so the behaviour is testable without
// waiting thirty minutes.
// ══════════════════════════════════════════════════════════════════

import { millisUntilAbsoluteExpiry, millisUntilIdleExpiry, type Session } from './session.js';

/** Refresh when a quarter of the idle window remains: two chances before loss. */
export const REFRESH_AT_FRACTION_REMAINING = 0.25;
/** Never schedule tighter than this; a tab waking from sleep must not storm. */
export const MIN_REFRESH_DELAY_MS = 15_000;
/** Warn the user this far before the absolute ceiling. */
export const ABSOLUTE_WARNING_WINDOW_MS = 5 * 60 * 1000;

export type RefreshPlan =
  /** Refresh in `delayMs`. The normal case for an active session. */
  | { readonly action: 'refresh'; readonly delayMs: number }
  /**
   * Do not refresh: the ceiling is close. Tell the user now, with the exact
   * time, so a long form can be saved before the session ends.
   */
  | { readonly action: 'warn'; readonly endsAt: string; readonly millisLeft: number }
  /** Already over. Transition to expired and say which limit was hit. */
  | { readonly action: 'expired'; readonly reason: 'idle' | 'absolute' };

/**
 * Decide what to do about `session` right now.
 *
 * Order matters: the absolute ceiling is evaluated FIRST, because a session that
 * is past it cannot be saved by a refresh and scheduling one would produce a
 * silent 401 instead of an explained sign-out.
 */
export function planRefresh(session: Session, nowMs: number = Date.now()): RefreshPlan {
  const absoluteLeft = millisUntilAbsoluteExpiry(session, nowMs);
  if (absoluteLeft <= 0) return { action: 'expired', reason: 'absolute' };

  const idleLeft = millisUntilIdleExpiry(session, nowMs);
  if (idleLeft <= 0) return { action: 'expired', reason: 'idle' };

  if (absoluteLeft <= ABSOLUTE_WARNING_WINDOW_MS) {
    return { action: 'warn', endsAt: session.absoluteExpiresAt, millisLeft: absoluteLeft };
  }

  // Refresh with three quarters of the idle window elapsed, so a single failed
  // attempt still leaves room for another before the session is actually lost.
  const scheduled = Math.max(MIN_REFRESH_DELAY_MS, Math.floor(idleLeft * (1 - REFRESH_AT_FRACTION_REMAINING)));
  // Never schedule past the ceiling — that refresh would 401.
  const delayMs = Math.min(scheduled, Math.max(MIN_REFRESH_DELAY_MS, absoluteLeft - ABSOLUTE_WARNING_WINDOW_MS));
  return { action: 'refresh', delayMs };
}

export interface RefreshLoopOptions {
  /** Current session, or null when unauthenticated. */
  readonly session: Session | null;
  /** POST /edge/v1/session/refresh; resolves to the refreshed session or null. */
  readonly refresh: () => Promise<Session | null>;
  readonly onRefreshed: (session: Session) => void;
  readonly onWarn: (endsAt: string, millisLeft: number) => void;
  readonly onExpired: (reason: 'idle' | 'absolute') => void;
  readonly now?: () => number;
  readonly setTimer?: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/**
 * Run the refresh loop. Returns a cancel function.
 *
 * Timers are injectable so the selfcheck drives thirty minutes of behaviour in
 * microseconds. A test that actually waits is a test nobody runs.
 */
export function startRefreshLoop(options: RefreshLoopOptions): () => void {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? ((handle) => { clearTimeout(handle as ReturnType<typeof setTimeout>); });

  let handle: unknown = null;
  let cancelled = false;

  const schedule = (session: Session): void => {
    if (cancelled) return;
    const plan = planRefresh(session, now());
    if (plan.action === 'expired') {
      options.onExpired(plan.reason);
      return;
    }
    if (plan.action === 'warn') {
      options.onWarn(plan.endsAt, plan.millisLeft);
      // Re-check at the ceiling itself so the sign-out is explained, not silent.
      handle = setTimer(() => { options.onExpired('absolute'); }, plan.millisLeft);
      return;
    }
    handle = setTimer(() => {
      void (async () => {
        const refreshed = await options.refresh();
        if (cancelled) return;
        if (refreshed === null) {
          // The edge refused. It cannot tell us why without leaking, so we
          // report the limit we can actually see coming.
          const plan2 = planRefresh(session, now());
          options.onExpired(plan2.action === 'expired' ? plan2.reason : 'idle');
          return;
        }
        options.onRefreshed(refreshed);
        schedule(refreshed);
      })();
    }, plan.delayMs);
  };

  if (options.session !== null) schedule(options.session);

  return () => {
    cancelled = true;
    if (handle !== null) clearTimer(handle);
  };
}
