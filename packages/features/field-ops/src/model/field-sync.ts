// ══════════════════════════════════════════════════════════════════
// field-ops — physical capture on the ledger, and its honest sync (S08)
//
// PURE where it can be; the two I/O parts take their ports as arguments.
//
//   capture   write the record to the ledger FIRST (LOCAL_ONLY, signed with the
//             envelope signature), then send it deliberately.
//   toWire    the server verifies a SECOND signature over its own canonical
//             payload (shared-security verifyFieldScoreRecord): Ed25519, standard
//             base64, over canonicalJson of
//             { applicationId, qrInvitationCode, metrics, capturedAt, deviceId,
//               capturingOfficerId, vectorClock }, plus sha256-hex of the metrics.
//             Signed here with the SAME non-extractable device key.
//   send      SENDING, then one syncFieldScores call (never retried), then ONE
//             event per record from the real response union (ledger
//             eventsForBatch). An HTTP 200 alone moves nothing: only a per-record
//             answer does. No answer at all returns the record to LOCAL_ONLY, so
//             "synced" is never claimed without a server acknowledgement.
// ══════════════════════════════════════════════════════════════════

import {
  canonicalJson, eventsForBatch, fromBase64Url, sha256Hex, toBase64,
  type Ledger, type SignerPort, type StoredRecord, type SyncState,
} from '@usrp/field-ledger';
import type { FieldScoreWireRecord, FieldSyncAnswer } from '@usrp/api-client';
import type { PhysicalMetrics } from './physical.ts';
import type { TicketRef } from './ticket.ts';
import type { VenueDay } from './venue.ts';

export const PHYSICAL_KIND = 'physical-score';
export const PHYSICAL_SCHEMA_VERSION = 1;

export interface PhysicalPayload { readonly metrics: PhysicalMetrics }

/** What a station shows about a record. */
export type RecordFate = 'ACKNOWLEDGED' | 'DUPLICATE' | 'REFUSED' | 'CONFLICT' | 'WAITING' | 'SENDING' | 'WITH_SUPERVISOR' | 'RESOLVED';

export function fateOf(state: SyncState): RecordFate {
  switch (state) {
    case 'ACCEPTED': return 'ACKNOWLEDGED';
    case 'DUPLICATE_REPLAY': return 'DUPLICATE';
    case 'REJECTED_VALIDATION': return 'REFUSED';
    case 'STALE_CONFLICT': return 'CONFLICT';
    case 'NEEDS_SUPERVISOR': return 'WITH_SUPERVISOR';
    case 'RESOLVED': return 'RESOLVED';
    case 'SENDING': return 'SENDING';
    case 'LOCAL_ONLY':
    case 'QUEUED': return 'WAITING';
  }
}

/** The ONLY fates a screen may call "saved on the server". */
export const isServerAcknowledged = (state: SyncState): boolean => state === 'ACCEPTED' || state === 'DUPLICATE_REPLAY' || state === 'RESOLVED';

export interface CaptureInput {
  readonly ticket: TicketRef;
  readonly metrics: PhysicalMetrics;
  readonly day: VenueDay;
  readonly officerSubject: string;
}

/** Append the capture to the ledger. Local first; nothing is sent here. */
export function capturePhysical(ledger: Ledger, input: CaptureInput): Promise<StoredRecord> {
  return ledger.append<PhysicalPayload>({
    kind: PHYSICAL_KIND,
    schemaVersion: PHYSICAL_SCHEMA_VERSION,
    subject: { applicationId: input.ticket.applicationId, ticketRef: input.ticket.ticketId },
    context: {
      campaignCode: input.day.campaign,
      policyHash: 'UNSET',
      venue: input.day.venueName,
      examDay: input.day.examDate,
      station: 'physical',
      officerSubject: input.officerSubject,
    },
    payload: { metrics: input.metrics },
  });
}

/** base64url → standard base64. */
const base64FromUrl = (value: string): string => toBase64(fromBase64Url(value));

