// ══════════════════════════════════════════════════════════════════
// The client sync state machine (ADR-FE-010). PURE and TOTAL.
//
//   LOCAL_ONLY ─SEND─► SENDING ─ACK──► ACCEPTED | DUPLICATE_REPLAY
//       │                 │       └──► REJECTED_VALIDATION
//    ENQUEUE              │       └──► STALE_CONFLICT ─ESCALATE─► NEEDS_SUPERVISOR ─RESOLVED─► RESOLVED
//       ▼                 └─SEND_UNCERTAIN─► QUEUED (only when queueing is allowed)
//    QUEUED ─SEND─► SENDING                    LOCAL_ONLY (pilot mode: stays local, use the paper sheet)
//
// Rules this encodes, each from AGENTS.md §2 or the plan §2.5:
//   • A record is written locally FIRST, always. LOCAL_ONLY is its first state.
//   • No state is inferred from an HTTP 200: only a per-record ACK moves a
//     record out of SENDING (sync-mapping.ts maps the real response variants).
//   • Nothing is retried automatically. An uncertain send goes back to QUEUED
//     (or LOCAL_ONLY in pilot mode) and waits for the next deliberate send;
//     the server answers a replay of the same signed payload with DUPLICATE.
//   • While OFFLINE_CAPTURE_CAN_SYNC is false (pilot), ENQUEUE is refused: an
//     offline record stays LOCAL_ONLY, labelled "not accepted — use paper".
// ══════════════════════════════════════════════════════════════════

export const SYNC_STATES = [
  'LOCAL_ONLY',
  'QUEUED',
  'SENDING',
  'ACCEPTED',
  'DUPLICATE_REPLAY',
  'REJECTED_VALIDATION',
  'STALE_CONFLICT',
  'NEEDS_SUPERVISOR',
  'RESOLVED',
] as const;
export type SyncState = (typeof SYNC_STATES)[number];

export type AckOutcome = 'ACCEPTED' | 'DUPLICATE_REPLAY' | 'REJECTED_VALIDATION' | 'STALE_CONFLICT';

export type SyncEvent =
  | { readonly type: 'ENQUEUE' }
  | { readonly type: 'SEND' }
  | { readonly type: 'ACK'; readonly outcome: AckOutcome; readonly reason?: string }
  | { readonly type: 'SEND_UNCERTAIN' }
  | { readonly type: 'ESCALATE' }
  | { readonly type: 'RESOLVED' };

export interface SyncPolicy {
  /** OFFLINE_CAPTURE_CAN_SYNC: whether a deferred offline queue exists at all. */
  readonly offlineQueue: boolean;
}

export type TransitionResult =
  | { readonly ok: true; readonly state: SyncState; readonly reason?: string }
  | { readonly ok: false; readonly state: SyncState; readonly refused: string };

export const TERMINAL_STATES: ReadonlySet<SyncState> = new Set(['ACCEPTED', 'DUPLICATE_REPLAY', 'REJECTED_VALIDATION', 'RESOLVED']);

/** States in which the record has NOT been accepted by the server. A UI must never show these as saved. */
export const NOT_ACCEPTED_STATES: ReadonlySet<SyncState> = new Set(['LOCAL_ONLY', 'QUEUED', 'SENDING', 'REJECTED_VALIDATION', 'STALE_CONFLICT', 'NEEDS_SUPERVISOR']);

export function transition(state: SyncState, event: SyncEvent, policy: SyncPolicy): TransitionResult {
  const refuse = (why: string): TransitionResult => ({ ok: false, state, refused: why });
  switch (event.type) {
    case 'ENQUEUE':
      if (state !== 'LOCAL_ONLY') return refuse(`ENQUEUE from ${state}`);
      if (!policy.offlineQueue) return refuse('offline queue disabled (OFFLINE_CAPTURE_CAN_SYNC=false): the record stays LOCAL_ONLY');
      return { ok: true, state: 'QUEUED' };
    case 'SEND':
      return state === 'LOCAL_ONLY' || state === 'QUEUED' ? { ok: true, state: 'SENDING' } : refuse(`SEND from ${state}`);
    case 'ACK':
      if (state !== 'SENDING') return refuse(`ACK from ${state}`);
      return event.reason === undefined ? { ok: true, state: event.outcome } : { ok: true, state: event.outcome, reason: event.reason };
    case 'SEND_UNCERTAIN':
      if (state !== 'SENDING') return refuse(`SEND_UNCERTAIN from ${state}`);
      return { ok: true, state: policy.offlineQueue ? 'QUEUED' : 'LOCAL_ONLY' };
    case 'ESCALATE':
      return state === 'STALE_CONFLICT' ? { ok: true, state: 'NEEDS_SUPERVISOR' } : refuse(`ESCALATE from ${state}`);
    case 'RESOLVED':
      return state === 'NEEDS_SUPERVISOR' ? { ok: true, state: 'RESOLVED' } : refuse(`RESOLVED from ${state}`);
  }
}
