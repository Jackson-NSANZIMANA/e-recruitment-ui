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

/** Alias used by feature slices that prefer the detail-oriented name. */
export type ApplicationDetail = ApplicationRecord;

/** Internal decode alias — a decoded officer list row. */
export type ApplicationRow = ApplicationListRow;

/** Internal decode alias — a decoded amber queue entry. */
export type AmberQueueRow = AmberQueueEntry;

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
  /** Panel names that failed to decode; empty on the production gateway which fails whole. */
  readonly partial: readonly string[];
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
  /** The PUBLIC code of the campaign the citizen chose (ADR-030). */
  readonly campaignCode: string;
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

export type RowFor<A extends Agency> = Omit<ApplicationListRow, 'agency' | 'status'> & {
  readonly agency: A;
  readonly status: StatusFor<A>;
};

// ── Public campaigns (BUILD-001 reads, ADR-030) ──────────────────

/** The approved public projection of a published campaign. Nothing internal. */
export interface PublicCampaign {
  readonly publicCode: string;
  readonly campaignLabel: string;
  readonly agency: Agency;
  readonly status: string;
  readonly registrationOpensAt: string;
  readonly registrationClosesAt: string;
  readonly examinationStartDate: string;
  readonly examinationEndDate: string;
  readonly targetCategories: readonly ApplicationCategory[];
  readonly targetDistricts: readonly string[];
  readonly allowsWalkIn: boolean;
  readonly contactPhoneNumbers: readonly string[] | null;
  readonly contactWebsite: string | null;
}

export interface PublicCampaignListResponse {
  readonly campaigns: readonly PublicCampaign[];
}

export interface PublicCampaignDetailResponse {
  readonly campaign: PublicCampaign;
}

/** `POST /edge/v1/me/applications/documents` — identifiers only, never a verdict. */
export interface UploadDocumentResponse {
  readonly status: 'UPLOADED';
  readonly documentId: string;
  readonly documentType: string;
}

export interface UploadDocumentInput {
  readonly applicationId: string;
  readonly documentType: string;
  readonly file: Blob;
}

// ── Advisory document checklist (ADR-032) ───────────────────────

export type DocumentSatisfaction =
  | 'API_VERIFIED'
  | 'UPLOADED_CLEARED'
  | 'VENUE_VERIFIED'
  | 'AWAITING_REGISTRY'
  | 'UNDER_REVIEW'
  | 'REJECTED'
  | 'MISSING';

/** ADVISORY: never a gate. No score, flag, object key or officer id. */
/**
 * The citizen's own verified identity, allowlisted by the edge (ADR-049, ADR-FE-019).
 * placeOfBirth and nationality are always null today: the platform does not retain them,
 * so the wizard asks for them. There is no photo, signature, parents' names or National ID.
 * CONTRACT-PENDING: S12c.
 */
export interface MyIdentity {
  readonly fullName: string;
  readonly sex: 'MALE' | 'FEMALE';
  readonly dateOfBirth: string;
  readonly homeDistrict: string;
  readonly homeProvince: string;
  readonly placeOfBirth: string | null;
  readonly nationality: string | null;
}

export interface DocumentChecklist {
  readonly agency: Agency;
  readonly source: 'POLICY_VERSION' | 'GROUND_TRUTH_TABLE';
  readonly complete: boolean;
  readonly items: readonly {
    readonly documentType: string;
    readonly satisfaction: DocumentSatisfaction;
    /** NIDA | NESA | HEC | RIB, or null when it can only be uploaded/presented. */
    readonly registry: string | null;
  }[];
}

export interface VerifyAtVenueResponse {
  readonly status: 'RECORDED' | 'ALREADY_RECORDED';
  readonly checklist: DocumentChecklist;
}

// ── The citizen's exam QR (ADR-033) ─────────────────────────────

export type ExamInvitationState =
  | 'READY'
  | 'ADMITTED'
  | 'PENDING'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CLOSED'
  | 'EXPIRED'
  | 'UNAVAILABLE'
  | 'WALK_IN';

/**
 * `invitation` is present ONLY when state is READY; `admission` ONLY when state
 * is ADMITTED (ADR-034: the QR was spent at the gate and is never re-sent).
 */
export interface ExamInvitationView {
  readonly state: ExamInvitationState;
  readonly agency: Agency;
  readonly processingCode: string;
  readonly campaignLabel: string | null;
  readonly currentStatus: string;
  readonly invitation?: {
    /** The signed slot invitation (USRP-SLOT.v1…) to encode in the QR. */
    readonly qrPayload: string;
    readonly ticketId: string;
    readonly venueName: string;
    readonly examDate: string;
    readonly reportingTimeHour: number;
    readonly validUntil: string;
  };
  readonly admission?: {
    readonly venueName: string;
    readonly admittedAt: string;
  };
}

