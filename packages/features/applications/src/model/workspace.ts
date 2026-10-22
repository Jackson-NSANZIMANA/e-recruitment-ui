// ══════════════════════════════════════════════════════════════════
// applications — workspace model (S06). Pure.
//
// What an officer may do on an application is decided HERE from two inputs only:
// the application's status (the state machine) and the session's permissions
// (the posts). The backend re-checks both; this exists so the screen never
// offers a control that is certain to be refused.
// ══════════════════════════════════════════════════════════════════

import type { ApplicationStatus } from '@usrp/contracts';
import { canAccept, canAdjudicate, canFinalDecision, canMedicalReview } from './status.ts';

export type WorkspaceAction = 'MEDICAL' | 'FINAL' | 'ACCEPT' | 'ADJUDICATE';

/** The permission each transition needs (backend shared-auth OPERATION_PERMISSION_LIST). */
export const ACTION_PERMISSION: Readonly<Record<WorkspaceAction, string>> = {
  MEDICAL: 'medical.review',
  FINAL: 'decision.final',
  ACCEPT: 'application.accept',
  ADJUDICATE: 'adjudication.decide',
};

const STATE_RULE: Readonly<Record<WorkspaceAction, (s: ApplicationStatus) => boolean>> = {
  MEDICAL: canMedicalReview,
  FINAL: canFinalDecision,
  ACCEPT: canAccept,
  ADJUDICATE: canAdjudicate,
};

export interface ActionAvailability {
  readonly action: WorkspaceAction;
  /** The status allows it. */
  readonly stateAllows: boolean;
  /** The officer's posts allow it. */
  readonly permitted: boolean;
}

/** PURE. Every action with why it is or is not available. */
export function availability(status: ApplicationStatus, permissions: readonly string[]): readonly ActionAvailability[] {
  return (Object.keys(ACTION_PERMISSION) as WorkspaceAction[]).map((action) => ({
    action,
    stateAllows: STATE_RULE[action](status),
    permitted: permissions.includes(ACTION_PERMISSION[action]),
  }));
}

/** PURE. The actions to render now: state allows AND the post permits. */
export function actionsToShow(status: ApplicationStatus, permissions: readonly string[]): readonly WorkspaceAction[] {
  return availability(status, permissions).filter((a) => a.stateAllows && a.permitted).map((a) => a.action);
}

/** PURE. True when the state would allow an action but the officer's posts do not (the screen says so). */
export function blockedByPost(status: ApplicationStatus, permissions: readonly string[]): readonly WorkspaceAction[] {
  return availability(status, permissions).filter((a) => a.stateAllows && !a.permitted).map((a) => a.action);
}

export const WORKSPACE_TABS = ['summary', 'timeline', 'documents', 'slot', 'gate', 'biometric', 'field', 'medical'] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

/** Filters of the list (S04 searchApplications). */
export interface ListFilters {
  readonly preset: 'all' | 'needs-officer' | 'medical' | 'final';
  readonly category: string;
  readonly campaign: string;
  readonly district: string;
}
export const EMPTY_FILTERS: ListFilters = { preset: 'all', category: '', campaign: '', district: '' };

export const PRESET_STATUSES: Readonly<Record<ListFilters['preset'], readonly string[]>> = {
  all: [],
  'needs-officer': ['DOCUMENT_REVIEW_AMBER', 'ADJUDICATION_REVIEW', 'PHYSICAL_TEST_COMPLETE', 'MEDICAL_REVIEW', 'FINAL_SHORTLIST', 'WALK_IN_REGISTERED', 'WALK_IN_ON_SITE_VETTING', 'WALK_IN_PHYSICAL_TEST'],
  medical: ['PHYSICAL_TEST_COMPLETE', 'WALK_IN_PHYSICAL_TEST'],
  final: ['MEDICAL_REVIEW', 'FINAL_SHORTLIST'],
};

export const filtersActive = (f: ListFilters): boolean => f.preset !== 'all' || f.category !== '' || f.campaign !== '' || f.district !== '';

/** PURE. The searchApplications query for a filter set and a cursor. */
export function searchQueryOf(f: ListFilters, cursor?: string): {
  readonly status?: readonly string[];
  readonly category?: string;
  readonly campaign?: string;
  readonly district?: string;
  readonly limit: number;
  readonly cursor?: string;
} {
  const status = PRESET_STATUSES[f.preset];
  return {
    ...(status.length > 0 ? { status } : {}),
    ...(f.category !== '' ? { category: f.category } : {}),
    ...(f.campaign !== '' ? { campaign: f.campaign } : {}),
    ...(f.district !== '' ? { district: f.district } : {}),
    limit: 50,
    ...(cursor !== undefined ? { cursor } : {}),
  };
}

/** The cross-agency lock refusal names the holding agency (ADR-014). */
export function lockedBy(data: Readonly<Record<string, unknown>>): string | null {
  const a = data['lockedByAgency'];
  return typeof a === 'string' && a.length > 0 ? a : null;
}

/** PURE. A biometric evidence row as advisory text keys: never a verdict, never "passed" or "failed". */
export function evidenceSummary(row: { readonly outcome: string; readonly livenessScoreBp: number | null; readonly matchScoreBp: number | null }): {
  readonly outcomeKey: string;
  readonly liveness: string;
  readonly match: string;
} {
  const pct = (bp: number | null): string => (bp === null ? '—' : `${(bp / 100).toFixed(1)}%`);
  return { outcomeKey: `applications.biometric.outcome.${row.outcome}`, liveness: pct(row.livenessScoreBp), match: pct(row.matchScoreBp) };
}
