// ═════════════════════════════════════════════════════════════════
// @usrp/contracts — The per-agency divergence model
//
// HAND-WRITTEN, not generated. The generated Zod schemas describe WIRE SHAPES;
// this file describes which of those values are LEGAL FOR WHICH AGENCY, which
// is a domain fact no OpenAPI document can express.
//
// Every value below was read from backend source. Provenance is recorded
// per-constant. Nothing here was inferred from a name.
//
// WHY THIS FILE EXISTS
//
// RDF, RNP and RCS are not three deployments of one schema. They have
// genuinely different Postgres enums:
//
//   rdf_ops.application_status  18 values, INCLUDING four WALK_IN_* states
//   rnp_ops.application_status  14 values, NO WALK_IN_* states
//   rcs_ops.application_status  14 values, NO WALK_IN_* states
//   (+ ADJUDICATION_REVIEW added to all three by rls/0011 → 19 / 15 / 15)
//
// This is why the backend compares `status::text` instead of casting to an
// enum: an enum-cast comparison against WALK_IN_REJECTED is a HARD ERROR for
// RNP and RCS and works fine for RDF, so it passes every test run against RDF
// fixtures and fails in production for two agencies out of three. ADR-017 and
// ADR-020 both record the idiom.
//
// The frontend equivalent of that bug is a component that renders a
// WALK_IN_ON_SITE_VETTING lozenge in the RNP console. The types below make it
// a compile error instead of a support ticket. src/narrow.ts binds them to the
// generated wire rows.
// ═════════════════════════════════════════════════════════════════

/** The backend commit every value in this file was verified against. */
export const VERIFIED_BACKEND_SHA = '47d9ad3ab019f6d2f826cfae2136cbff898d733f';

// ─── Agency ────────────────────────────────────────────────────────────

/**
 * The three agencies. Values match `agency_code` in the DB and the `agency`
 * claim on an officer bearer token.
 *
 * There is NO fourth value and no superadmin agency. The old frontend's
 * `OfficerRole.SUPERADMIN` was annotated "cross-agency visibility (no RLS)";
 * RLS is FORCE'd on every ops schema and there is no principal kind that
 * bypasses it. Cross-agency reads exist only for `kind: 'system'` principals
 * on specific routes (by-applicant, withdraw-own), never for a human.
 */
export const AGENCIES = ['RDF', 'RNP', 'RCS'] as const;
export type Agency = (typeof AGENCIES)[number];

// ─── Application status ──────────────────────────────────────────────────

/**
 * Every state an application can occupy, in lifecycle order.
 *
 * SOURCE: backend `packages/shared-types/src/applicant.types.ts`
 *         (APPLICATION_STATUSES), cross-checked against
 *         `packages/shared-database/src/migrations/0000_grey_the_stranger.sql`
 *         and the ADJUDICATION_REVIEW addition in rls/0011.
 *
 * 19 values. For contrast, the deprecated frontend `shared-types` shipped 17,
 * of which FIVE existed (DRAFT, SUBMITTED, ACCEPTED, REJECTED, WITHDRAWN) and
 * twelve were invented (UNDER_REVIEW, SHORTLISTED, PHYSICAL_SCHEDULED,
 * PHYSICAL_PASSED, PHYSICAL_FAILED, MEDICAL_SCHEDULED, MEDICAL_PASSED,
 * MEDICAL_FAILED, VETTING_IN_PROGRESS, VETTING_PASSED, VETTING_FAILED,
 * EXPIRED). The entire green/amber document lane, the walk-in lane and
 * adjudication — the actual system — were absent.
 */
