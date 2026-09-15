// ═════════════════════════════════════════════════════════════════
// @usrp/contracts — The per-agency divergence model
//
// HAND-WRITTEN, not generated. The generated Zod schemas describe WIRE SHAPES;
// this file describes which of those values are LEGAL FOR WHICH AGENCY, which
// is a domain fact no OpenAPI document can express.
//
// Every value below was read from backend source. Provenance is recorded
// per-constant. Nothing here was inferred from a name.
// ═════════════════════════════════════════════════════════════════

/** The backend main commit every value in this file was verified against. */
export const VERIFIED_BACKEND_SHA = 'd40f6d824ec46209ec5411192251fca4561e36b0';

export const AGENCIES = ['RDF', 'RNP', 'RCS'] as const;
export type Agency = (typeof AGENCIES)[number];

export const APPLICATION_STATUSES = [
  'DRAFT', 'SUBMITTED', 'ACADEMIC_VETTING', 'CRIMINAL_CLEARANCE',
  'DOCUMENT_REVIEW_GREEN', 'DOCUMENT_REVIEW_AMBER', 'SLOT_ASSIGNED',
  'PHYSICAL_TEST_SCHEDULED', 'PHYSICAL_TEST_COMPLETE', 'MEDICAL_REVIEW',
  'FINAL_SHORTLIST', 'ACCEPTED', 'ADJUDICATION_REVIEW', 'REJECTED', 'WITHDRAWN',
  'WALK_IN_REGISTERED', 'WALK_IN_ON_SITE_VETTING', 'WALK_IN_PHYSICAL_TEST',
  'WALK_IN_REJECTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const RDF_ONLY_STATUSES = [
  'WALK_IN_REGISTERED', 'WALK_IN_ON_SITE_VETTING', 'WALK_IN_PHYSICAL_TEST', 'WALK_IN_REJECTED',
] as const;
export type RdfOnlyStatus = (typeof RDF_ONLY_STATUSES)[number];
export type SharedStatus = Exclude<ApplicationStatus, RdfOnlyStatus>;
export type StatusFor<A extends Agency> = A extends 'RDF' ? ApplicationStatus : SharedStatus;

export const STATUSES_BY_AGENCY: Readonly<Record<Agency, readonly ApplicationStatus[]>> = {
  RDF: APPLICATION_STATUSES,
  RNP: APPLICATION_STATUSES.filter((status): status is SharedStatus => !(RDF_ONLY_STATUSES as readonly string[]).includes(status)),
  RCS: APPLICATION_STATUSES.filter((status): status is SharedStatus => !(RDF_ONLY_STATUSES as readonly string[]).includes(status)),
};

export const TERMINAL_STATUSES = {
  RDF: ['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'WALK_IN_REJECTED'],
  RNP: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  RCS: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
} as const satisfies { readonly [A in Agency]: readonly StatusFor<A>[] };

export function isTerminal<A extends Agency>(agency: A, status: StatusFor<A>): boolean {
  return (TERMINAL_STATUSES[agency] as readonly string[]).includes(status);
}

export const DOCUMENT_TYPES = [
  'NATIONAL_ID', 'APPLICATION_FORM_WITH_PHOTO', 'BIRTH_CERTIFICATE',
  'OLEVEL_CERTIFICATE', 'ALEVEL_CERTIFICATE', 'DEGREE_DIPLOMA_COPY',
  'DEGREE_DIPLOMA_NOTARIZED', 'GOOD_CONDUCT_CERTIFICATE',
  'NON_CONVICTION_CERTIFICATE', 'CELIBACY_CERTIFICATE', 'MEDICAL_CERTIFICATE_GOVT',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const AGENCY_DOCUMENT_TYPES = {
  RDF: ['NATIONAL_ID', 'OLEVEL_CERTIFICATE', 'ALEVEL_CERTIFICATE', 'DEGREE_DIPLOMA_COPY', 'GOOD_CONDUCT_CERTIFICATE', 'NON_CONVICTION_CERTIFICATE'],
  RNP: ['NATIONAL_ID', 'APPLICATION_FORM_WITH_PHOTO', 'ALEVEL_CERTIFICATE', 'DEGREE_DIPLOMA_COPY', 'GOOD_CONDUCT_CERTIFICATE'],
  RCS: ['NATIONAL_ID', 'APPLICATION_FORM_WITH_PHOTO', 'BIRTH_CERTIFICATE', 'ALEVEL_CERTIFICATE', 'DEGREE_DIPLOMA_NOTARIZED', 'GOOD_CONDUCT_CERTIFICATE', 'NON_CONVICTION_CERTIFICATE', 'CELIBACY_CERTIFICATE', 'MEDICAL_CERTIFICATE_GOVT'],
} as const satisfies { readonly [A in Agency]: readonly DocumentType[] };
export type DocumentTypeFor<A extends Agency> = (typeof AGENCY_DOCUMENT_TYPES)[A][number];
export function isDocumentTypeSupported(agency: Agency, documentType: DocumentType): boolean {
  return (AGENCY_DOCUMENT_TYPES[agency] as readonly string[]).includes(documentType);
}

export const DOCUMENT_UPLOAD_STATUSES = [
  'PENDING_UPLOAD', 'UPLOADED', 'VIRUS_SCAN_PASS', 'FORENSICS_GREEN',
  'FORENSICS_AMBER', 'FORENSICS_RED', 'VERIFIED_VIA_API', 'REJECTED',
] as const;
export type DocumentUploadStatus = (typeof DOCUMENT_UPLOAD_STATUSES)[number];
export const DOCUMENT_LANES = ['GREEN', 'AMBER', 'RED'] as const;
export type DocumentLane = (typeof DOCUMENT_LANES)[number];

export const GENDERS = ['MALE', 'FEMALE'] as const;
export type Gender = (typeof GENDERS)[number];
export const IDENTITY_STATUSES = ['PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];
export const APPLICATION_CHANNELS = ['WEB', 'USSD', 'IREMBO_KIOSK', 'WALK_IN'] as const;
export type ApplicationChannel = (typeof APPLICATION_CHANNELS)[number];

export const AUTH_KINDS = ['officer', 'system', 'applicant-session', 'none'] as const;
export type AuthKind = (typeof AUTH_KINDS)[number];
export const ROUTE_REACHES = ['browser', 'service-internal'] as const;
export type RouteReach = (typeof ROUTE_REACHES)[number];

type Assert<T extends true> = T;
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type _StatusPartition = Assert<Eq<SharedStatus | RdfOnlyStatus, ApplicationStatus>>;
type _StatusDisjoint = Assert<Eq<Extract<SharedStatus, RdfOnlyStatus>, never>>;
type _RdfSeesAll = Assert<Eq<StatusFor<'RDF'>, ApplicationStatus>>;
type _RnpIsShared = Assert<Eq<StatusFor<'RNP'>, SharedStatus>>;
type _RcsIsShared = Assert<Eq<StatusFor<'RCS'>, SharedStatus>>;
type _WalkInIsRdfOnly = Assert<Eq<Extract<StatusFor<'RNP'>, 'WALK_IN_REGISTERED'>, never>>;
type _DocTypesAreSubsets = Assert<Eq<Exclude<DocumentTypeFor<Agency>, DocumentType>, never>>;
type _CelibacyIsRcsOnly = Assert<Eq<Extract<DocumentTypeFor<'RDF'>, 'CELIBACY_CERTIFICATE'>, never>>;
type _OLevelIsRdfOnly = Assert<Eq<Extract<DocumentTypeFor<'RCS'>, 'OLEVEL_CERTIFICATE'>, never>>;
