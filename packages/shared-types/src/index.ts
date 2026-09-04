// ════════════════════════════════════════════════════════════════
// @usrp/shared-types — DEPRECATED. QUARANTINED. SCHEDULED FOR DELETION.
//
// @deprecated Import from `@usrp/contracts` instead. That package is generated
// from hand-authored OpenAPI documents that were read out of the backend's own
// controllers and pinned to a verified commit; this one was written from
// imagination and never checked against anything.
//
// WHAT IS WRONG WITH THIS FILE, precisely, so nobody has to rediscover it:
//
//   ApplicationStatus  17 values. FIVE are real (DRAFT, SUBMITTED, ACCEPTED,
//                      REJECTED, WITHDRAWN). Twelve exist in no Postgres enum
//                      and no controller. The real system has 19 statuses per
//                      rdf_ops and 15 per rnp_ops / rcs_ops, and this type
//                      models the divergence not at all.
//   OfficerRole        SUPERADMIN is annotated "cross-agency visibility (no
//                      RLS)". No such principal exists. RLS is FORCE'd on every
//                      ops schema; nothing human bypasses it.
//   ApplicantProfile   `gender: 'OTHER'` is unrepresentable end to end — the
//                      NIDA gateway rejects it and no DB enum carries it.
//   DocumentType       6 values, ONE of which (NATIONAL_ID) is real, and
//                      modelled as agency-agnostic when the three agencies
//                      accept three different sets.
//   DocumentQuality    invented; no wire counterpart.
//   EXPIRED            listed as terminal; exists nowhere.
//
// THE RULES THIS FILE NOW LIVES UNDER (see `pnpm --filter @usrp/shared-types
// lint` and `test`): it may SHRINK as call sites migrate, and it may not GROW.
// Every fictional value above is enumerated in the ledger in
// packages/contracts/scripts/lint/rules.ts, and adding a value that is neither
// verified-real nor already-listed fails lint. `@usrp/api-client`, `@usrp/ui`,
// `@usrp/officer-console` and `@usrp/applicant-portal` still depend on this
// package; migrating them is not this agent's path to edit.
// ════════════════════════════════════════════════════════════════

// ─── Agency ──────────────────────────────────────────────────────────
/** @deprecated Use `Agency` from `@usrp/contracts`. */
export type Agency = "RDF" | "RNP" | "RCS";

// ─── Application lifecycle ─────────────────────────────────────────────
/**
 * @deprecated Use `ApplicationStatus` / `StatusFor<A>` from `@usrp/contracts`.
 * Twelve of the values below do not exist.
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

/**
 * @deprecated Use `TERMINAL_STATUSES` / `isTerminal` from `@usrp/contracts`,
 * which are per-agency. This set lists EXPIRED (fictional) and omits the real
 * RDF terminal state — see the header.
 */
export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
]);

// ─── Officers ──────────────────────────────────────────────────────
/** @deprecated SUPERADMIN does not exist. There is no principal that bypasses RLS. */
export type OfficerRole =
  | "RECRUITMENT_OFFICER"
  | "MEDICAL_OFFICER"
  | "VETTING_OFFICER"
  | "SENIOR_OFFICER"
  | "SUPERADMIN";

// ─── Applicant profile ───────────────────────────────────────────────
/** @deprecated Use the generated identity-service types from `@usrp/contracts`. */
export interface ApplicantProfile {
  /** USRP-internal identifier — NOT the NID. */
  readonly id: string;
  readonly displayName: string;
  /** Partial phone number shown to officer for contact. */
  readonly phoneFragment: string;
  readonly dateOfBirth: string;
  readonly gender: "MALE" | "FEMALE" | "OTHER";
}

// ─── Application ───────────────────────────────────────────────────
/** @deprecated Use `ApplicationSummaryFor<A>` from `@usrp/contracts`. */
export interface ApplicationListItem {
  readonly id: string;
  readonly applicantName: string;
  readonly agency: Agency;
  readonly status: ApplicationStatus;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly assignedOfficerId?: string;
  readonly requiresAction: boolean;
}

/** @deprecated Use `ApplicationDetailFor<A>` from `@usrp/contracts`. */
export interface Application extends ApplicationListItem {
  readonly applicant: ApplicantProfile;
  readonly postCode: string;
  readonly postTitle: string;
  readonly history: readonly ApplicationEvent[];
  readonly documents: readonly ApplicationDocument[];
}

// ─── Application events (audit trail) ────────────────────────────────────
/** @deprecated Use `StatusHistoryEntryFor<A>` from `@usrp/contracts`. */
export interface ApplicationEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly actorId: string;
  readonly actorRole: OfficerRole | "SYSTEM" | "APPLICANT";
  readonly fromStatus: ApplicationStatus | null;
  readonly toStatus: ApplicationStatus;
  readonly note: string | null;
}

// ─── Documents ─────────────────────────────────────────────────────
/** @deprecated Use `DOCUMENT_TYPES` / `DocumentTypeFor<A>` from `@usrp/contracts`. */
export type DocumentType =
  | "NATIONAL_ID"
  | "PASSPORT_PHOTO"
  | "ACADEMIC_CERTIFICATE"
  | "MEDICAL_REPORT"
  | "POLICE_CLEARANCE"
  | "PROOF_OF_RESIDENCE";

/**
 * @deprecated Invented; no wire counterpart. Use `DOCUMENT_UPLOAD_STATUSES` or
 * `DOCUMENT_LANES` from `@usrp/contracts` — and note that the lane is an
 * OFFICER-facing value, deliberately never returned to the citizen who
 * uploaded the file.
 */
export type DocumentQuality = "ACCEPTED" | "REJECTED" | "PENDING_REVIEW";

/** @deprecated Use the generated document-forensics-service types. */
export interface ApplicationDocument {
  readonly id: string;
  readonly type: DocumentType;
  readonly quality: DocumentQuality;
  readonly uploadedAt: string;
  readonly reviewNote: string | null;
}

// ─── Dashboard / metrics ─────────────────────────────────────────────
/** @deprecated No endpoint returns this shape. */
export interface OfficerDashboardMetrics {
  readonly pendingReview: number;
  readonly requiresAction: number;
  readonly scheduledToday: number;
  readonly acceptedThisWeek: number;
}

// ─── API pagination ─────────────────────────────────────────────────
/** @deprecated No endpoint in this platform paginates this way. */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