// ── Single-use admission at the venue gate (BUILD-003, ADR-034) ──

/** The candidate as the gate officer needs them: public identifiers only. */
export interface GateCandidate {
  readonly applicationId: string;
  readonly processingCode: string;
  readonly category: string;
}

export interface AdmitAtGateInput {
  /** The QR text exactly as scanned. */
  readonly qrToken: string;
  /** Typed from the candidate's card; hashed server-side, never stored. */
  readonly nationalId: string;
  /** The venue this gate is at. */
  readonly gateVenueName: string;
}

/** Why a QR is not a ticket here at all. */
export type InvalidTicketReason = 'MALFORMED_TICKET' | 'WRONG_AGENCY' | 'UNKNOWN_TICKET' | 'TICKET_NOT_ISSUED';

/**
 * Every answer the gate can get. Refusals are outcomes, not errors: the gate
 * screen shows each one; only infrastructure faults throw.
 */
export type GateAdmissionResult =
  | {
      readonly outcome: 'ADMITTED';
      readonly candidate: GateCandidate;
      readonly venueName: string;
      readonly examDate: string;
      readonly reportingTimeHour: number;
      readonly admittedAt: string;
      readonly statusAdvanced: boolean;
    }
  | {
      readonly outcome: 'ALREADY_ADMITTED';
      readonly candidate: GateCandidate;
      readonly admittedAt: string;
      readonly venueName: string;
      readonly admittedBySelf: boolean;
    }
  | { readonly outcome: 'NOT_ADMISSIBLE'; readonly candidate: GateCandidate; readonly currentStatus: string }
  | { readonly outcome: 'IDENTITY_MISMATCH'; readonly candidate: GateCandidate }
  | { readonly outcome: 'MANUAL_IDENTITY_REQUIRED'; readonly candidate: GateCandidate }
  | { readonly outcome: 'WRONG_VENUE'; readonly ticketVenueName: string }
  | { readonly outcome: 'TOO_EARLY' | 'EXPIRED'; readonly examDate: string }
  | { readonly outcome: 'INVALID_TICKET'; readonly reason: InvalidTicketReason };

// ══════════════════════════════════════════════════════════════════
// Campaign control (BUILD-001, ADR-030) — the seven officer writes.
//
// Requests transcribed from services/edge-gateway/openapi/edge-v1.yaml at the
// pinned EDGE_BACKEND_SHA (each is `additionalProperties: false`; the edge
// rejects any other key). Responses transcribed from the stored command
// replies in application-service campaign-control.pg-repository.ts and
// scheduling-service campaign-session.pg-repository.ts, because the edge
// document does not describe them. Every write REQUIRES a UUID
// Idempotency-Key; a replay returns the stored original body with
// `Idempotency-Replayed: true`. Agency is never sent: it is the officer's.
// ══════════════════════════════════════════════════════════════════

export interface CreateCampaignInput {
  readonly publicCode: string;
  readonly campaignLabel: string;
  readonly targetCategories: readonly ApplicationCategory[];
  readonly targetDistricts: readonly string[];
  readonly registrationOpensAt: string;
  readonly registrationClosesAt: string;
  readonly examinationStartDate: string;
  readonly examinationEndDate: string;
  readonly examinationReportingHour: number;
  readonly allowsWalkIn: boolean;
  readonly targetIntakeCount?: number | null;
  readonly contactPhoneNumbers?: readonly string[];
  readonly contactWebsite?: string | null;
}

export interface CampaignCategoryPolicy {
  readonly age: { readonly minimumAge: number; readonly maximumAge: number; readonly referenceDate: string };
  readonly education: { readonly mode: string; readonly threshold: string | number };
  readonly criminalThreshold: string;
  readonly requiredDocumentTypes: readonly string[];
  readonly medicalMode: string;
  readonly legalBasis: { readonly code: string; readonly reference: string };
}

export interface CreateCampaignPolicyInput {
  readonly publicCode: string;
  /** One complete entry per target category; official values come from the officer, never defaults. */
  readonly policyDocument: Readonly<Record<string, CampaignCategoryPolicy>>;
  readonly legalBasisCode: string;
  readonly legalBasisReference: string;
}

