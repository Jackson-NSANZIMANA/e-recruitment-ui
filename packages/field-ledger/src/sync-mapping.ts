// ══════════════════════════════════════════════════════════════════
// Real response variants → sync events (ADR-FE-010). PURE.
//
// TRANSCRIBED FROM THE BACKEND SOURCE at the pinned SHA, not from the
// frontend's hand-authored contract:
//   field-sync-service sync-scores.controller.ts returns
//     200 { status: 'SYNCED', results: RecordSyncResult[] }
//   where RecordSyncResult = { applicationId, deviceId, status, reason?, scoreId? }
//   and status ∈ ACCEPTED | SUPERSEDED | CONFLICT | STALE | DUPLICATE | NOT_FOUND | REJECTED
//   (application/sync-field-scores.service.ts), reason ∈ UNENROLLED_DEVICE |
//   REVOKED_DEVICE | AGENCY_MISMATCH | BAD_SIGNATURE | TICKET_MISMATCH | NOT_ADMITTED.
//   A malformed batch is a whole-batch 400 INVALID_BATCH | INVALID_RECORD.
//   resolve-conflict.controller.ts returns 200 { status: 'RESOLVED', ... },
//   404 { status: 'NOT_FOUND' | 'SCORE_NOT_FOUND' }, 409 { status: 'NO_CONFLICT' }.
//
// NOTE for S08: packages/contracts/openapi/field-sync-service.yaml types each
// result as an open record and its fixtures use `outcome` where the controller
// emits `status`. These mappers follow the controller; the contract document
// needs correcting when the field-sync screens consume it.
//
// The batch `status: 'SYNCED'` says the batch was PROCESSED, never that a
// record was accepted. Only the per-record status moves a record.
// ══════════════════════════════════════════════════════════════════

import type { AckOutcome, SyncEvent } from './sync-machine.ts';

export const RECORD_STATUSES = ['ACCEPTED', 'SUPERSEDED', 'CONFLICT', 'STALE', 'DUPLICATE', 'NOT_FOUND', 'REJECTED'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export interface RecordSyncResult {
  readonly applicationId: string;
  readonly deviceId: string;
  readonly status: RecordStatus;
  readonly reason?: string;
  readonly scoreId?: string;
}

const OUTCOME: Readonly<Record<RecordStatus, AckOutcome>> = {
  ACCEPTED: 'ACCEPTED',
  // A dominating correction is stored as the new head: accepted.
  SUPERSEDED: 'ACCEPTED',
  DUPLICATE: 'DUPLICATE_REPLAY',
  // Concurrent with a stored head: both kept, the application is HELD for a human.
  CONFLICT: 'STALE_CONFLICT',
  // Dominated by what the server already holds: not applied; a supervisor decides.
  STALE: 'STALE_CONFLICT',
  NOT_FOUND: 'REJECTED_VALIDATION',
  REJECTED: 'REJECTED_VALIDATION',
};

/** One per-record result → the ACK event for that record. Total over RecordStatus. */
export function ackForResult(result: RecordSyncResult): SyncEvent {
  const outcome = OUTCOME[result.status];
  const reason = result.status === 'REJECTED' ? (result.reason ?? 'REJECTED') : result.status === 'NOT_FOUND' || result.status === 'STALE' || result.status === 'CONFLICT' ? result.status : undefined;
  return reason === undefined ? { type: 'ACK', outcome } : { type: 'ACK', outcome, reason };
}

export type SyncResponseReading =
  | { readonly kind: 'per-record'; readonly results: readonly RecordSyncResult[] }
  | { readonly kind: 'batch-rejected'; readonly code: 'INVALID_BATCH' | 'INVALID_RECORD' }
  | { readonly kind: 'uncertain' };

function isResult(value: unknown): value is RecordSyncResult {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r['applicationId'] === 'string' && typeof r['deviceId'] === 'string' && (RECORD_STATUSES as readonly unknown[]).includes(r['status']);
}

/**
 * Read a syncFieldScores HTTP answer. Anything off-contract is `uncertain`:
 * the records go back to waiting (SEND_UNCERTAIN), never to "saved".
 */
export function readSyncResponse(httpStatus: number | null, body: unknown): SyncResponseReading {
  if (httpStatus === 400 && body !== null && typeof body === 'object') {
    const code = (body as Record<string, unknown>)['error'];
    if (code === 'INVALID_BATCH' || code === 'INVALID_RECORD') return { kind: 'batch-rejected', code };
  }
  if (httpStatus !== 200 || body === null || typeof body !== 'object') return { kind: 'uncertain' };
  const b = body as Record<string, unknown>;
  if (b['status'] !== 'SYNCED' || !Array.isArray(b['results']) || !b['results'].every(isResult)) return { kind: 'uncertain' };
  return { kind: 'per-record', results: b['results'] };
}

/** One record as it was sent in a batch, in order. */
export interface SentRecord {
  readonly recordId: string;
  readonly applicationId: string;
  readonly deviceId: string;
}

/**
 * The event for each sent record, keyed by recordId, from one sync answer.
 *
 * The backend echoes no recordId: sync-field-scores.service.ts returns exactly
 * one result per uploaded record, IN UPLOAD ORDER (`for (const record of
 * command.records) results.push(...)`). So results are paired POSITIONALLY,
 * and each pair must also agree on applicationId and deviceId. Keying by
 * applicationId would collapse two records for one application (a capture and
 * its correction) into one ACK. Any disagreement — a different count, or a
 * pair that does not match — makes the whole batch uncertain, never saved.
 */
export function eventsForBatch(sent: readonly SentRecord[], httpStatus: number | null, body: unknown): ReadonlyMap<string, SyncEvent> {
  const reading = readSyncResponse(httpStatus, body);
  const events = new Map<string, SyncEvent>();
  const paired =
    reading.kind === 'per-record' &&
    reading.results.length === sent.length &&
    reading.results.every((result, i) => result.applicationId === sent[i]!.applicationId && result.deviceId === sent[i]!.deviceId);
  sent.forEach((record, i) => {
    if (reading.kind === 'batch-rejected') events.set(record.recordId, { type: 'ACK', outcome: 'REJECTED_VALIDATION', reason: reading.code });
    else if (paired && reading.kind === 'per-record') events.set(record.recordId, ackForResult(reading.results[i]!));
    else events.set(record.recordId, { type: 'SEND_UNCERTAIN' });
  });
  return events;
}

export type ResolveReading =
  | { readonly kind: 'resolved' }
  | { readonly kind: 'refused'; readonly code: 'NOT_FOUND' | 'SCORE_NOT_FOUND' }
  | { readonly kind: 'uncertain' };

/** Read a resolveFieldSyncConflict answer. NO_CONFLICT means nothing is held any more: resolved. */
export function readResolveResponse(httpStatus: number | null, body: unknown): ResolveReading {
  const status = body !== null && typeof body === 'object' ? (body as Record<string, unknown>)['status'] : undefined;
  if (httpStatus === 200 && status === 'RESOLVED') return { kind: 'resolved' };
  if (httpStatus === 409 && status === 'NO_CONFLICT') return { kind: 'resolved' };
  if (httpStatus === 404 && (status === 'NOT_FOUND' || status === 'SCORE_NOT_FOUND')) return { kind: 'refused', code: status };
  return { kind: 'uncertain' };
}
