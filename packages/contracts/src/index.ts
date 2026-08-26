// ════════════════════════════════════════════════════════════════
// @usrp/contracts — public surface
//
// The only legal source of domain types in this frontend.
// packages/shared-types is DEPRECATED and slated for deletion; do not add to
// it and do not import it in new code.
//
// This barrel exports only what has actually been written and verified against
// backend source. The generated Zod schemas and their inferred types join it
// when scripts/generate.ts lands — not before, so that an import which
// resolves is an import backed by a real contract rather than a placeholder.
//
// See README.md for the status ledger: two of eleven services are authored,
// and 0 assertions are proven.
// ════════════════════════════════════════════════════════════════

export {
  VERIFIED_BACKEND_SHA,
  AGENCIES,
  APPLICATION_STATUSES,
  RDF_ONLY_STATUSES,
  STATUSES_BY_AGENCY,
  TERMINAL_STATUSES,
  isTerminal,
  DOCUMENT_TYPES,
  AGENCY_DOCUMENT_TYPES,
  isDocumentTypeSupported,
  DOCUMENT_UPLOAD_STATUSES,
  DOCUMENT_LANES,
  GENDERS,
  IDENTITY_STATUSES,
  APPLICATION_CHANNELS,
  AUTH_KINDS,
  ROUTE_REACHES,
} from './agency.js';

export type {
  Agency,
  ApplicationStatus,
  RdfOnlyStatus,
  SharedStatus,
  StatusFor,
  DocumentType,
  DocumentTypeFor,
  DocumentUploadStatus,
  DocumentLane,
  Gender,
  IdentityStatus,
  ApplicationChannel,
  AuthKind,
  RouteReach,
} from './agency.js';
