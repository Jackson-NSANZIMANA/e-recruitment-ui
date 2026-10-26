// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/document-forensics-service.yaml           ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  df80f6517247a00ffd99518fd31bd7c68dd70d65          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/document-forensics-service.yaml instead.║
// ╚══════════════════════════════════════════════════════════════╝

//
// USRP document-forensics-service
//
// Route table (method, path, auth kinds, reach):
//   POST /v1/documents/upload                           system             service-internal
//   POST /v1/forensics/analyze                          system             service-internal
//   GET  /health                                        none               service-internal
//   GET  /ready                                         none               service-internal
//
// `z.strictObject()` on every closed object is intentional: an unexpected key means
// the wire grew a field this package has never read, and that is the drift this
// whole package exists to catch. It should fail loudly, in development, on the
// first response that carries it.

import { z } from 'zod';

export const AgencySchema = z.enum(['RDF', 'RNP', 'RCS']);

/**
 * All 11 types any agency models, from the controller's DOCUMENT_TYPES set
 * (analyze) and KNOWN_DOCUMENT_TYPES derived from AGENCY_DOCUMENT_TYPES
 * (upload). WHICH are legal for WHICH agency is per-agency and lives in
 * src/agency.ts — this enum is only the "is that a word at all" gate.
 */
export const DocumentTypeSchema = z.enum(['NATIONAL_ID', 'APPLICATION_FORM_WITH_PHOTO', 'ALEVEL_CERTIFICATE', 'OLEVEL_CERTIFICATE', 'DEGREE_DIPLOMA_COPY', 'DEGREE_DIPLOMA_NOTARIZED', 'GOOD_CONDUCT_CERTIFICATE', 'NON_CONVICTION_CERTIFICATE', 'CELIBACY_CERTIFICATE', 'MEDICAL_CERTIFICATE_GOVT', 'BIRTH_CERTIFICATE']);

export const UuidSchema = z.string().guid().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

export const AnalyzeDocumentRequestSchema = z
  .strictObject({
    "applicationId": UuidSchema,
    "agency": AgencySchema,
    "documentType": DocumentTypeSchema,
    "objectKey": z.string().min(1).max(512),
    "objectBucket": z.string().min(1).max(100).optional(),
  });

export const ApplicationNotFound404Schema = z
  .strictObject({
    "error": z.literal('APPLICATION_NOT_FOUND'),
  });

/**
 * The record exists; its bytes are missing from the store.
 */
export const ObjectNotFound404Schema = z
  .strictObject({
    "error": z.literal('OBJECT_NOT_FOUND'),
  });

export const AnalyzeNotFound404Schema = z.discriminatedUnion('error', [
  ApplicationNotFound404Schema,
  ObjectNotFound404Schema,
]);

export const AnalyzeRequest400Schema = z
  .strictObject({
    "error": z.enum(['MISSING_FIELD', 'FIELD_TOO_LONG', 'INVALID_APPLICATION_ID', 'INVALID_AGENCY', 'INVALID_DOCUMENT_TYPE']),
    "detail": z.string().optional(),
  });

export const ContentTypeMismatch422Schema = z
  .strictObject({
    "error": z.literal('CONTENT_TYPE_MISMATCH'),
    "declared": z.string(),
  });

/**
 * OFFICER-facing triage lane. Never returned to a document's author.
 */
export const DocumentLaneSchema = z.enum(['GREEN', 'AMBER', 'RED']);

export const DocumentAnalyzed200Schema = z
  .strictObject({
    "status": z.literal('ANALYZED'),
    "documentId": UuidSchema,
    "lane": DocumentLaneSchema,
    "forensicsScore": z.number(),
    "flags": z.record(z.string(), z.unknown()),
  });

/**
 * THE ONE VERDICT REPORTED PLAINLY TO THE UPLOADER. A binary antivirus
 * result teaches a forger nothing, and silently accepting an infected file
 * is unusable for a legal process.
 */
export const DocumentRejectedMalware422Schema = z
  .strictObject({
    "error": z.literal('DOCUMENT_REJECTED_MALWARE'),
  });

/**
 * THE WHOLE BODY. Three fields. No verdict, by design.
 */
export const DocumentUploaded201Schema = z
  .strictObject({
    "status": z.literal('UPLOADED'),
    "documentId": UuidSchema,
    "documentType": DocumentTypeSchema,
  });

export const FileTooLarge413Schema = z
  .strictObject({
    "error": z.literal('FILE_TOO_LARGE'),
    "detail": z.string().optional(),
  });

export const Forbidden403Schema = z
  .strictObject({
    "error": z.literal('FORBIDDEN'),
    "detail": z.string().optional(),
  });

