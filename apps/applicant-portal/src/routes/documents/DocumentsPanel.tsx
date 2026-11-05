// The citizen's document upload panel (ADR-030 document door, ADR-032 requirements, D8 revisions).
// Shown right after filing (apply journey) AND on the citizen's documents screen, so a document the
// campaign requires — including the criminal-record certificate PDF an officer must read — can be
// sent whenever the citizen comes back, not only in the minute after submitting.
import React, { useEffect, useState } from "react";
import { Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button";
import Select from "@atlaskit/select";
import { Field } from "@atlaskit/form";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { AGENCY_DOCUMENT_TYPES, type Agency } from "@usrp/contracts";
import {
  ApiError,
  createApiClient,
  getMyDocumentChecklist,
  isUnconfirmedUploadOutcome,
  useMyDocumentChecklist,
  useUploadMyDocument,
  type NormalisedError,
  type UploadDocumentResponse,
} from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { CITIZEN_APPLY_NAMESPACES } from "../locales.js";
import { EDGE_BASE_URL } from "../../env.js";
import { requiredItemCopyKey, selectedType, uploadChoices } from "../apply/required-documents.js";
import { ClearanceBlock } from "./ClearanceBlock.js";
import { documentTypeKey, isInFlight } from "./model.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
/** How often the panel re-reads the checklist while Irembo answers a clearance number. */
const CHECKLIST_POLL_MS = 4_000;

export function backendOutcome(error: NormalisedError): string | null {
  switch (error.kind) {
    case "badRequest": return error.code;
    case "conflict": return error.outcome;
    case "unprocessable": return error.outcome;
    case "unauthenticated": return error.code;
    case "forbidden": return error.code;
    case "g2gUnavailable": return error.authority;
    case "serverError": return error.code;
    default: return null;
  }
}

/**
 * D8. The two reasons the edge allowlists when a document can no longer be
 * replaced. They are TRANSLATION KEYS, not text: an unrecognised reason must
 * never be shown, and there is no UI control here that could re-open a closed
 * review — only the recruitment office can.
 */
const REVIEW_CLOSED_REASONS = ["HUMAN_REVIEWED", "CASE_ADVANCED"] as const;
type ReviewClosedReason = (typeof REVIEW_CLOSED_REASONS)[number];

/**
 * The reason a closed review refused the replacement, or null when the error is
 * not a D8 refusal or names a reason this screen does not have words for.
 *
 * The reason is read from the normalised conflict data and matched against the
 * allowlist above. Backend text is never rendered: an unknown reason returns
 * null so the caller keeps the generic safe error.
 */
function reviewClosedReason(error: NormalisedError): ReviewClosedReason | null {
  if (error.kind !== "conflict" || error.outcome !== "DOCUMENT_REVIEW_CLOSED") return null;
  const reason = error.data["reason"];
  return typeof reason === "string" && (REVIEW_CLOSED_REASONS as readonly string[]).includes(reason)
    ? (reason as ReviewClosedReason)
    : null;
}

/**
 * D8. The revision the server ACCEPTED, or null when a 2xx carried no usable
 * one. A revision is never inferred, counted locally, or defaulted to 1: the
 * server numbers its own revisions, and an identical re-upload is a retry that
 * returns the CURRENT revision.
 *
 * `Number.isSafeInteger`, not `Number.isFinite`. A revision is a whole count
 * the backend assigns, so 2.5, NaN, Infinity and anything past the safe-integer
 * range are not revisions — they are contract drift, and printing one as
 * "revision 2.5" would invent evidence on an evidence-integrity screen. It must
 * also be positive: revisions start at 1, so a zero or a negative number is no
 * more a revision than a fraction is.
 */
function acceptedRevision(response: UploadDocumentResponse): number | null {
  const revision: unknown = response.revision;
  return typeof revision === "number" && Number.isSafeInteger(revision) && revision > 0 ? revision : null;
}

/** One received document: its type and the latest revision accepted for it. */
interface ReceivedDocument {
  readonly documentType: string;
  readonly revision: number | null;
}

/**
 * Record the latest accepted revision for a document type, replacing the entry
 * in place when that type was uploaded before. A re-upload of the same type
 * therefore UPDATES the revision shown for it instead of listing the type twice.
 */
function withRevision(
  received: readonly ReceivedDocument[],
  documentType: string,
  revision: number | null,
): readonly ReceivedDocument[] {
  return received.some((entry) => entry.documentType === documentType)
    ? received.map((entry) => (entry.documentType === documentType ? { documentType, revision } : entry))
    : [...received, { documentType, revision }];
}

/**
 * D8. An upload the client CANNOT confirm — the answer arrived, but not in a
 * shape the contract allows, so nothing about the outcome is established.
 *
 * `onFile` says whether the advisory checklist already lists a document of this
 * type. It does NOT mean this upload was stored: the document on file may be an
 * earlier one. So the copy below never claims either outcome — it names what is
 * unknown and hands the citizen a next step.
 */
interface UnconfirmedUpload {
  readonly documentType: string;
  readonly onFile: boolean;
}

/**
 * Whether the citizen's own checklist lists a document of this type.
 *
 * The reconciliation is BEST EFFORT and can only ever be partial: the checklist
 * is advisory, carries no revision, and is not decoded at the boundary, so an
 * unreadable one is treated as "no record" rather than as evidence either way.
 */
async function documentIsOnFile(applicationId: string, documentType: string): Promise<boolean> {
  try {
    const checklist = await getMyDocumentChecklist(client, applicationId);
    const items = Array.isArray(checklist.items) ? checklist.items : [];
    return items.some((item) => item.documentType === documentType && item.satisfaction !== "MISSING");
  } catch {
    // A checklist that cannot be read makes an unconfirmed upload no more
    // confirmed. Report the unknown instead of inventing a state.
    return false;
  }
}

/**
 * Document upload for the application just filed (ADR-030). The citizen picks
 * one of the document types the agency ACCEPTS and a file. The response holds
 * identifiers and the accepted revision: there is deliberately no verdict to
 * show, so "uploaded" means "received", never "verified".
 */
export function DocumentsPanel({ applicationId, agency, uploadOnly = false }: {
  readonly applicationId: string;
  readonly agency: Agency;
  /** The documents screen draws the checklist and the clearance number itself: only the upload here. */
  readonly uploadOnly?: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  const { t: tc } = useTranslation(CITIZEN_APPLY_NAMESPACES);
  const upload = useUploadMyDocument(client);
  // The campaign's own required list, bound to this application (never the agency catalogue).
  const checklist = useMyDocumentChecklist(client, applicationId);
  const choices = uploadChoices(checklist.data, checklist, AGENCY_DOCUMENT_TYPES[agency]);
  const types = choices.kind === "LOADING" ? [] : choices.types;
  const [picked, setDocumentType] = useState<string | null>(null);
  const documentType = selectedType(picked, types);
  const verifying = isInFlight(checklist.data);
  const { refetch } = checklist;
  // While Irembo answers a clearance number, re-read the checklist; it stops by itself.
  useEffect(() => {
    // The documents screen runs its own poll; one is enough.
    if (uploadOnly || !verifying) return undefined;
    const timer = setInterval(() => { void refetch(); }, CHECKLIST_POLL_MS);
    return () => clearInterval(timer);
  }, [uploadOnly, verifying, refetch]);
  const [file, setFile] = useState<File | null>(null);
  const [received, setReceived] = useState<readonly ReceivedDocument[]>([]);
  const [unconfirmed, setUnconfirmed] = useState<UnconfirmedUpload | null>(null);

  const label = (entry: ReceivedDocument): string => {
    const type = t(`documents.types.${entry.documentType}`);
    // No revision claim when the server sent none: naming one would be invented
    // evidence, and the document ID stays internal.
    return entry.revision === null ? type : t("apply.upload_received_item", { type, revision: entry.revision });
  };

  const refusal = ((): string | null => {
    const error = upload.error;
    if (error === null) return null;
    if (!(error instanceof ApiError)) return t("apply.upload_error");
    const reason = reviewClosedReason(error.normalised);
    if (reason !== null) return t(`apply.upload_review_closed.${reason}`);
    const code = backendOutcome(error.normalised);
    return code === null ? t("apply.upload_error") : t(`apply.upload_refusals.${code}`, { defaultValue: t("apply.upload_error") });
  })();

  return (
    <Stack space="space.200">
      <Text size="large" weight="bold">{t("apply.documents_title")}</Text>
      {choices.kind === "LOADING" && <Spinner label={tc("apply.required_docs.loading")} />}
      {choices.kind === "FALLBACK" && (
        <SectionMessage appearance="warning" testId="required-docs-fallback">
          <Text size="large">{tc("apply.required_docs.unavailable")}</Text>
        </SectionMessage>
      )}
      {!uploadOnly && choices.kind === "POLICY" && (
        <Stack space="space.100" testId="required-docs">
          <Text size="large" weight="medium">
            {choices.required.length === 0 ? tc("apply.required_docs.none") : tc("apply.required_docs.title")}
          </Text>
          {choices.required.length > 0 && (
            <ul>
              {choices.required.map((item) => (
                <li key={item.documentType} data-testid={`required-doc-${item.documentType}`}>
                  <Text size="large">
                    {tc(documentTypeKey(item.documentType), { defaultValue: item.documentType })}
                    {" — "}
                    {tc(requiredItemCopyKey(item, types))}
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </Stack>
      )}
      {!uploadOnly && choices.kind === "POLICY" && choices.clearance?.clearance !== undefined && (
        <Stack space="space.100" testId="apply-clearance">
          <Text size="large" weight="bold">{tc(documentTypeKey(choices.clearance.documentType), { defaultValue: choices.clearance.documentType })}</Text>
          <ClearanceBlock client={client} applicationId={applicationId} clearance={choices.clearance.clearance} refresh={() => { void refetch(); }} />
        </Stack>
      )}
      {choices.kind === "POLICY" && choices.required.length > 0 && types.length === 0 && (
        <Text size="large" color="color.text.subtle" testId="nothing-to-upload">{tc("apply.required_docs.nothing_to_upload")}</Text>
      )}
      {documentType !== null && (
        <Stack space="space.200" testId="document-upload">
          <Text size="large" color="color.text.subtle">{t("apply.documents_help")}</Text>
          {/* The label names the picker only through the Field's own id (WCAG 1.3.1 / 4.1.2). */}
          <Field name="documentType" id="document-type" label={t("apply.document_type_label")}>
            {({ fieldProps }) => (
              <Select
                inputId={fieldProps.id}
                options={types.map((type) => ({ label: t(`documents.types.${type}`), value: type }))}
                value={{ label: t(`documents.types.${documentType}`), value: documentType }}
                isClearable={false}
                onChange={(option) => { if (option !== null && option !== undefined) setDocumentType(option.value); }}
              />
            )}
          </Field>
          <label htmlFor="document-file">
            <Text size="large">{t("apply.document_file_label")}</Text>
          </label>
          <input
            id="document-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => { setFile(event.target.files?.[0] ?? null); upload.reset(); setUnconfirmed(null); }}
          />
          {/*
            D8. An unconfirmed outcome is NOT a refusal. `upload.error` is set for
            both, and the refusal copy says "could not be uploaded" — which asserts
            a failure this screen cannot establish. So the unconfirmed message
            replaces it rather than sitting beside it.
          */}
          {unconfirmed !== null && (
            <SectionMessage appearance="warning" title={t("apply.upload_unconfirmed_title")} headingLevel="h4" aria-live="polite" testId="upload-unconfirmed">
              <Text size="large">
                {unconfirmed.onFile
                  ? t("apply.upload_unconfirmed_on_file_body", { type: t(`documents.types.${unconfirmed.documentType}`) })
                  : t("apply.upload_unconfirmed_body")}
              </Text>
            </SectionMessage>
          )}
          {unconfirmed === null && refusal !== null && (
            <SectionMessage appearance="error" title={t("apply.upload_error_title")} headingLevel="h4" aria-live="assertive">
              <Text size="large">{refusal}</Text>
            </SectionMessage>
          )}
          {received.length > 0 && (
            <SectionMessage appearance="success" title={t("apply.upload_ok_title")} headingLevel="h4" aria-live="polite" testId="documents-received">
              <Text size="large">{t("apply.upload_ok_body", { types: received.map(label).join(", ") })}</Text>
            </SectionMessage>
          )}
          <Inline>
            <Button
              appearance="primary"
              isDisabled={file === null || upload.isPending}
              onClick={() => {
                if (file === null) return;
                upload.mutate(
                  { applicationId, documentType, file },
                  {
                    onSuccess: (response) => {
                      // D8: the revision the server accepted, including when this
                      // type was uploaded before. An identical retry returns the
                      // same revision and is displayed as the same revision.
                      const revision = acceptedRevision(response);
                      setUnconfirmed(null);
                      // A 2xx with no usable revision is NOT a receipt. The
                      // transport already refuses one at the boundary; this is the
                      // second gate, and it must not fall through to "received".
                      if (revision === null) {
                        void documentIsOnFile(applicationId, documentType).then((onFile) =>
                          setUnconfirmed({ documentType, onFile }),
                        );
                        return;
                      }
                      setReceived((prev) => withRevision(prev, documentType, revision));
                      setFile(null);
                    },
                    onError: (error) => {
                      // D8: an answer the client cannot trust is unknown, not
                      // failure. Reconcile what can be read, then say what could
                      // not be established — and NEVER re-send the file. Upstream
                      // an identical re-upload is a retry (same revision, no new
                      // history entry), so a recovery upload cannot repair a lost
                      // answer and would only add a confusing duplicate attempt.
                      if (!isUnconfirmedUploadOutcome(error)) return;
                      void documentIsOnFile(applicationId, documentType).then((onFile) =>
                        setUnconfirmed({ documentType, onFile }),
                      );
                    },
                  },
                );
              }}
            >
              {upload.isPending ? t("apply.uploading") : t("apply.upload")}
            </Button>
          </Inline>
        </Stack>
      )}
    </Stack>
  );
}
