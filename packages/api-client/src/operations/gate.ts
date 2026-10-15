// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — single-use admission at the venue gate (BUILD-003, ADR-034)
//
// The gate's refusals (already admitted, impostor, wrong venue, wrong day,
// invalid ticket…) are the screen's normal answers, so they come back as a
// GateAdmissionResult, never as a thrown error. Only infrastructure faults —
// network, 5xx, 401/403, an off-contract body — throw ApiError.
//
// A write that spends a credential is NEVER retried by this client: a replay
// after an uncertain response would read ALREADY_ADMITTED and look like fraud.
// ══════════════════════════════════════════════════════════════════

import { ApiError } from '../errors.js';
import type { ApiClient } from '../transport.js';
import type { AdmitAtGateInput, GateAdmissionResult, GateCandidate, InvalidTicketReason } from '../wire.js';

const INVALID_REASONS: ReadonlySet<string> = new Set(['MALFORMED_TICKET', 'WRONG_AGENCY', 'UNKNOWN_TICKET', 'TICKET_NOT_ISSUED']);

function candidateOf(v: unknown): GateCandidate | null {
  if (v === null || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  const { applicationId, processingCode, category } = c;
  if (typeof applicationId !== 'string' || typeof processingCode !== 'string' || typeof category !== 'string') return null;
  return { applicationId, processingCode, category };
}

/**
 * PURE. Turn a 409/422 gate refusal into its result, or null when the body is
 * not one of the documented shapes (the caller rethrows).
 */
export function gateResultFromRefusal(
  status: 409 | 422,
  outcome: string,
  data: Readonly<Record<string, unknown>>,
): GateAdmissionResult | null {
  if (status === 422) {
    const reason = data['reason'];
    return outcome === 'INVALID_TICKET' && typeof reason === 'string' && INVALID_REASONS.has(reason)
      ? { outcome: 'INVALID_TICKET', reason: reason as InvalidTicketReason }
      : null;
  }
  const candidate = candidateOf(data['candidate']);
  switch (outcome) {
    case 'ALREADY_ADMITTED': {
      const { admittedAt, venueName, admittedBySelf } = data;
      if (candidate === null || typeof admittedAt !== 'string' || typeof venueName !== 'string' || typeof admittedBySelf !== 'boolean') return null;
      return { outcome, candidate, admittedAt, venueName, admittedBySelf };
    }
    case 'NOT_ADMISSIBLE': {
      const currentStatus = data['currentStatus'];
      return candidate !== null && typeof currentStatus === 'string' ? { outcome, candidate, currentStatus } : null;
    }
    case 'IDENTITY_MISMATCH':
      return candidate !== null ? { outcome, candidate } : null;
    case 'WRONG_VENUE': {
      const ticketVenueName = data['ticketVenueName'];
      return typeof ticketVenueName === 'string' ? { outcome, ticketVenueName } : null;
    }
    case 'TOO_EARLY':
    case 'EXPIRED': {
      const examDate = data['examDate'];
      return typeof examDate === 'string' ? { outcome, examDate } : null;
    }
    default:
      return null;
  }
}

/** Spend the QR at the gate (needs admission.gate). */
export async function admitAtGate(client: ApiClient, input: AdmitAtGateInput): Promise<GateAdmissionResult> {
  try {
    return await client.call<GateAdmissionResult>('admitAtGate', { body: input });
  } catch (error) {
    if (error instanceof ApiError) {
      const n = error.normalised;
      if (n.kind === 'conflict' || n.kind === 'unprocessable') {
        const result = gateResultFromRefusal(n.status, n.outcome, n.data);
        if (result !== null) return result;
      }
    }
    throw error;
  }
}
