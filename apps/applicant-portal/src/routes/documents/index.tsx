import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button/new";
import Heading from "@atlaskit/heading";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import TextField from "@atlaskit/textfield";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { ApiError, createApiClient, useAttachMyClearanceCertificate, useMyDocumentChecklist, type ClearanceState, type DocumentChecklist } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { CITIZEN_APPLY_NAMESPACES } from "../locales.js";
import { EDGE_BASE_URL } from "../../env.js";
import { clearanceCopyKey, documentTypeKey, isClearanceNumberShape, isInFlight, normaliseClearanceNumber, satisfactionCopyKey, wantsNumber } from "./model.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const page = cssMap({ base: { maxWidth: "640px", marginInline: "auto", paddingBlock: token("space.500"), paddingInline: token("space.400") } });
const POLL_MS = 4_000;
/** How each clearance state is drawn: never colour alone (the words differ), but the tone follows the state. */
const TONE: Record<ClearanceState, "success" | "warning" | "information"> = {
  NUMBER_REQUIRED: "information",
  VERIFYING: "information",
  CORRECTION_NEEDED: "warning",
  UNDER_OFFICER_REVIEW: "information",
  VERIFIED: "success",
};

/**
 * The citizen's own document checklist (ADR-032), with the Irembo clearance number field and its
 * states (ADR-048 section 2.3, S12b). ADVISORY: nothing here blocks the application. A registry
 * outage reads as "we are checking", never as a refusal; a correctable failure names what to fix
 * and never says who else's record it was.
 */
export default function DocumentsPage(): React.ReactElement {
  const { t } = useTranslation(CITIZEN_APPLY_NAMESPACES);
  const { applicationId = "" } = useParams();
  const checklist = useMyDocumentChecklist(client, applicationId);
  const inFlight = isInFlight(checklist.data);

  // While the registry answers the page re-reads the checklist; it stops by itself.
  useEffect(() => {
    if (!inFlight) return undefined;
    const timer = setInterval(() => { void checklist.refetch(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [inFlight, checklist]);

  return (
    <Box xcss={page.base}>
      <Stack space="space.300">
        <Heading size="large" as="h1">{t("citizen_docs.title")}</Heading>
        <Text>{t("citizen_docs.intro")}</Text>
        {checklist.isLoading && <Spinner label={t("citizen_docs.loading")} />}
        {checklist.isError && <SectionMessage appearance="error"><Text>{t("citizen_docs.error")}</Text></SectionMessage>}
        {checklist.data !== undefined && <ChecklistItems applicationId={applicationId} checklist={checklist.data} />}
        <Text size="small"><Link to="/status">{t("citizen_docs.back")}</Link></Text>
      </Stack>
    </Box>
  );
}

function ChecklistItems({ applicationId, checklist }: { readonly applicationId: string; readonly checklist: DocumentChecklist }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Stack space="space.200" testId="citizen-documents">
      {checklist.items.map((item) => (
        <Box key={item.documentType} padding="space.200" backgroundColor="color.background.neutral">
          <Stack space="space.100">
            <Text weight="bold">{t(documentTypeKey(item.documentType), { defaultValue: item.documentType })}</Text>
            <Text color="color.text.subtle" testId={`doc-state-${item.documentType}`}>{t(satisfactionCopyKey(item))}</Text>
            {item.clearance !== undefined && <ClearanceBlock applicationId={applicationId} clearance={item.clearance} />}
          </Stack>
        </Box>
      ))}
      {checklist.complete && <SectionMessage appearance="success"><Text>{t("citizen_docs.all_done")}</Text></SectionMessage>}
    </Stack>
  );
}

function ClearanceBlock({ applicationId, clearance }: { readonly applicationId: string; readonly clearance: NonNullable<DocumentChecklist["items"][number]["clearance"]> }): React.ReactElement {
  const { t } = useTranslation();
  const attach = useAttachMyClearanceCertificate(client);
  const [value, setValue] = useState("");
  const [shapeError, setShapeError] = useState(false);
  const sent = attach.isSuccess;
  const error = attach.error instanceof ApiError ? attach.error.normalised : null;
  const closed = error !== null && error.kind === "conflict";

  const submit = (): void => {
    if (!isClearanceNumberShape(value)) { setShapeError(true); return; }
    setShapeError(false);
    attach.mutate({ applicationId, clearanceCertificateNumber: normaliseClearanceNumber(value) });
  };

  return (
    <Stack space="space.100" testId="clearance-block">
      <SectionMessage appearance={TONE[clearance.state]}>
        <Text testId="clearance-state">{t(clearanceCopyKey(clearance))}</Text>
      </SectionMessage>
      {wantsNumber(clearance.state) && !sent && (
        <Stack space="space.100">
          <label htmlFor="clearance-number"><Text weight="medium">{t("citizen_docs.clearance.field_label")}</Text></label>
          <Text size="small" color="color.text.subtle">{t("citizen_docs.clearance.hint")}</Text>
          <TextField
            id="clearance-number"
            name="clearanceCertificateNumber"
            value={value}
            autoComplete="off"
            inputMode="text"
            isInvalid={shapeError}
            onChange={(e) => { setValue((e.target as HTMLInputElement).value); setShapeError(false); }}
          />
          {shapeError && <div role="alert"><Text color="color.text.danger">{t("citizen_docs.clearance.shape")}</Text></div>}
          {error !== null && <div role="alert"><Text color="color.text.danger">{closed ? t("citizen_docs.clearance.closed") : t("citizen_docs.clearance.failed")}</Text></div>}
          <Inline>
            <Button appearance="primary" isDisabled={attach.isPending} onClick={submit}>
              {attach.isPending ? t("citizen_docs.clearance.sending") : t("citizen_docs.clearance.submit")}
            </Button>
          </Inline>
        </Stack>
      )}
      {sent && <div role="status"><Text color="color.text.success">{t("citizen_docs.clearance.sent")}</Text></div>}
    </Stack>
  );
}