export interface ConfigureCampaignSessionInput {
  readonly publicCode: string;
  readonly district: string;
  readonly province: string;
  readonly venueName: string;
  readonly examDate: string;
  readonly reportingTimeHour: number;
  readonly capacityLimit: number | null;
  /** Required as UNBOUNDED_CAPACITY when capacityLimit is null. */
  readonly capacityDecisionCode?: 'UNBOUNDED_CAPACITY';
  readonly isActive: boolean;
}

/** publish, registration-close, complete and cancel all take only the public code. */
export interface CampaignPublicCodeInput {
  readonly publicCode: string;
}

export interface CampaignDraftCreated {
  readonly status: 'DRAFT_CREATED';
  readonly publicCode: string;
  readonly campaignStatus: 'DRAFT';
}

export interface CampaignPolicyVersionCreated {
  readonly status: 'POLICY_VERSION_CREATED';
  readonly publicCode: string;
  readonly policyVersion: number;
  readonly policyHash: string;
}

export interface CampaignSessionConfigured {
  readonly status: 'SESSION_CONFIGURED' | 'SESSION_UNCHANGED';
  readonly publicCode: string;
  readonly district: string;
  readonly coverageVersion: number;
  readonly coverageHash: string;
  readonly capacityDecisionCode?: 'UNBOUNDED_CAPACITY' | null;
}

export interface CampaignPublished {
  readonly status: 'CAMPAIGN_PUBLISHED';
  readonly publicCode: string;
  readonly campaignStatus: 'REGISTRATION_OPEN';
  readonly policyVersion: number;
  readonly coverageVersion: number;
  readonly coverageHash: string;
}

export type CampaignLifecycleState = 'REGISTRATION_CLOSED' | 'COMPLETED' | 'CANCELLED';

export interface CampaignLifecycleChanged<S extends CampaignLifecycleState = CampaignLifecycleState> {
  readonly status: S;
  readonly publicCode: string;
  readonly campaignStatus: S;
}

/** Every campaign write answers with its body plus whether the edge replayed it. */
export interface CampaignCommandResult<T> {
  readonly result: T;
  readonly replayed: boolean;
}

// ══════════════════════════════════════════════════════════════════
// Officer lifecycle (S01, ADR-036 + Addendum A), operational reads (S04,
// ADR-039) and advisory biometric evidence (B1, ADR-037).
//
// Transcribed from services/edge-gateway/openapi/edge-v1.yaml at the pinned
// EDGE_BACKEND_SHA. Four-eyes (Addendum A): create and reissue answers carry NO
// activation code; only the release answer does, to a different administrator.
// ══════════════════════════════════════════════════════════════════

export type OfficerStatus = 'active' | 'disabled' | 'pending';
export type ActivationState = 'PENDING_RELEASE' | 'RELEASED' | 'EXPIRED';

export interface OfficerRow {
  readonly officerId: string;
  readonly loginHandle: string;
  readonly posts: readonly string[];
  readonly status: OfficerStatus;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly lastLoginAt: string | null;
  readonly activationExpiresAt: string | null;
  readonly activationState: ActivationState | null;
  /** Relative to the viewing administrator, in every answer. */
  readonly releasableByYou: boolean;
}

export interface OfficerListResponse { readonly officers: readonly OfficerRow[] }
export interface CreateOfficerInput { readonly loginHandle: string; readonly posts: readonly string[] }
/** createOfficer / reissueOfficerActivation: the officer only, never a code. */
export interface OfficerOpenedResponse { readonly outcome: 'CREATED' | 'REISSUED'; readonly officer: OfficerRow }
export interface OfficerTargetInput { readonly targetOfficerId: string }
export interface OfficerReleasedResponse {
  readonly outcome: 'RELEASED';
  readonly officer: OfficerRow;
  readonly activation: { readonly code: string; readonly expiresAt: string };
}
export const ASSIGNABLE_POSTS = ['reviewer', 'screening_officer', 'field_supervisor', 'medical_officer', 'adjudicator', 'decision_authority', 'dpo'] as const;
export type AssignablePost = (typeof ASSIGNABLE_POSTS)[number];
export const ASSIGN_POSTS_REASONS = ['POSTING_CHANGE', 'CORRECTION', 'TEMPORARY_COVER', 'OTHER'] as const;
export const DISABLE_REASONS = ['LEFT_SERVICE', 'SUSPENDED', 'SECURITY_CONCERN', 'EXTENDED_LEAVE', 'OTHER'] as const;
export const ENABLE_REASONS = ['RETURNED_TO_DUTY', 'SUSPENSION_LIFTED', 'CORRECTION', 'OTHER'] as const;
export const REVOKE_SESSIONS_REASONS = ['DEVICE_LOST', 'SECURITY_CONCERN', 'OTHER'] as const;
export interface AssignOfficerPostsInput { readonly targetOfficerId: string; readonly posts: readonly string[]; readonly reasonCode: string }
export interface OfficerReasonInput { readonly targetOfficerId: string; readonly reasonCode: string }
export interface OfficerChangeResponse {
  readonly outcome: 'ASSIGNED' | 'DISABLED' | 'ENABLED' | 'REVOKED' | 'UNCHANGED';
  readonly officer: OfficerRow;
  readonly sessionsRevoked: number;
}
/** 204 No Content: the transport hands back an empty object. */
export type ActivateOfficerResponse = Readonly<Record<string, never>>;
export interface ActivateOfficerInput { readonly loginHandle: string; readonly activationCode: string; readonly password: string }

