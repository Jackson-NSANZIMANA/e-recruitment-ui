// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — browser wire shapes
//
// These are the response shapes emitted by the edge gateway at backend
// 06d9f9b6b1bc935a20beb8bd87ee8f96bc437aab. They intentionally do not alias the
// application-service schemas: the edge unwraps and allowlists those responses
// before they cross the browser boundary.
// ══════════════════════════════════════════════════════════════════

import type { Agency, ApplicationCategory, ApplicationStatus, StatusFor } from '@usrp/contracts';

export type { Agency, ApplicationCategory, ApplicationStatus, StatusFor };

/** `GET /edge/v1/applications` — the edge returns a bare projected array. */
export type ApplicationListResponse = readonly ApplicationListRow[];

/** Exact `EdgeApplicationListItem` projection. */
export interface ApplicationListRow {
  readonly applicationId: string | null;
  readonly processingCode: string | null;
  readonly category: string | null;
  /** The edge keeps this as text because agency status vocabularies differ. */
  readonly status: string | null;
  readonly agency: Agency;
  readonly submittedAt: string | null;
}

/** Exact `EdgeApplication` projection returned by by-id and detail. */
export interface ApplicationRecord {
  readonly applicationId: string | null;
  readonly processingCode: string | null;
  readonly category: string | null;
  readonly status: string | null;
  readonly agency: Agency;

  readonly academicStatus: string | null;
  readonly nesaIndexNumber: string | null;
  readonly nesaVerifiedAt: string | null;
  readonly hecRegistrationNumber: string | null;
  readonly hecVerifiedAt: string | null;
  readonly declaredSpecialistField: string | null;
  readonly academicEligibilityDetail: Readonly<Record<string, unknown>> | null;

  readonly ageEligibilityStatus: string | null;
  readonly ageVerifiedAt: string | null;
  readonly ageEligibilityDetail: Readonly<Record<string, unknown>> | null;

  readonly criminalClearanceStatus: string | null;
  readonly criminalClearanceAt: string | null;

  /** Officer-only forensic projection fields. */
  readonly documentLane: string | null;
  readonly documentForensicsScore: number | null;
  readonly documentForensicsFlags: Readonly<Record<string, unknown>> | null;
  readonly documentReviewedAt: string | null;
  readonly documentReviewDecision: string | null;

  readonly assignedDistrict: string | null;
  readonly assignedVenueName: string | null;
  readonly physicalTestScheduledAt: string | null;
  readonly physicalTestCompletedAt: string | null;
  readonly qrInvitationIssuedAt: string | null;
  readonly smsNotificationSentAt: string | null;

  readonly finalDecisionAt: string | null;
  readonly finalDecisionNotes: string | null;
  readonly submittedAt: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

/** `GET /edge/v1/applications/by-id` — the projected application is unwrapped. */
export type ApplicationByIdResponse = ApplicationRecord;

/** `GET /edge/v1/applications/amber-queue` — the edge returns a bare array. */
export type AmberQueueResponse = readonly AmberQueueEntry[];

export interface AmberQueueEntry {
  readonly applicationId: string | null;
  readonly processingCode: string | null;
  readonly status: string | null;
  readonly documentType: string | null;
  readonly forensicsScore: number | null;
  readonly forensicsFlags: Readonly<Record<string, unknown>> | null;
  readonly queuedAt: string | null;
  readonly agency: Agency;
}

/** The detail endpoint returns the application and an already-unwrapped history array. */
export interface ApplicationDetailResponse {
  readonly application: ApplicationRecord;
  readonly history: readonly StatusHistoryEntry[];
}

/** `GET /edge/v1/applications/status-history` — a bare history array. */
export type StatusHistoryResponse = readonly StatusHistoryEntry[];

export interface StatusHistoryEntry {
  readonly entryId: string | null;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  /** The edge aliases `toStatus` to this field for timeline consumers. */
  readonly status: string | null;
  readonly note: string | null;
  readonly actorKind: string | null;
  readonly occurredAt: string | null;
}

/** Exact 200 transition projection. Mutations return receipts, not application records. */
export interface EdgeTransitionResult {
  readonly applicationId: string;
  /** `APPLIED` or `NO_CHANGE`; this is the outcome discriminant. */
  readonly outcome: string;
  readonly fromStatus: string | null;
  /** Target status for APPLIED, current status for NO_CHANGE. */
  readonly status: string | null;
}

export type TransitionResult = EdgeTransitionResult;

/** Walk-in transition adds the edge's optional age-status field. */
export type WalkInVetResponse = EdgeTransitionResult & {
  readonly ageStatus?: string;
};

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

/** Walk-in step one; the browser receives an opaque applicantId after verification. */
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
  readonly qrInvitationCode: string;
}

/** `POST /edge/v1/identities/verify` returns no applicant identity fields. */
export type IdentityVerifyResponse =
  | { readonly status: 'CREATED'; readonly applicantId: string }
  | { readonly status: 'ALREADY_EXISTS'; readonly applicantId: string };

/** `GET /edge/v1/me/applications` — the citizen projection is a bare array. */
export type MyApplicationsResponse = readonly MyApplicationRow[];

/** Exact citizen `EdgeApplicationListItem` projection. */
export interface MyApplicationRow {
  readonly applicationId: string | null;
  readonly processingCode: string | null;
  readonly category: string | null;
  readonly status: string | null;
  readonly agency: Agency;
  readonly submittedAt: string | null;
}

/** Exact `POST /edge/v1/me/applications` request and success projection. */
export interface SubmitApplicationInput {
  readonly category: ApplicationCategory;
  readonly nesaIndexNumber?: string;
  readonly hecRegistrationNumber?: string;
}

export interface SubmitApplicationResponse {
  readonly status: 'SUBMITTED';
  readonly applicationId: string;
  readonly processingCode: string;
  readonly agency: Agency;
}

/** ADR-020 self-withdrawal. */
export type WithdrawResponse = {
  readonly applicationId: string;
  readonly outcome: string;
  readonly agency: Agency | null;
  readonly fromStatus: string | null;
};
