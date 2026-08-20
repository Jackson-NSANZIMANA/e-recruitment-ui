// ─── Agency ────────────────────────────────────────────────────────────────
/** Three agencies served by USRP. Values match the agency_code in the DB. */
export type Agency = "RDF" | "RNP" | "RCS";

// ─── Application lifecycle ──────────────────────────────────────────────────
/**
 * Every state an application can occupy.  These values mirror the backend
 * `application_status` enum in the Postgres schema — keep them in sync when
 * the backend adds new states.
 */
export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "SHORTLISTED"
  | "PHYSICAL_SCHEDULED"
  | "PHYSICAL_PASSED"
  | "PHYSICAL_FAILED"
  | "MEDICAL_SCHEDULED"
  | "MEDICAL_PASSED"
  | "MEDICAL_FAILED"
  | "VETTING_IN_PROGRESS"
  | "VETTING_PASSED"
  | "VETTING_FAILED"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "EXPIRED";

/** Terminal states — application can no longer move forward. */
export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
]);

// ─── Officers ───────────────────────────────────────────────────────────────
export type OfficerRole =
  | "RECRUITMENT_OFFICER"   // standard intake and review
  | "MEDICAL_OFFICER"       // records physical / medical outcomes
  | "VETTING_OFFICER"       // background-vetting reviewer
  | "SENIOR_OFFICER"        // can override + accept-lock
  | "SUPERADMIN";           // cross-agency visibility (no RLS)

// ─── Applicant profile ───────────────────────────────────────────────────────
export interface ApplicantProfile {
  /** USRP-internal identifier — NOT the NID. */
  readonly id: string;
  readonly displayName: string;
  /** Partial phone number shown to officer for contact (e.g. "380-X789"). */
  readonly phoneFragment: string;
  readonly dateOfBirth: string; // ISO-8601 date
  readonly gender: "MALE" | "FEMALE" | "OTHER";
}

// ─── Application ────────────────────────────────────────────────────────────
export interface ApplicationListItem {
  readonly id: string;
  readonly applicantName: string;
  readonly agency: Agency;
  readonly status: ApplicationStatus;
  readonly submittedAt: string; // ISO-8601
  readonly updatedAt: string;
  /** Set when status moves to an officer-action state. */
  readonly assignedOfficerId?: string;
  /** True when the application has unresolved required actions. */
  readonly requiresAction: boolean;
}

export interface Application extends ApplicationListItem {
  readonly applicant: ApplicantProfile;
  readonly postCode: string;      // recruitment post the applicant applied for
  readonly postTitle: string;
  readonly history: readonly ApplicationEvent[];
  readonly documents: readonly ApplicationDocument[];
}

// ─── Application events (audit trail) ───────────────────────────────────────
export interface ApplicationEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly actorId: string;
  readonly actorRole: OfficerRole | "SYSTEM" | "APPLICANT";
  readonly fromStatus: ApplicationStatus | null;
  readonly toStatus: ApplicationStatus;
  readonly note: string | null;
}

// ─── Documents ──────────────────────────────────────────────────────────────
export type DocumentType =
  | "NATIONAL_ID"
  | "PASSPORT_PHOTO"
  | "ACADEMIC_CERTIFICATE"
  | "MEDICAL_REPORT"
  | "POLICE_CLEARANCE"
  | "PROOF_OF_RESIDENCE";

export type DocumentQuality = "ACCEPTED" | "REJECTED" | "PENDING_REVIEW";

export interface ApplicationDocument {
  readonly id: string;
  readonly type: DocumentType;
  readonly quality: DocumentQuality;
  readonly uploadedAt: string;
  readonly reviewNote: string | null;
}

// ─── Dashboard / metrics ─────────────────────────────────────────────────────
export interface OfficerDashboardMetrics {
  readonly pendingReview: number;
  readonly requiresAction: number;
  readonly scheduledToday: number;
  readonly acceptedThisWeek: number;
}

// ─── API pagination ──────────────────────────────────────────────────────────
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