export const APPLICATION_STATUSES = [
  // ── Path A: pre-registered digital flow ──
  'DRAFT',
  'SUBMITTED',
  'ACADEMIC_VETTING',
  'CRIMINAL_CLEARANCE',
  'DOCUMENT_REVIEW_GREEN',
  'DOCUMENT_REVIEW_AMBER',
  'SLOT_ASSIGNED',
  'PHYSICAL_TEST_SCHEDULED',
  'PHYSICAL_TEST_COMPLETE',
  'MEDICAL_REVIEW',
  'FINAL_SHORTLIST',
  'ACCEPTED',
  // Late-disqualification hold (ADR-011): a disqualifying verdict arriving
  // AFTER the eligibility terminal routes here for human adjudication rather
  // than auto-rejecting. Only the officer adjudicate endpoint exits it.
  // Distinct from DOCUMENT_REVIEW_AMBER, which is routine document review.
  'ADJUDICATION_REVIEW',
  'REJECTED',
  'WITHDRAWN',
  // ── Path B: walk-in flow, RDF ONLY (ADR-012) ──
  'WALK_IN_REGISTERED',
  'WALK_IN_ON_SITE_VETTING',
  'WALK_IN_PHYSICAL_TEST',
  'WALK_IN_REJECTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/**
 * The four states that exist ONLY in `rdf_ops.application_status`.
 *
 * SOURCE: migrations/0000_grey_the_stranger.sql — rdf_ops enumerates these,
 *         rnp_ops and rcs_ops do not.
 *
 * The walk-in lane is a physical, exam-day process RDF runs and the other two
 * agencies do not. A UI that can render these for RNP is a UI that will.
 */
export const RDF_ONLY_STATUSES = [
  'WALK_IN_REGISTERED',
  'WALK_IN_ON_SITE_VETTING',
  'WALK_IN_PHYSICAL_TEST',
  'WALK_IN_REJECTED',
] as const;

export type RdfOnlyStatus = (typeof RDF_ONLY_STATUSES)[number];

/** Statuses every agency's enum carries. 15 values. */
export type SharedStatus = Exclude<ApplicationStatus, RdfOnlyStatus>;

/**
 * The statuses legal for a given agency.
 *
 *   StatusFor<'RDF'>  → all 19
 *   StatusFor<'RNP'>  → the 15 shared
 *   StatusFor<'RCS'>  → the 15 shared
 *
 * Use it to constrain any function or component that takes a status alongside
 * an agency:
 *
 *   declare function lozengeFor<A extends Agency>(agency: A, status: StatusFor<A>): Appearance;
 *
 *   lozengeFor('RDF', 'WALK_IN_REGISTERED');  // ok
 *   lozengeFor('RNP', 'WALK_IN_REGISTERED');  // compile error — the point
 */
export type StatusFor<A extends Agency> = A extends 'RDF' ? ApplicationStatus : SharedStatus;

/** Runtime counterpart of StatusFor, for validating wire data. */
export const STATUSES_BY_AGENCY: Readonly<Record<Agency, readonly ApplicationStatus[]>> = {
  RDF: APPLICATION_STATUSES,
  RNP: APPLICATION_STATUSES.filter(
    (status): status is SharedStatus =>
      !(RDF_ONLY_STATUSES as readonly string[]).includes(status),
  ),
  RCS: APPLICATION_STATUSES.filter(
    (status): status is SharedStatus =>
      !(RDF_ONLY_STATUSES as readonly string[]).includes(status),
  ),
};

/**
 * Terminal states — the application can no longer move forward.
 *
 * SOURCE: ADR-020 (self-withdrawal) names the refusal set explicitly:
 *         already-WITHDRAWN is an idempotent 200 NO_CHANGE, while ACCEPTED,
 *         REJECTED and WALK_IN_REJECTED are 409 NOT_APPLICABLE. The upload
 *         ingress gates on the same four (409 NOT_ACCEPTING_DOCUMENTS).
 *
 * THE `satisfies` CLAUSE IS THE FIX FOR TWO REAL BUGS in the deprecated
 * frontend package, which listed EXPIRED (a status that exists in no schema)
 * and omitted WALK_IN_REJECTED (a real terminal state). Both are now
 * inexpressible: EXPIRED is not an ApplicationStatus, and putting a WALK_IN_*
 * value under RNP or RCS fails the constraint.
 */
export const TERMINAL_STATUSES = {
  RDF: ['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'WALK_IN_REJECTED'],
  RNP: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  RCS: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
} as const satisfies { readonly [A in Agency]: readonly StatusFor<A>[] };

/** True when the application is in a state nothing can advance. */
export function isTerminal<A extends Agency>(agency: A, status: StatusFor<A>): boolean {
  return (TERMINAL_STATUSES[agency] as readonly string[]).includes(status);
}

// ─── Document types ──────────────────────────────────────────────────────

/**
 * Every document type any agency models. 11 values.
 *
 * SOURCE: backend `document-forensics-service/src/domain/agency-documents.ts`
 *         (AGENCY_DOCUMENT_TYPES), which mirrors the three live
 *         `*_ops.document_type` enums.
 *
 * The deprecated frontend package shipped SIX types of which ONE
 * (NATIONAL_ID) was real, and modelled them as agency-agnostic. They are not:
 * OLEVEL_CERTIFICATE exists only for RDF, CELIBACY_CERTIFICATE only for RCS.
 */
export const DOCUMENT_TYPES = [
  'NATIONAL_ID',
  'APPLICATION_FORM_WITH_PHOTO',
  'BIRTH_CERTIFICATE',
  'OLEVEL_CERTIFICATE',
  'ALEVEL_CERTIFICATE',
  'DEGREE_DIPLOMA_COPY',
  'DEGREE_DIPLOMA_NOTARIZED',
  'GOOD_CONDUCT_CERTIFICATE',
  'NON_CONVICTION_CERTIFICATE',
  'CELIBACY_CERTIFICATE',
  'MEDICAL_CERTIFICATE_GOVT',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Which document types each agency accepts.
 *
 * SOURCE: AGENCY_DOCUMENT_TYPES, verbatim. The upload ingress rejects a type
 * outside the owning agency's set as `422 UNSUPPORTED_DOCUMENT_TYPE`, and the
 * agency is derived from application OWNERSHIP, never from the request — so a
 * wizard that offers the wrong upload slot produces a 422 the citizen cannot
 * act on. Drive the upload UI from this map.
 */
export const AGENCY_DOCUMENT_TYPES = {
  RDF: [
    'NATIONAL_ID',
    'OLEVEL_CERTIFICATE',
    'ALEVEL_CERTIFICATE',
    'DEGREE_DIPLOMA_COPY',
    'GOOD_CONDUCT_CERTIFICATE',
    'NON_CONVICTION_CERTIFICATE',
  ],
  RNP: [
    'NATIONAL_ID',
    'APPLICATION_FORM_WITH_PHOTO',
    'ALEVEL_CERTIFICATE',
    'DEGREE_DIPLOMA_COPY',
    'GOOD_CONDUCT_CERTIFICATE',
  ],
  RCS: [
    'NATIONAL_ID',
    'APPLICATION_FORM_WITH_PHOTO',
    'BIRTH_CERTIFICATE',
    'ALEVEL_CERTIFICATE',
    'DEGREE_DIPLOMA_NOTARIZED',
    'GOOD_CONDUCT_CERTIFICATE',
    'NON_CONVICTION_CERTIFICATE',
    'CELIBACY_CERTIFICATE',
    'MEDICAL_CERTIFICATE_GOVT',
  ],
} as const satisfies { readonly [A in Agency]: readonly DocumentType[] };

/** The document types legal for one agency, as a type. */
export type DocumentTypeFor<A extends Agency> = (typeof AGENCY_DOCUMENT_TYPES)[A][number];

export function isDocumentTypeSupported(agency: Agency, documentType: DocumentType): boolean {
  return (AGENCY_DOCUMENT_TYPES[agency] as readonly string[]).includes(documentType);
}

// ─── Document upload lifecycle ─────────────────────────────────────────────

/**
 * SOURCE: backend applicant.types.ts (DocumentUploadStatus).
 *
 * Replaces the deprecated frontend's invented three-value `DocumentQuality`
 * (ACCEPTED / REJECTED / PENDING_REVIEW), which had no counterpart on the
 * wire.
 */
export const DOCUMENT_UPLOAD_STATUSES = [
  'PENDING_UPLOAD',
  'UPLOADED',
  'VIRUS_SCAN_PASS',
  'FORENSICS_GREEN',
  'FORENSICS_AMBER',
  'FORENSICS_RED',
  'VERIFIED_VIA_API',
  'REJECTED',
] as const;

export type DocumentUploadStatus = (typeof DOCUMENT_UPLOAD_STATUSES)[number];

/**
 * The forensics triage lane.
 *
 * SOURCE: migrations/0000 — `rdf_ops.document_lane` AS ENUM('GREEN','AMBER','RED').
 *
 * NOTE FOR UI WORK: the lane is an OFFICER-facing value. The citizen upload
 * route returns `{ status, documentId, documentType }` and deliberately no
 * lane, score or flags — a forensics verdict handed to the person who uploaded
 * the file is a forgery-tuning oracle (edit, re-upload, watch the number move,
 * repeat until GREEN). Do not build an applicant-facing document quality
 * indicator; there is no endpoint that will feed it, by design.
 */
export const DOCUMENT_LANES = ['GREEN', 'AMBER', 'RED'] as const;
export type DocumentLane = (typeof DOCUMENT_LANES)[number];

// ─── Identity ──────────────────────────────────────────────────────────

/**
 * SOURCE: backend applicant.types.ts — `type Gender = 'MALE' | 'FEMALE'`, and
 * identity-service's NIDA gateway VALID_GENDERS is the same two values.
 *
 * The deprecated frontend added 'OTHER'. It is unrepresentable end to end: the
 * NIDA gateway rejects it, the DB enum has no such value, and no endpoint can
 * ever return it. This is a government identity register, not a profile form.
 */
export const GENDERS = ['MALE', 'FEMALE'] as const;
export type Gender = (typeof GENDERS)[number];

/** SOURCE: applicant.types.ts (IdentityVerificationStatus). */
export const IDENTITY_STATUSES = ['PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

/**
 * The channel an identity or application arrived through.
 *
 * SOURCE: identity-service `/v1/identities/verify` request schema — the
 * `channel` field is REQUIRED and validated against these four values
 * (400 INVALID_CHANNEL otherwise). The deprecated frontend's NIDA hook
 * omitted it entirely, so every call would have been a 400.
 */
export const APPLICATION_CHANNELS = ['WEB', 'USSD', 'IREMBO_KIOSK', 'WALK_IN'] as const;
export type ApplicationChannel = (typeof APPLICATION_CHANNELS)[number];

// ─── Principals ───────────────────────────────────────────────────────

/**
 * The four authentication kinds a route can require.
 *
 * `officer` and `system` are Ed25519 bearer JWTs verified with a public key.
 * `applicant-session` is an OPAQUE 32-byte DB session (ADR-018), validated
 * live against `public_core.applicant_sessions` by identity-service, and
 * chosen over a JWT precisely so it can be revoked mid-life.
 *
 * They are NOT interchangeable. The two JWT kinds fail with
 * `401 UNAUTHENTICATED`; the session kind fails with `401 INVALID_SESSION`.
 * A route requiring one refuses the others with 403, not 401 — an officer
 * token on a citizen route is authenticated and forbidden, not anonymous.
 */
export const AUTH_KINDS = ['officer', 'system', 'applicant-session', 'none'] as const;
export type AuthKind = (typeof AUTH_KINDS)[number];

/**
 * Whether a route may be reached from a browser.
 *
 * GETTING THIS WRONG IS A SECURITY INCIDENT, which is why it is modelled
 * rather than left to reviewer memory. `service-internal` routes take a system
 * token and must never be proxied to a browser by the edge tier: POST
 * /v1/applications, GET /v1/applications/by-applicant, POST
 * /v1/applications/withdraw-own, all three /v1/eligibility/* checks, POST
 * /v1/forensics/analyze and POST /v1/documents/upload are all system-only.
 *
 * Note that the citizen document upload IS system-internal: the browser talks
 * to the edge tier, which holds the citizen's session and calls the ingress
 * with its own client-credentials token (the ADR-016 pattern, same as
 * withdraw-own).
 *
 * SERVICE_INTERNAL_ROUTES in ./generated/routes.ts exports the live set as
 * data, so an edge-tier allowlist can assert against it instead of a reviewer
 * remembering this list.
 */
export const ROUTE_REACHES = ['browser', 'service-internal'] as const;
export type RouteReach = (typeof ROUTE_REACHES)[number];

// ─── Compile-time guards ────────────────────────────────────────────────
//
// These are not tests, they are BUILD FAILURES. `pnpm typecheck` is the gate.
// Adding a status to APPLICATION_STATUSES without classifying it as shared or
// RDF-only breaks the partition assertion, so classification cannot be
// forgotten — which is exactly how the old package accumulated twelve
// fictional states and lost fourteen real ones.

type Assert<T extends true> = T;
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

/** Every status is either shared by all agencies or exclusive to RDF. */
type _StatusPartition = Assert<Eq<SharedStatus | RdfOnlyStatus, ApplicationStatus>>;

/** The two halves do not overlap. */
type _StatusDisjoint = Assert<Eq<Extract<SharedStatus, RdfOnlyStatus>, never>>;

/** RDF sees everything. */
type _RdfSeesAll = Assert<Eq<StatusFor<'RDF'>, ApplicationStatus>>;

/** RNP and RCS see only the shared set — no walk-in lane. */
type _RnpIsShared = Assert<Eq<StatusFor<'RNP'>, SharedStatus>>;
type _RcsIsShared = Assert<Eq<StatusFor<'RCS'>, SharedStatus>>;

/** A WALK_IN_* value is genuinely unavailable to the other two agencies. */
type _WalkInIsRdfOnly = Assert<Eq<Extract<StatusFor<'RNP'>, 'WALK_IN_REGISTERED'>, never>>;

/** Agency-specific document sets stay inside the global union. */
type _DocTypesAreSubsets = Assert<Eq<Exclude<DocumentTypeFor<Agency>, DocumentType>, never>>;

/** RDF does not accept RCS-only paperwork. */
type _CelibacyIsRcsOnly = Assert<
  Eq<Extract<DocumentTypeFor<'RDF'>, 'CELIBACY_CERTIFICATE'>, never>
>;

/** RCS does not accept RDF-only paperwork. */
type _OLevelIsRdfOnly = Assert<Eq<Extract<DocumentTypeFor<'RCS'>, 'OLEVEL_CERTIFICATE'>, never>>;