export interface ApplicationSearchRow {
  readonly applicationId: string;
  readonly processingCode: string;
  readonly category: string;
  readonly status: string;
  readonly submittedAt: string | null;
}
export interface ApplicationSearchResponse {
  readonly agency: string;
  readonly applications: readonly ApplicationSearchRow[];
  readonly total: number;
  readonly nextCursor: string | null;
}
export interface ApplicationSearchQuery {
  readonly status?: readonly string[];
  readonly category?: string;
  readonly campaign?: string;
  readonly district?: string;
  readonly submittedFrom?: string;
  readonly submittedTo?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface BiometricEvidenceRow {
  readonly recordId: string;
  readonly ticketId: string;
  readonly referenceSource: string;
  readonly method: string;
  readonly consentState: string;
  readonly outcome: string;
  readonly notAttemptedReason: string | null;
  readonly livenessScoreBp: number | null;
  readonly matchScoreBp: number | null;
  readonly modelId: string | null;
  readonly modelVersion: string | null;
  readonly thresholdPolicyVersion: string;
  readonly mode: 'ADVISORY';
  readonly capturedAt: string;
  readonly receivedAt: string;
  readonly manualIdentity: { readonly reasonCode: string; readonly confirmedAt: string } | null;
}
export interface BiometricEvidenceResponse { readonly applicationId: string; readonly evidence: readonly BiometricEvidenceRow[] }

export interface ErasureRequestRow { readonly requestId: string; readonly requestedAt: string }
export interface ErasureQueueResponse { readonly requests: readonly ErasureRequestRow[] }
export type ErasureDecisionInput =
  | { readonly requestId: string; readonly decision: 'DECLINE'; readonly grounds: string }
  | { readonly requestId: string; readonly decision: 'EXECUTE' };
export interface ErasureDecisionResponse { readonly requestId: string; readonly decision: 'DECLINED' | 'EXECUTED' }

// ── Field Station (S08): device enrolment, score sync, venue reads, biometric policy ──

export interface EnrollFieldDeviceInput { readonly deviceId: string; readonly publicKeyPem: string }
export interface EnrollFieldDeviceResponse { readonly status: 'ENROLLED' | 'ALREADY_ENROLLED'; readonly deviceId: string; readonly agency: string }

/** One signed score record as the field-sync service parses it (sync-scores.controller.ts). */
export interface FieldScoreWireRecord {
  readonly applicationId: string;
  readonly qrInvitationCode: string;
  readonly metrics: {
    readonly heightCm: number;
    readonly weightKg: number;
    readonly run3kmTimeSeconds: number;
    readonly chestCm: number;
    readonly medicalFitnessStatus: 'FIT' | 'UNFIT' | 'PENDING_REVIEW';
    readonly additionalNotes?: string;
  };
  readonly capturedAt: string;
  readonly deviceId: string;
  readonly capturingOfficerId: string;
  readonly vectorClock: Readonly<Record<string, number>>;
  readonly deviceSignature: string;
  readonly signedPayloadHash: string;
}

/** What the transport saw. `httpStatus` is null when no response arrived; the body is whatever the edge sent. */
export interface FieldSyncAnswer { readonly httpStatus: number | null; readonly body: unknown }

export interface ResolveFieldConflictInput { readonly applicationId: string; readonly scoreId: string; readonly resolution: string }

export interface VenueQuery { readonly campaign: string; readonly district: string; readonly examDate: string }
export interface VenueRosterCandidate {
  readonly processingCode: string;
  readonly category: string;
  readonly status: string;
  readonly admission: 'ADMITTED' | 'NOT_ADMITTED';
  readonly requiredPaperItems: readonly string[];
}
export interface VenueRosterResponse {
  readonly agency: string;
  readonly venue: { readonly venueName: string; readonly district: string; readonly examDate: string; readonly reportingTimeHour: number; readonly capacityLimit: number | null; readonly registeredCount: number };
  readonly candidates: readonly VenueRosterCandidate[];
  readonly truncated: boolean;
}
export interface VenueLiveCountsResponse {
  readonly agency: string;
  readonly venue: { readonly venueName: string; readonly district: string; readonly examDate: string };
  readonly counts: { readonly expected: number; readonly admitted: number; readonly physicalCaptured: number; readonly medicalRecorded: number; readonly openConflicts: number };
  readonly asOf: string | null;
}

export type BiometricMode = 'OFF' | 'SHADOW' | 'ADVISORY';
export interface BiometricPolicyResponse {
  readonly agency: string;
  readonly mode: BiometricMode;
  readonly legalBasis: string;
  readonly evidenceSchema: string;
  readonly maxBodyBytes: number;
  readonly thresholdPolicy: { readonly version: string; readonly livenessPassBp: number; readonly matchBp: number; readonly noMatchBelowBp: number };
  readonly referenceSources: readonly { readonly id: 'CARD_PORTRAIT' | 'NIDA_PORTRAIT' | 'NONE'; readonly status: string }[];
}

// ── Administration reads (S04 read models, ADR-039; S09 fleet): the admin dashboard ──
export type CampaignStatus = 'DRAFT' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'EXAMINATION_ACTIVE' | 'COMPLETED' | 'CANCELLED';
export interface CampaignOccupancy {
  readonly sessionCount: number;
  /** Sum of bounded session capacities; null when no session is bounded. */
  readonly capacityTotal: number | null;
  readonly hasUnboundedSession: boolean;
  readonly registeredTotal: number;
}
export interface CampaignAdminSummary {
  readonly publicCode: string;
  readonly campaignLabel: string;
  readonly status: CampaignStatus;
  readonly targetCategories: readonly string[];
  readonly targetDistricts: readonly string[];
  readonly registrationOpensAt: string;
  readonly registrationClosesAt: string;
  readonly examinationStartDate: string;
  readonly examinationEndDate: string;
  readonly allowsWalkIn: boolean;
  readonly targetIntakeCount: number | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly occupancy: CampaignOccupancy;
}
export interface AgencyCampaignListResponse {
  readonly agency: string;
  readonly campaigns: readonly CampaignAdminSummary[];
  readonly total: number;
  readonly nextCursor: string | null;
}
export interface AgencyCampaignQuery {
  readonly q?: string;
  readonly status?: readonly CampaignStatus[];
  readonly limit?: number;
  readonly cursor?: string;
}
export interface CampaignSessionOccupancy {
  readonly district: string;
  readonly province: string;
  readonly venueName: string;
  readonly examDate: string;
  readonly reportingTimeHour: number;
  readonly capacityLimit: number | null;
  readonly capacityDecisionCode: string | null;
  readonly registeredCount: number;
  readonly remaining: number | null;
  readonly isActive: boolean;
}
export interface CampaignAdminDetail {
  readonly summary: CampaignAdminSummary;
  readonly contactPhoneNumbers: readonly string[] | null;
  readonly contactWebsite: string | null;
  readonly announcementReference: string | null;
  readonly registrationClosedAt: string | null;
  readonly cancelledAt: string | null;
  readonly policy: { readonly versionNumber: number; readonly policyHash: string; readonly hashVersion: number; readonly legalBasisCode: string; readonly createdAt: string } | null;
  readonly coverage: { readonly version: number; readonly hash: string } | null;
  readonly sessions: readonly CampaignSessionOccupancy[];
  readonly history: readonly { readonly fromStatus: CampaignStatus | null; readonly toStatus: CampaignStatus; readonly reasonCode: string | null; readonly occurredAt: string }[];
}
export interface CampaignAdminDetailResponse { readonly agency: string; readonly campaign: CampaignAdminDetail }
export type DeviceRevokeReason = 'LOST' | 'STOLEN' | 'COMPROMISED' | 'RETIRED' | 'OTHER';
/** One row of the agency's tablet fleet. Never carries the device key. */
export interface FleetDevice {
  readonly deviceId: string;
  readonly enrolledBy: string;
  readonly enrolledAt: string;
  readonly lastSeenAt: string | null;
  readonly lastSeenSource: 'FIELD_SYNC' | 'BIOMETRIC' | null;
  readonly lastSyncAt: string | null;
  readonly revokedAt: string | null;
  readonly revokeReason: DeviceRevokeReason | null;
  readonly assignment: { readonly campaignPublicCode: string; readonly district: string; readonly examDate: string } | null;
}
export interface FieldDeviceListResponse { readonly devices: readonly FleetDevice[] }
