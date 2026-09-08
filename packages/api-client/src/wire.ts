// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — wire shapes
//
// ⚠ A DECLARED ASSUMPTION, NOT A CLAIM OF VERIFICATION.
//
// These interfaces are transcribed from the backend controllers at 47d9ad3
// (`officer-transitions.controller.ts`, `walk-in.controller.ts`,
// `list-applications.controller.ts`, `applicant-auth.controller.ts`). They are
// NOT imported from `@usrp/contracts`, and that is a known gap rather than a
// preference: the contract generates per-service namespaced schemas
// (`applicationService.*`, `identityService.*`) and this pass did not have the
// exact exported member names. Guessing them would have type-checked against
// nothing and produced a client that looks generated and is not.
//
// Agent 1's own README makes the standard: "A contract that guesses is worse than
// one that admits a gap, because a guess type-checks." So this file admits the
// gap in the one place a reader will see it, and the report carries the request
// to replace every type here with its generated counterpart.
//
// The domain vocabulary below (`Agency`, `ApplicationStatus`, `StatusFor`) IS
// imported from the contract, because those names are confirmed exports. So the
// per-agency divergence model is already load-bearing here: an RNP walk-in status
// is a compile error today.
// ══════════════════════════════════════════════════════════════════

import type { Agency, ApplicationStatus, StatusFor } from '@usrp/contracts';

export type { Agency, ApplicationStatus, StatusFor };

/** `GET /v1/applications` — officer, RLS-scoped. */
export interface ApplicationListResponse {
  readonly agency: Agency;
  readonly applications: readonly ApplicationListRow[];
}

/**
 * A row. No `PaginatedResult` envelope, because NOTHING in the platform
 * paginates — the contract's negative fixtures reject that envelope outright.
 */
export interface ApplicationListRow {
  readonly id: string;
  readonly agency: Agency;
  readonly status: ApplicationStatus;
  readonly processingCode: string;
  readonly category?: string;
}

/** `GET /v1/applications/by-id?applicationId=` — one row, own agency only. */
export interface ApplicationByIdResponse {
  readonly agency: Agency;
  readonly application: ApplicationListRow;
}

/** `GET /v1/applications/amber-queue` — ADR-011 review queue. */
export interface AmberQueueResponse {
  readonly agency: Agency;
  readonly queue: readonly Readonly<Record<string, unknown>>[];
}

/**
 * One append-only transition (rls/0007), oldest first.
 *
 * `actor` is nullable because a system transition has no officer. Conflating
 * "the system did it" with "an unknown officer did it" is precisely the
 * Procedural Justice failure this trail exists to prevent.
 */
export interface StatusHistoryEntry {
  readonly fromStatus: ApplicationStatus | null;
  readonly toStatus: ApplicationStatus;
  readonly actorKind: string;
  readonly actor: string | null;
  readonly at: string;
  readonly reason: string | null;
}

export interface StatusHistoryResponse {
  readonly agency: Agency;
  readonly applicationId: string;
  readonly history: readonly StatusHistoryEntry[];
}

/**
 * The edge's aggregate detail read.
 *
 * `partial` names the panels that failed. It exists because `Promise.all` over
 * an aggregate turns one 404 on a side panel into a blank error page; naming the
 * gap lets the UI render what it has and say what it does not.
 */
export interface ApplicationDetailResponse {
  readonly application: ApplicationByIdResponse;
  readonly history: StatusHistoryResponse | null;
  readonly partial: readonly string[];
}

/**
 * The shared success body of the four officer transitions.
 *
 * `APPLIED` and `NO_CHANGE` are BOTH 200. A client that treats any 200 as
 * "changed" will report a no-op as a successful transition, so the discriminant
 * has to be read.
 */
export type TransitionResult =
  | { readonly status: 'APPLIED'; readonly fromStatus: ApplicationStatus; readonly toStatus: ApplicationStatus }
  | { readonly status: 'NO_CHANGE'; readonly currentStatus: ApplicationStatus };

