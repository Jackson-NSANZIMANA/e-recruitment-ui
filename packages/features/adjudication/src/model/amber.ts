// ══════════════════════════════════════════════════════════════════
// adjudication — the officer review read (S06 + D10). Pure.
//
// ONE ENDPOINT, THREE DIFFERENT THINGS. `GET /edge/v1/applications/amber-queue`
// serves everything a human must look at, and since S12b that is not only the
// two holds it was named after:
//
//   DOCUMENT       DOCUMENT_REVIEW_AMBER   documents the analyser could not
//                                          clear; carries forensic signals
//   ADJUDICATION   ADJUDICATION_REVIEW     a late disqualifying verdict that
//                                          arrived after the eligibility
//                                          terminal; no document to look at
//   REGISTRY       anything else           a LIVE row whose criminal clearance
//                                          or academic record is UNDER_REVIEW
//
// ONLY THE FIRST TWO ARE ACTIONABLE. The adjudicate transaction accepts exactly
// `ADJUDICATION_REVIEW` and `DOCUMENT_REVIEW_AMBER` (backend
// officer-transition.pg-repository.ts, `ADJUDICABLE`) and answers
// NOT_APPLICABLE to anything else, and no other officer operation resolves a
// registry review yet (defect D10, open). Offering CLEAR or REJECT on a REGISTRY
// row therefore offers a button whose only outcome is a refusal, which is why
// `isActionableHold` exists and why the queue screen reads it.
//
// The third kind used to be invisible: the screen filtered every row whose
// status was not one of the two holds, while the dashboard counted all of them.
// The officer saw "N awaiting adjudication" and fewer than N rows, with nothing
// anywhere to explain the difference.
// ══════════════════════════════════════════════════════════════════

import type { ApplicationStatus, DocumentType } from '@usrp/contracts';

export interface AmberRow {
  readonly applicationId: string;
  readonly processingCode: string;
  /** `null` only when the edge sent a row without one. Such a row is listed, never acted on. */
  readonly status: ApplicationStatus | null;
  readonly documentType: DocumentType | null;
  readonly forensicsScore: number | null;
  readonly forensicsFlags: Readonly<Record<string, boolean>> | null;
  readonly queuedAt: string | null;
  /** S12b closed codes; empty when the edge sent none. Never inferred by this model. */
  readonly reasons: readonly string[];
}

export type HoldKind = 'DOCUMENT' | 'ADJUDICATION' | 'REGISTRY';

/**
 * The two statuses the backend's adjudicate transaction accepts — BACKEND FACT,
 * mirrored here and imported by `queues.ts`, so the button rule and the hold
 * rule cannot drift apart. Cross-checked by a test against `holdKindOf`.
 */
export const ADJUDICABLE_STATUSES: ReadonlySet<string> = new Set<string>(['DOCUMENT_REVIEW_AMBER', 'ADJUDICATION_REVIEW']);

/** PURE. Which of the three things this row is. */
export function holdKindOf(row: Pick<AmberRow, 'status'>): HoldKind {
  if (row.status === 'DOCUMENT_REVIEW_AMBER') return 'DOCUMENT';
  if (row.status === 'ADJUDICATION_REVIEW') return 'ADJUDICATION';
  return 'REGISTRY';
}

/**
 * PURE. Whether this console can RECORD a decision on the row.
 *
 * A capability of the backend, not a permission: an officer with
 * `adjudication.decide` still gets no decision on a REGISTRY row, because the
 * server has no operation for it. Permissions are applied on top of this.
 */
export const isActionableHold = (kind: HoldKind): boolean => kind !== 'REGISTRY';

/** Registry reason codes that name WHICH registry is waiting on a person. */
const CRIMINAL_CODES: ReadonlySet<string> = new Set(['CRIMINAL_RECORD_REVIEW', 'CLEARANCE_CONTENT_REVIEW']);
const ACADEMIC_CODES: ReadonlySet<string> = new Set(['NESA_MALPRACTICE', 'NESA_LEVEL_UNKNOWN', 'NESA_DIVISION_NOT_PASS', 'NESA_RECORD_REVIEW']);

export type RegistryHold = 'CRIMINAL' | 'ACADEMIC';

/**
 * PURE. Which registry a REGISTRY hold waits on, or `null` when the codes do
 * not say. `null` is a real answer — a pre-S12b edge sends no reasons at all,
 * and the RIB-by-hash path records none — so the screen must say "not stated"
 * rather than guess a registry. Criminal wins a row that waits on both, because
 * it is the more consequential of the two.
 */
export function registryHoldOf(reasons: readonly string[]): RegistryHold | null {
  if (reasons.some((code) => CRIMINAL_CODES.has(code))) return 'CRIMINAL';
  if (reasons.some((code) => ACADEMIC_CODES.has(code))) return 'ACADEMIC';
  return null;
}

/** PURE. The codes actually present, de-duplicated and sorted: the queue's own answer to "why". */
export const reasonCodes = (row: Pick<AmberRow, 'reasons'>): readonly string[] => [...new Set(row.reasons)].sort();

/** PURE. A document hold with a forensic score is the only kind carrying document evidence. */
export const hasDocumentSignals = (row: Pick<AmberRow, 'status' | 'forensicsScore'>): boolean =>
  holdKindOf(row) === 'DOCUMENT' && row.forensicsScore !== null;

/**
 * PURE. The grounds an officer may record on this row. Empty for a REGISTRY
 * hold: no ground can be recorded where no decision can be.
 */
export const availableGrounds = (row: Pick<AmberRow, 'status'>): readonly ('DOCUMENT' | 'ELIGIBILITY')[] => {
  const kind = holdKindOf(row);
  return kind === 'DOCUMENT' ? ['DOCUMENT'] : kind === 'ADJUDICATION' ? ['ELIGIBILITY'] : [];
};

export type SignalBand = 'UNSCORED' | 'WEAKER' | 'MIXED' | 'CLEANER';

export const signalBand = (score: number | null): SignalBand =>
  score === null || Number.isNaN(score) ? 'UNSCORED' : score < 0.7 ? 'WEAKER' : score < 0.9 ? 'MIXED' : 'CLEANER';

export const activeFlags = (flags: AmberRow['forensicsFlags']): readonly string[] =>
  flags === null ? [] : Object.keys(flags).filter((key) => flags[key] === true).sort();

/** Oldest first. A row with no timestamp sorts last: an unknown age is not the most urgent one. */
export const byQueueAge = (a: AmberRow, b: AmberRow): number =>
  a.queuedAt === null && b.queuedAt === null ? 0 : a.queuedAt === null ? 1 : b.queuedAt === null ? -1 : a.queuedAt.localeCompare(b.queuedAt);
