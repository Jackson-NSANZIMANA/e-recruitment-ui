import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useMyDocumentChecklist, type DocumentChecklist } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { CITIZEN_APPLY_NAMESPACES } from "../locales.js";
import { EDGE_BASE_URL } from "../../env.js";
import { documentTypeKey, isInFlight, satisfactionCopyKey } from "./model.js";
import { ClearanceBlock } from "./ClearanceBlock.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const page = cssMap({ base: { maxWidth: "640px", marginInline: "auto", paddingBlock: token("space.500"), paddingInline: token("space.400") } });
const POLL_MS = 4_000;

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
        <Text size="large">{t("citizen_docs.intro")}</Text>
        {checklist.isLoading && <Spinner label={t("citizen_docs.loading")} />}
        {checklist.isError && <SectionMessage appearance="error"><Text size="large">{t("citizen_docs.error")}</Text></SectionMessage>}
        {checklist.data !== undefined && <ChecklistItems applicationId={applicationId} checklist={checklist.data} refresh={() => { void checklist.refetch(); }} />}
        <Text size="large"><Link to="/status">{t("citizen_docs.back")}</Link></Text>
      </Stack>
    </Box>
  );
}

function ChecklistItems({ applicationId, checklist, refresh }: { readonly applicationId: string; readonly checklist: DocumentChecklist; readonly refresh: () => void }): React.ReactElement {
  const { t } = useTranslation(CITIZEN_APPLY_NAMESPACES);
  return (
    <Stack space="space.200" testId="citizen-documents">
      {checklist.items.map((item) => (
        <Box key={item.documentType} padding="space.200" backgroundColor="color.background.neutral">
          <Stack space="space.100">
            <Text size="large" weight="bold">{t(documentTypeKey(item.documentType), { defaultValue: item.documentType })}</Text>
            <Text size="large" color="color.text.subtle" testId={`doc-state-${item.documentType}`}>{t(satisfactionCopyKey(item))}</Text>
            {item.clearance !== undefined && <ClearanceBlock client={client} applicationId={applicationId} clearance={item.clearance} refresh={refresh} />}
          </Stack>
        </Box>
      ))}
      {checklist.complete && <SectionMessage appearance="success"><Text size="large">{t("citizen_docs.all_done")}</Text></SectionMessage>}
    </Stack>
  );
}
