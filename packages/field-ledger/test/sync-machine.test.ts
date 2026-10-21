import { describe, expect, it } from 'vitest';
import { NOT_ACCEPTED_STATES, SYNC_STATES, TERMINAL_STATES, transition, type SyncEvent, type SyncState } from '../src/sync-machine.ts';

const PILOT = { offlineQueue: false };
const QUEUE = { offlineQueue: true };
const EVENTS: readonly SyncEvent[] = [
  { type: 'ENQUEUE' },
  { type: 'SEND' },
  { type: 'ACK', outcome: 'ACCEPTED' },
  { type: 'ACK', outcome: 'DUPLICATE_REPLAY' },
  { type: 'ACK', outcome: 'REJECTED_VALIDATION', reason: 'BAD_SIGNATURE' },
  { type: 'ACK', outcome: 'STALE_CONFLICT', reason: 'CONFLICT' },
  { type: 'SEND_UNCERTAIN' },
  { type: 'ESCALATE' },
  { type: 'RESOLVED' },
];
const label = (e: SyncEvent): string => (e.type === 'ACK' ? `ACK:${e.outcome}` : e.type);

describe('sync state machine — the full table', () => {
  it('is total and matches the ADR-FE-010 table with an offline queue', () => {
    const table: Record<string, Record<string, string>> = {};
    for (const state of SYNC_STATES) {
      table[state] = {};
      for (const event of EVENTS) {
        const r = transition(state, event, QUEUE);
        if (r.ok) table[state]![label(event)] = r.state;
      }
    }
    expect(table).toEqual({
      LOCAL_ONLY: { ENQUEUE: 'QUEUED', SEND: 'SENDING' },
      QUEUED: { SEND: 'SENDING' },
      SENDING: {
        'ACK:ACCEPTED': 'ACCEPTED',
        'ACK:DUPLICATE_REPLAY': 'DUPLICATE_REPLAY',
        'ACK:REJECTED_VALIDATION': 'REJECTED_VALIDATION',
        'ACK:STALE_CONFLICT': 'STALE_CONFLICT',
        SEND_UNCERTAIN: 'QUEUED',
      },
      ACCEPTED: {},
      DUPLICATE_REPLAY: {},
      REJECTED_VALIDATION: {},
      STALE_CONFLICT: { ESCALATE: 'NEEDS_SUPERVISOR' },
      NEEDS_SUPERVISOR: { RESOLVED: 'RESOLVED' },
      RESOLVED: {},
    });
  });

  it('in pilot mode an offline record cannot be queued and an uncertain send returns to LOCAL_ONLY', () => {
    const enqueue = transition('LOCAL_ONLY', { type: 'ENQUEUE' }, PILOT);
    expect(enqueue.ok).toBe(false);
    expect(enqueue.state).toBe('LOCAL_ONLY');
    expect(transition('SENDING', { type: 'SEND_UNCERTAIN' }, PILOT)).toEqual({ ok: true, state: 'LOCAL_ONLY' });
  });

  it('a refused event never changes the state', () => {
    for (const state of SYNC_STATES) {
      for (const event of EVENTS) {
        const r = transition(state, event, QUEUE);
        if (!r.ok) expect(r.state).toBe(state);
      }
    }
  });

  it('keeps the rejection reason with the ACK', () => {
    expect(transition('SENDING', { type: 'ACK', outcome: 'REJECTED_VALIDATION', reason: 'BAD_SIGNATURE' }, QUEUE)).toEqual({
      ok: true,
      state: 'REJECTED_VALIDATION',
      reason: 'BAD_SIGNATURE',
    });
  });

  it('never classifies an unaccepted record as terminal-success', () => {
    const success: readonly SyncState[] = ['ACCEPTED', 'DUPLICATE_REPLAY', 'RESOLVED'];
    for (const state of success) expect(NOT_ACCEPTED_STATES.has(state)).toBe(false);
    expect([...TERMINAL_STATES].sort()).toEqual(['ACCEPTED', 'DUPLICATE_REPLAY', 'REJECTED_VALIDATION', 'RESOLVED']);
    expect(NOT_ACCEPTED_STATES.size + success.length).toBe(SYNC_STATES.length);
  });
});