/** ADR-013: RDF is a board, RNP/RCS are certificate agencies. Two shapes, one route. */
export type MedicalReviewInput =
  | { readonly applicationId: string; readonly fitnessStatus: 'FIT' | 'UNFIT' }
  | { readonly applicationId: string; readonly certVerdict: 'CERT_VERIFIED'; readonly physicianName: string }
  | { readonly applicationId: string; readonly certVerdict: 'CERT_REJECTED' };

export interface FinalDecisionInput {
  readonly applicationId: string;
  readonly decision: 'SHORTLIST' | 'REJECT';
  readonly notes?: string;
}

export interface AcceptInput {
  readonly applicationId: string;
}

export interface AdjudicateInput {
  readonly applicationId: string;
  readonly decision: 'CLEAR' | 'REJECT';
  readonly notes?: string;
}

/**
 * Walk-in step one.
 *
 * NOTE WHAT IS ABSENT: `nationalIdHash`. The old `useWalkIn` sent it as its
 * primary field. It is an internal cross-service key that must never reach a
 * browser (invariant 2), and the real controller does not accept it — it takes
 * the opaque `applicantId` returned by `POST /v1/identities/verify`. So the
 * walk-in flow is genuinely three calls: verify identity, register, vet.
 */
export interface WalkInRegisterInput {
  readonly applicantId: string;
  readonly category: string;
  readonly nesaIndexNumber?: string;
  readonly hecRegistrationNumber?: string;
}

export interface WalkInRegisterResponse {
  readonly status: 'REGISTERED';
  readonly applicationId: string;
  readonly processingCode: string;
  /** The on-site ticket; field-score capture binds to this, not to a venue. */
  readonly qrInvitationCode: string;
}

/** Walk-in step two. `AGE_PENDING` arrives as a 409, not in this body. */
export type WalkInVetResponse =
  | { readonly status: 'APPLIED'; readonly fromStatus: ApplicationStatus; readonly toStatus: ApplicationStatus; readonly ageStatus: string }
  | { readonly status: 'NO_CHANGE'; readonly currentStatus: ApplicationStatus };

/**
 * `POST /v1/identities/verify`.
 *
 * Returns an opaque applicantId and a status. NO name, NO date of birth, NO
 * gender — the HCI "pre-fill the applicant's name from NIDA" requirement has no
 * endpoint behind it, and this type is the honest shape rather than the hoped-for
 * one.
 */
export type IdentityVerifyResponse =
  | { readonly status: 'CREATED'; readonly applicantId: string }
  | { readonly status: 'ALREADY_EXISTS'; readonly applicantId: string };

/** `GET /v1/applicants/me/applications` — the citizen's own rows, cross-agency. */
export interface MyApplicationsResponse {
  readonly applications: readonly MyApplicationRow[];
}

export interface MyApplicationRow {
  readonly applicationId: string;
  readonly agency: Agency;
  readonly status: ApplicationStatus;
  readonly processingCode: string;
  readonly submittedAt: string;
}

/** ADR-020 self-withdrawal. Four outcomes across three status codes. */
export type WithdrawResponse =
  | { readonly status: 'WITHDRAWN'; readonly agency: Agency; readonly fromStatus: ApplicationStatus }
  | { readonly status: 'NO_CHANGE'; readonly agency: Agency };

/**
 * Narrow a row to its agency's legal statuses.
 *
 * The point of `StatusFor<A>`: `rnp_ops` and `rcs_ops` carry no `WALK_IN_*`
 * values, so a component that renders a walk-in status for RNP is a compile
 * error instead of a production surprise for two agencies out of three.
 */
export type RowFor<A extends Agency> = Omit<ApplicationListRow, 'agency' | 'status'> & {
  readonly agency: A;
  readonly status: StatusFor<A>;
};
