// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/document-forensics-service.yaml           ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/document-forensics-service.yaml instead.║
// ╚══════════════════════════════════════════════════════════════╝

//
// Types INFERRED FROM THE ZOD SCHEMAS, not written beside them. There is
// exactly one description of each wire shape in this package and this file is a
// projection of it.

import type { z } from 'zod';
import type {
  AgencySchema,
  DocumentTypeSchema,
  UuidSchema,
  AnalyzeDocumentRequestSchema,
  ApplicationNotFound404Schema,
  ObjectNotFound404Schema,
  AnalyzeNotFound404Schema,
  AnalyzeRequest400Schema,
  ContentTypeMismatch422Schema,
  DocumentLaneSchema,
  DocumentAnalyzed200Schema,
  DocumentRejectedMalware422Schema,
  DocumentUploaded201Schema,
  FileTooLarge413Schema,
  Forbidden403Schema,
  ForensicsError500Schema,
  NotAcceptingDocuments409Schema,
  ObjectStoreUnavailable503Schema,
  ScannerUnavailable503Schema,
  Unauthenticated401Schema,
  UnsupportedDocumentType422Schema,
  UnsupportedFileContent422Schema,
  UnsupportedFileType422Schema,
  UploadDocumentFormSchema,
  UploadRequest400Schema,
  UploadUnavailable503Schema,
  UploadUnprocessable422Schema,
} from './document-forensics-service.zod.js';

export type Agency = z.infer<typeof AgencySchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type Uuid = z.infer<typeof UuidSchema>;
export type AnalyzeDocumentRequest = z.infer<typeof AnalyzeDocumentRequestSchema>;
export type ApplicationNotFound404 = z.infer<typeof ApplicationNotFound404Schema>;
export type ObjectNotFound404 = z.infer<typeof ObjectNotFound404Schema>;
export type AnalyzeNotFound404 = z.infer<typeof AnalyzeNotFound404Schema>;
export type AnalyzeRequest400 = z.infer<typeof AnalyzeRequest400Schema>;
export type ContentTypeMismatch422 = z.infer<typeof ContentTypeMismatch422Schema>;
export type DocumentLane = z.infer<typeof DocumentLaneSchema>;
export type DocumentAnalyzed200 = z.infer<typeof DocumentAnalyzed200Schema>;
export type DocumentRejectedMalware422 = z.infer<typeof DocumentRejectedMalware422Schema>;
export type DocumentUploaded201 = z.infer<typeof DocumentUploaded201Schema>;
export type FileTooLarge413 = z.infer<typeof FileTooLarge413Schema>;
export type Forbidden403 = z.infer<typeof Forbidden403Schema>;
export type ForensicsError500 = z.infer<typeof ForensicsError500Schema>;
export type NotAcceptingDocuments409 = z.infer<typeof NotAcceptingDocuments409Schema>;
export type ObjectStoreUnavailable503 = z.infer<typeof ObjectStoreUnavailable503Schema>;
export type ScannerUnavailable503 = z.infer<typeof ScannerUnavailable503Schema>;
export type Unauthenticated401 = z.infer<typeof Unauthenticated401Schema>;
export type UnsupportedDocumentType422 = z.infer<typeof UnsupportedDocumentType422Schema>;
export type UnsupportedFileContent422 = z.infer<typeof UnsupportedFileContent422Schema>;
export type UnsupportedFileType422 = z.infer<typeof UnsupportedFileType422Schema>;
export type UploadDocumentForm = z.infer<typeof UploadDocumentFormSchema>;
export type UploadRequest400 = z.infer<typeof UploadRequest400Schema>;
export type UploadUnavailable503 = z.infer<typeof UploadUnavailable503Schema>;
export type UploadUnprocessable422 = z.infer<typeof UploadUnprocessable422Schema>;