/** The wire record for a stored physical capture, signed with the device key. Throws if it is not a well-formed capture. */
export async function toWireRecord(record: StoredRecord, signer: SignerPort): Promise<FieldScoreWireRecord> {
  const e = record.envelope;
  const payload = e.payload as Partial<PhysicalPayload> | null;
  const applicationId = e.subject.applicationId;
  const ticket = e.subject.ticketRef;
  if (e.kind !== PHYSICAL_KIND || payload?.metrics === undefined || applicationId === undefined || ticket === undefined) {
    throw new Error('not a sendable physical capture');
  }
  const metrics = payload.metrics;
  const signable = {
    applicationId,
    qrInvitationCode: ticket,
    metrics,
    capturedAt: e.capturedAt,
    deviceId: e.deviceId,
    capturingOfficerId: e.context.officerSubject,
    vectorClock: { [e.deviceId]: e.localSequence },
  };
  const signature = await signer.sign(new TextEncoder().encode(canonicalJson(signable)));
  return { ...signable, deviceSignature: base64FromUrl(signature), signedPayloadHash: await sha256Hex(canonicalJson(metrics)) };
}

export type SendSync = (records: readonly FieldScoreWireRecord[]) => Promise<FieldSyncAnswer>;

export interface SendResult {
  readonly recordId: string;
  readonly state: SyncState;
  readonly reason?: string;
}

/**
 * Send the given records in ONE batch and apply the per-record answers.
 * Records not in LOCAL_ONLY/QUEUED are skipped (a record is sent once; a replay
 * of an uncertain send is the next DELIBERATE press, and the server answers the
 * same signed payload with DUPLICATE).
 */
export async function sendRecords(ledger: Ledger, signer: SignerPort, send: SendSync, records: readonly StoredRecord[]): Promise<readonly SendResult[]> {
  const sendable = records.filter((r) => r.envelope.kind === PHYSICAL_KIND && (r.state === 'LOCAL_ONLY' || r.state === 'QUEUED'));
  if (sendable.length === 0) return [];
  const wires: FieldScoreWireRecord[] = [];
  const sent: StoredRecord[] = [];
  for (const record of sendable) {
    try {
      wires.push(await toWireRecord(record, signer));
      sent.push(record);
    } catch {
      await ledger.apply(record.envelope.recordId, { type: 'SEND' });
      await ledger.apply(record.envelope.recordId, { type: 'ACK', outcome: 'REJECTED_VALIDATION', reason: 'NOT_SENDABLE' });
    }
  }
  for (const record of sent) await ledger.apply(record.envelope.recordId, { type: 'SEND' });
  const answer = sent.length === 0 ? { httpStatus: null, body: null } : await send(wires);
  const events = eventsForBatch(
    sent.map((r) => ({ recordId: r.envelope.recordId, applicationId: r.envelope.subject.applicationId ?? '', deviceId: r.envelope.deviceId })),
    answer.httpStatus,
    answer.body,
  );
  for (const record of sent) {
    const event = events.get(record.envelope.recordId) ?? { type: 'SEND_UNCERTAIN' as const };
    await ledger.apply(record.envelope.recordId, event);
  }
  const after = new Map((await ledger.list()).map((r) => [r.envelope.recordId, r] as const));
  return sendable.map((r) => {
    const now = after.get(r.envelope.recordId);
    return { recordId: r.envelope.recordId, state: now?.state ?? r.state, ...(now?.reason === undefined ? {} : { reason: now.reason }) };
  });
}

/** After a crash or reload: a record left SENDING has no known answer. It goes back to waiting, never to saved. */
export async function recoverInterrupted(ledger: Ledger): Promise<number> {
  let n = 0;
  for (const record of await ledger.list()) {
    if (record.state === 'SENDING') {
      await ledger.apply(record.envelope.recordId, { type: 'SEND_UNCERTAIN' });
      n += 1;
    }
  }
  return n;
}

export interface QueueSummary {
  readonly total: number;
  readonly acknowledged: number;
  readonly waiting: number;
  readonly refused: number;
  readonly conflicts: number;
  readonly lastAcknowledgedAt: string | null;
}

export function summarise(records: readonly StoredRecord[]): QueueSummary {
  let acknowledged = 0, waiting = 0, refused = 0, conflicts = 0;
  let last: string | null = null;
  for (const r of records) {
    if (isServerAcknowledged(r.state)) { acknowledged += 1; if (last === null || r.updatedAt > last) last = r.updatedAt; }
    else if (r.state === 'LOCAL_ONLY' || r.state === 'QUEUED' || r.state === 'SENDING') waiting += 1;
    else if (r.state === 'REJECTED_VALIDATION') refused += 1;
    else conflicts += 1;
  }
  return { total: records.length, acknowledged, waiting, refused, conflicts, lastAcknowledgedAt: last };
}
