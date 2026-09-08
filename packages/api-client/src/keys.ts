// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — query keys and the INVALIDATION MAP
//
// The invalidation map is the interesting half. Query keys are bookkeeping; what
// actually breaks a console is a mutation that refreshes the wrong caches —
// because the resulting UI is not obviously wrong, it is quietly stale, and an
// officer acts on a status that changed two minutes ago.
//
// Every transition below invalidates BOTH the row and the list, for a specific
// reason: `deriveApplicationStatus` is a max-rank projection (ADR-006), so a
// single write can move a row between lists it was never explicitly in — out of
// the amber queue, into the medical lane. Invalidating only the detail view
// leaves the queue showing an item that is no longer there.
//
// The map is DATA so the selfcheck can assert over it. A comment describing
// invalidation is a comment that drifts from the code beneath it.
// ══════════════════════════════════════════════════════════════════

import type { Agency } from '@usrp/contracts';

export const sessionKeys = {
  all: ['session'] as const,
  current: () => ['session', 'current'] as const,
};

export const applicationKeys = {
  all: ['applications'] as const,
  /** The officer's agency-scoped list. Keyed by agency: two consoles, two caches. */
  list: (agency: Agency) => ['applications', 'list', agency] as const,
  amberQueue: (agency: Agency) => ['applications', 'amber-queue', agency] as const,
  detail: (applicationId: string) => ['applications', 'detail', applicationId] as const,
  statusHistory: (applicationId: string) => ['applications', 'status-history', applicationId] as const,
};

export const applicantKeys = {
  all: ['applicant'] as const,
  myApplications: () => ['applicant', 'applications'] as const,
  myErasureRequest: () => ['applicant', 'erasure-request'] as const,
};

/**
 * Which key families a mutation invalidates.
 *
 * `'applications:list'` and `'applications:amber-queue'` are agency-scoped and
 * resolved at call time; the rest are resolved from the mutation's own id.
 */
export type InvalidationTarget =
  | 'applications:list'
  | 'applications:amber-queue'
  | 'applications:detail'
  | 'applications:status-history'
  | 'applicant:applications'
  | 'applicant:erasure-request'
  | 'session:current';

export const INVALIDATION_MAP: Readonly<Record<string, readonly InvalidationTarget[]>> = {
  /**
   * A medical verdict can land the row in `MEDICAL_CLEARED` or, on an adverse
   * async verdict, in `ADJUDICATION_REVIEW` — which is an AMBER QUEUE row. So the
   * queue must be invalidated even though this route never mentions it.
   */
  recordMedicalReview: ['applications:list', 'applications:amber-queue', 'applications:detail', 'applications:status-history'],

  recordFinalDecision: ['applications:list', 'applications:detail', 'applications:status-history'],

  /**
   * ADR-017: accepting one application AUTO-WITHDRAWS the same citizen's others.
   * Those may be in a DIFFERENT agency's list this console cannot see, which is
   * why the citizen-facing caches are invalidated too — the applicant portal is
   * the surface where that side effect becomes visible.
   */
  acceptApplication: [
    'applications:list',
    'applications:amber-queue',
    'applications:detail',
    'applications:status-history',
    'applicant:applications',
  ],

  /** Adjudication is how a row LEAVES the amber queue. */
  adjudicateApplication: ['applications:list', 'applications:amber-queue', 'applications:detail', 'applications:status-history'],

  /** Registration creates a row, so the list changes; there is no detail yet. */
  registerWalkIn: ['applications:list'],

  vetWalkIn: ['applications:list', 'applications:detail', 'applications:status-history'],

  /**
   * Identity verification creates no application and MUST NOT invalidate a list.
   * Listed explicitly with an empty array rather than omitted, so "no
   * invalidation" is a decision on the record instead of an oversight.
   */
  verifyIdentity: [],

  withdrawMyApplication: ['applicant:applications'],

  fileMyErasureRequest: ['applicant:erasure-request'],

  /**
   * ADR-015: erasure terminates the citizen's sessions as a side effect, so any
   * cached citizen view is not merely stale, it is unreachable.
   */
  eraseIdentity: ['applicant:applications', 'applicant:erasure-request', 'session:current'],

  officerLogin: ['session:current'],
  officerLogout: ['session:current'],
  verifyOtp: ['session:current'],
  applicantLogout: ['session:current'],
};

/** Resolve targets to concrete key arrays. */
export function resolveInvalidation(
  targets: readonly InvalidationTarget[],
  context: { readonly agency?: Agency; readonly applicationId?: string },
): readonly (readonly unknown[])[] {
  const keys: (readonly unknown[])[] = [];
  for (const target of targets) {
    switch (target) {
      case 'applications:list':
        keys.push(context.agency === undefined ? applicationKeys.all : applicationKeys.list(context.agency));
        break;
      case 'applications:amber-queue':
        keys.push(context.agency === undefined ? applicationKeys.all : applicationKeys.amberQueue(context.agency));
        break;
      case 'applications:detail':
        if (context.applicationId !== undefined) keys.push(applicationKeys.detail(context.applicationId));
        break;
      case 'applications:status-history':
        if (context.applicationId !== undefined) keys.push(applicationKeys.statusHistory(context.applicationId));
        break;
      case 'applicant:applications':
        keys.push(applicantKeys.myApplications());
        break;
      case 'applicant:erasure-request':
        keys.push(applicantKeys.myErasureRequest());
        break;
      case 'session:current':
        keys.push(sessionKeys.current());
        break;
      default:
        return assertNever(target);
    }
  }
  return keys;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled invalidation target: ${JSON.stringify(value)}`);
}
