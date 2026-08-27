// ════════════════════════════════════════════════════════════════
// @usrp/contracts — public surface
//
// THE ONLY LEGAL SOURCE OF DOMAIN TYPES IN THIS FRONTEND.
// packages/shared-types is DEPRECATED and slated for deletion; do not add to it
// and do not import it in new code. See README.md.
//
// Three layers, and the distinction is load-bearing:
//
//   ./generated  WIRE SHAPES, generated from openapi/*.yaml. Namespaced per
//                service, because eleven services independently name a schema
//                `Uuid` and three genuinely different bodies share the name
//                `Forbidden403`.
//   ./agency     WHICH VALUES ARE LEGAL FOR WHICH AGENCY — a domain fact no
//                OpenAPI document can express. Hand-written, provenance per
//                constant.
//   ./narrow     the JOIN of the two, which is what makes an unreachable status
//                a compile error instead of a runtime surprise.
// ════════════════════════════════════════════════════════════════

// ── The per-agency divergence model ──
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

// ── Binding the wire types to the divergence model ──
export {
  ALL_AGENCIES,
  AgencyStatusError,
  assertStatusFor,
  isStatusFor,
  narrowRow,
  narrowRows,
} from './narrow.js';

export type {
  ApplicantApplicationSummaryFor,
  ApplicationDetailFor,
  ApplicationSummaryFor,
  StatusHistoryEntryFor,
  WithStatusFor,
} from './narrow.js';

// ── Generated wire schemas, types and the route table ──
export {
  applicationService,
  auditService,
  backgroundVettingService,
  biometricService,
  documentForensicsService,
  eligibilityService,
  fieldSyncService,
  iamService,
  identityService,
  notificationService,
  schedulingService,
  ROUTE_TABLE,
  BROWSER_ROUTES,
  SERVICE_INTERNAL_ROUTES,
} from './generated/index.js';

export type { RouteFact } from './generated/index.js';
