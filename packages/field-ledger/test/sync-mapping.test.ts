import { describe, expect, it } from 'vitest';
import { RECORD_STATUSES, ackForResult, eventsForBatch, readResolveResponse, readSyncResponse } from '../src/sync-mapping.ts';

// Bodies shaped exactly as field-sync-service emits them at the pinned SHA
// (sync-scores.controller.ts + sync-field-scores.service.ts).
const A = 'a3f1c2d4-5b6e-4f70-8192-0a1b2c3d4e5f';
const B = 'b4e2d3c5-6f71-4a82-93a4-1b2c3d4e5f60';
const C = 'c5f3e4d6-7a82-4b93-a4b5-2c3d4e5f6071';

describe('syncFieldScores → per-record events', () => {
  it('maps every backend record status, totally', () => {
    const outcomes = Object.fromEntries(RECORD_STATUSES.map((status) => [status, ackForResult({ applicationId: A, deviceId: 'tab-014', status })]));
    expect(outcomes).toEqual({
      ACCEPTED: { type: 'ACK', outcome: 'ACCEPTED' },
      SUPERSEDED: { type: 'ACK', outcome: 'ACCEPTED' },
      CONFLICT: { type: 'ACK', outcome: 'STALE_CONFLICT', reason: 'CONFLICT' },
      STALE: { type: 'ACK', outcome: 'STALE_CONFLICT', reason: 'STALE' },
      DUPLICATE: { type: 'ACK', outcome: 'DUPLICATE_REPLAY' },
      NOT_FOUND: { type: 'ACK', outcome: 'REJECTED_VALIDATION', reason: 'NOT_FOUND' },
      REJECTED: { type: 'ACK', outcome: 'REJECTED_VALIDATION', reason: 'REJECTED' },
    });
  });

  it('a SYNCED batch where every record was forged accepts nothing', () => {
    const body = { status: 'SYNCED', results: [{ applicationId: A, deviceId: 'tab-014', status: 'REJECTED', reason: 'BAD_SIGNATURE' }] };
    expect(eventsForBatch([A], 200, body).get(A)).toEqual({ type: 'ACK', outcome: 'REJECTED_VALIDATION', reason: 'BAD_SIGNATURE' });
  });

  it('a record missing from the answer is uncertain, never saved', () => {
    const body = { status: 'SYNCED', results: [{ applicationId: A, deviceId: 'tab-014', status: 'ACCEPTED', scoreId: B }] };
    const events = eventsForBatch([A, C], 200, body);
    expect(events.get(A)).toEqual({ type: 'ACK', outcome: 'ACCEPTED' });
    expect(events.get(C)).toEqual({ type: 'SEND_UNCERTAIN' });
  });

  it('a whole-batch 400 rejects every record with its code', () => {
    expect(eventsForBatch([A, B], 400, { error: 'INVALID_RECORD', detail: 'x' }).get(B)).toEqual({ type: 'ACK', outcome: 'REJECTED_VALIDATION', reason: 'INVALID_RECORD' });
  });

  it('a network failure, a 5xx, or an off-contract 200 is uncertain', () => {
    expect(readSyncResponse(null, null)).toEqual({ kind: 'uncertain' });
    expect(readSyncResponse(503, { error: 'UPSTREAM_UNAVAILABLE' })).toEqual({ kind: 'uncertain' });
    expect(readSyncResponse(200, { status: 'PARTIAL', results: [] })).toEqual({ kind: 'uncertain' });
    // The frontend contract fixture's `outcome` key is not what the controller emits.
    expect(readSyncResponse(200, { status: 'SYNCED', results: [{ applicationId: A, outcome: 'ACCEPTED' }] })).toEqual({ kind: 'uncertain' });
  });
});

describe('resolveFieldSyncConflict', () => {
  it('reads the three documented answers and nothing else', () => {
    expect(readResolveResponse(200, { status: 'RESOLVED', applicationId: A, scoreId: B })).toEqual({ kind: 'resolved' });
    expect(readResolveResponse(409, { status: 'NO_CONFLICT' })).toEqual({ kind: 'resolved' });
    expect(readResolveResponse(404, { status: 'SCORE_NOT_FOUND' })).toEqual({ kind: 'refused', code: 'SCORE_NOT_FOUND' });
    expect(readResolveResponse(404, { status: 'NOT_FOUND' })).toEqual({ kind: 'refused', code: 'NOT_FOUND' });
    expect(readResolveResponse(200, { status: 'SYNCED' })).toEqual({ kind: 'uncertain' });
  });
});