export const ForensicsError500Schema = z
  .strictObject({
    "error": z.enum(['DOCUMENT_ENCRYPTION_ERROR', 'FORENSICS_PERSISTENCE_ERROR', 'INTERNAL_ERROR']),
  });

export const NotAcceptingDocuments409Schema = z
  .strictObject({
    "error": z.literal('NOT_ACCEPTING_DOCUMENTS'),
    "currentStatus": z.string(),
  });

export const ObjectStoreUnavailable503Schema = z
  .strictObject({
    "error": z.literal('OBJECT_STORE_UNAVAILABLE'),
  });

export const ScannerUnavailable503Schema = z
  .strictObject({
    "error": z.literal('SCANNER_UNAVAILABLE'),
  });

export const Unauthenticated401Schema = z
  .strictObject({
    "error": z.literal('UNAUTHENTICATED'),
    "detail": z.string().optional(),
  });

export const UnsupportedDocumentType422Schema = z
  .strictObject({
    "error": z.literal('UNSUPPORTED_DOCUMENT_TYPE'),
  });

export const UnsupportedFileContent422Schema = z
  .strictObject({
    "error": z.literal('UNSUPPORTED_FILE_CONTENT'),
  });

export const UnsupportedFileType422Schema = z
  .strictObject({
    "error": z.literal('UNSUPPORTED_FILE_TYPE'),
    "detail": z.string().optional(),
  });

/**
 * multipart/form-data. The file part MUST be named exactly "file"; a
 * differently named file part is 400 MISSING_FILE, not a warning. Max 8
 * parts, max 1 file, max 4 KiB per text field.
 */
export const UploadDocumentFormSchema = z
  .strictObject({
    "file": z.string(),
    "applicantId": UuidSchema,
    "applicationId": UuidSchema,
    "documentType": DocumentTypeSchema,
  });

export const UploadRequest400Schema = z
  .strictObject({
    "error": z.enum(['MISSING_FILE', 'INVALID_FILENAME', 'EMPTY_FILE', 'INVALID_DOCUMENT_TYPE', 'INVALID_REQUEST']),
    "detail": z.string().optional(),
  });

export const UploadUnavailable503Schema = z.discriminatedUnion('error', [
  ScannerUnavailable503Schema,
  ObjectStoreUnavailable503Schema,
]);

export const UploadUnprocessable422Schema = z.discriminatedUnion('error', [
  UnsupportedFileType422Schema,
  UnsupportedDocumentType422Schema,
  UnsupportedFileContent422Schema,
  ContentTypeMismatch422Schema,
  DocumentRejectedMalware422Schema,
]);

/**
 * Every operation on this service, with the schema for each documented status.
 * A status ABSENT from a map is a status this package is not documented to
 * return on that route — treat receiving one as a contract breach worth
 * reporting, not as an unknown to swallow.
 */
export const documentForensicsServiceOperations = {
  "uploadDocument": {
    method: "POST",
    path: "/v1/documents/upload",
    auth: ["system"],
    reach: "service-internal",
    request: UploadDocumentFormSchema,
    requestMediaType: "multipart/form-data",
    query: [],
    responses: {
      "201": DocumentUploaded201Schema,
      "400": UploadRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": ApplicationNotFound404Schema,
      "409": NotAcceptingDocuments409Schema,
      "413": FileTooLarge413Schema,
      "422": UploadUnprocessable422Schema,
      "500": ForensicsError500Schema,
      "503": UploadUnavailable503Schema,
    },
  },
  "analyzeDocument": {
    method: "POST",
    path: "/v1/forensics/analyze",
    auth: ["system"],
    reach: "service-internal",
    request: AnalyzeDocumentRequestSchema,
    requestMediaType: "application/json",
    query: [],
    responses: {
      "200": DocumentAnalyzed200Schema,
      "400": AnalyzeRequest400Schema,
      "401": Unauthenticated401Schema,
      "403": Forbidden403Schema,
      "404": AnalyzeNotFound404Schema,
      "422": UnsupportedDocumentType422Schema,
      "500": ForensicsError500Schema,
      "503": UploadUnavailable503Schema,
    },
  },
  "forensicsHealth": {
    method: "GET",
    path: "/health",
    auth: ["none"],
    reach: "service-internal",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": null,
    },
  },
  "forensicsReady": {
    method: "GET",
    path: "/ready",
    auth: ["none"],
    reach: "service-internal",
    request: null,
    requestMediaType: null,
    query: [],
    responses: {
      "200": null,
      "503": null,
    },
  },
} as const;
