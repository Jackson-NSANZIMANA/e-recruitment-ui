// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — Field Station operations (S08)
//
// Enrolment, score sync and conflict resolution, plus the venue reads and the
// biometric policy. NONE of the writes is retried (registry: retryOnG2G false).
//
// The two sync writes answer with a FieldSyncAnswer instead of throwing: the
// per-record outcome IS the answer, and a caller (the field-ledger mapping)
// must tell "the server answered" from "no answer arrived" without a catch.
// ══════════════════════════════════════════════════════════════════

import { ApiError } from '../errors.js';
import type { ApiClient } from '../transport.js';
import type {
  BiometricPolicyResponse, EnrollFieldDeviceInput, EnrollFieldDeviceResponse, FieldScoreWireRecord,
  FieldSyncAnswer, ResolveFieldConflictInput, VenueLiveCountsResponse, VenueQuery, VenueRosterResponse,
} from '../wire.js';

/** 201 ENROLLED, 200 ALREADY_ENROLLED; a revoked id is a thrown 409 DEVICE_REVOKED. */
export const enrollFieldDevice = (client: ApiClient, input: EnrollFieldDeviceInput): Promise<EnrollFieldDeviceResponse> =>
  client.call<EnrollFieldDeviceResponse>('enrollFieldDevice', { body: input });

/** PURE. A thrown transport error as the answer the ledger mapping reads. */
export function answerFromError(error: unknown): FieldSyncAnswer {
  if (!(error instanceof ApiError)) return { httpStatus: null, body: null };
  const n = error.normalised;
  switch (n.kind) {
    case 'badRequest': return { httpStatus: 400, body: { error: n.code } };
    case 'conflict': return { httpStatus: 409, body: { status: n.outcome, ...n.data } };
    case 'notFound': return { httpStatus: 404, body: { status: 'NOT_FOUND' } };
    case 'network': return { httpStatus: null, body: null };
    default: return { httpStatus: 'status' in n ? n.status : null, body: null };
  }
}

/** The envelope the field-sync service answers with; per-record results are read by the ledger mapper, not here. */
export interface FieldSyncWireBody { readonly status?: string; readonly results?: readonly object[] }

export async function syncFieldScores(client: ApiClient, records: readonly FieldScoreWireRecord[], correlationId?: string): Promise<FieldSyncAnswer> {
  try {
    const body = await client.call<FieldSyncWireBody>('syncFieldScores', { body: { records }, ...(correlationId === undefined ? {} : { correlationId }) });
    return { httpStatus: 200, body };
  } catch (error) {
    return answerFromError(error);
  }
}

export async function resolveFieldSyncConflict(client: ApiClient, input: ResolveFieldConflictInput, correlationId?: string): Promise<FieldSyncAnswer> {
  try {
    const body = await client.call<FieldSyncWireBody>('resolveFieldSyncConflict', { body: input, ...(correlationId === undefined ? {} : { correlationId }) });
    return { httpStatus: 200, body };
  } catch (error) {
    return answerFromError(error);
  }
}

const venueQuery = (q: VenueQuery): Record<string, string> => ({ campaign: q.campaign, district: q.district, examDate: q.examDate });

export const getVenueRoster = (client: ApiClient, q: VenueQuery): Promise<VenueRosterResponse> =>
  client.call<VenueRosterResponse>('getVenueRoster', { query: venueQuery(q) });

export const getVenueLiveCounts = (client: ApiClient, q: VenueQuery): Promise<VenueLiveCountsResponse> =>
  client.call<VenueLiveCountsResponse>('getVenueLiveCounts', { query: venueQuery(q) });

/** In SHADOW the device captures nothing it displays; in OFF it captures nothing. */
export const getBiometricPolicy = (client: ApiClient): Promise<BiometricPolicyResponse> =>
  client.call<BiometricPolicyResponse>('getBiometricPolicy');
