// ══════════════════════════════════════════════════════════════════
// The field record envelope (ADR-FE-010, baseline §15.3).
//
// Every record a station captures is wrapped in this envelope before it is
// stored: who captured it, where, on which device and key, when (with how far
// the device clock can be trusted), its position in this device's log, a
// digest of its payload, and a signature over all of it. A correction never
// overwrites: it is a new record that names the one it `supersedes`.
//
// The ledger knows no domain vocabulary: `kind` and `payload` are opaque here
// and owned by the feature that appends (field-ops in S08).
// ══════════════════════════════════════════════════════════════════

/** How far the capture time can be trusted (skew measured against the edge `Date`). */
export type ClockConfidence = 'SYNCED' | 'SKEWED' | 'UNKNOWN';

export interface RecordSubject {
  /** The application the record is about, when known. */
  readonly applicationId?: string;
  /** An opaque ticket reference (never the QR credential itself). */
  readonly ticketRef?: string;
}

export interface RecordContext {
  readonly campaignCode: string;
  readonly policyHash: string;
  readonly venue: string;
  readonly examDay: string;
  readonly station: string;
  /** The officer's opaque subject id from the session, never a name. */
  readonly officerSubject: string;
}

export interface RecordDraft<P = unknown> {
  readonly kind: string;
  readonly schemaVersion: number;
  readonly subject: RecordSubject;
  readonly context: RecordContext;
  readonly payload: P;
  readonly supersedes?: string;
}

export interface UnsignedEnvelope<P = unknown> extends RecordDraft<P> {
  readonly recordId: string;
  readonly deviceId: string;
  readonly keyId: string;
  readonly capturedAt: string;
  readonly timeZone: string;
  readonly clockConfidence: ClockConfidence;
  readonly localSequence: number;
  readonly payloadDigest: string;
}

export interface SignedEnvelope<P = unknown> extends UnsignedEnvelope<P> {
  /** Ed25519 over canonicalJson(unsigned envelope), base64url. */
  readonly signature: string;
}

/** What the signature covers: the whole envelope except the signature. */
export function signingInput<P>(envelope: UnsignedEnvelope<P> | SignedEnvelope<P>): UnsignedEnvelope<P> {
  const { signature: _signature, ...unsigned } = envelope as SignedEnvelope<P>;
  return unsigned;
}

/** PURE structural checks a record must pass before it is stored or sent. */
export function envelopeProblems(envelope: SignedEnvelope): readonly string[] {
  const problems: string[] = [];
  const nonEmpty = (value: unknown, name: string): void => {
    if (typeof value !== 'string' || value.trim() === '') problems.push(`${name} is required`);
  };
  nonEmpty(envelope.recordId, 'recordId');
  nonEmpty(envelope.kind, 'kind');
  nonEmpty(envelope.deviceId, 'deviceId');
  nonEmpty(envelope.keyId, 'keyId');
  nonEmpty(envelope.context?.officerSubject, 'context.officerSubject');
  nonEmpty(envelope.payloadDigest, 'payloadDigest');
  nonEmpty(envelope.signature, 'signature');
  if (!Number.isInteger(envelope.schemaVersion) || envelope.schemaVersion < 1) problems.push('schemaVersion must be a positive integer');
  if (!Number.isInteger(envelope.localSequence) || envelope.localSequence < 1) problems.push('localSequence must be a positive integer');
  if (Number.isNaN(Date.parse(envelope.capturedAt))) problems.push('capturedAt must be an ISO timestamp');
  if (envelope.supersedes !== undefined && envelope.supersedes === envelope.recordId) problems.push('a record cannot supersede itself');
  return problems;
}
