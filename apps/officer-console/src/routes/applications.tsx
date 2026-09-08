import React from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import PageHeader from "@atlaskit/page-header";
import DynamicTable from "@atlaskit/dynamic-table";
import Button from "@atlaskit/button";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import TextField from "@atlaskit/textfield";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useApplicationList } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { ApplicationStatusBadge } from "@usrp/ui";
import { EDGE_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const pageStyles = cssMap({ base: { maxWidth: "1200px", marginInline: "auto", paddingBlock: token("space.400"), paddingInline: token("space.500") }, searchInput: { maxWidth: "400px" } });

export default function ApplicationsPage(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const [search, setSearch] = React.useState("");
  const { data, isLoading, isError } = useApplicationList(client, agency);
  const applications = data?.applications.filter((application) => {
    const needle = search.trim().toLowerCase();
    return needle.length === 0 || application.id.toLowerCase().includes(needle) || application.processingCode.toLowerCase().includes(needle) || application.status.toLowerCase().includes(needle);
  }) ?? [];

  const head = { cells: [
    { key: "id", content: t("application.id"), width: 20 },
    { key: "processingCode", content: t("application.post"), width: 25 },
    { key: "agency", content: t("application.agency"), width: 15 },
    { key: "status", content: "Status", width: 20 },
    { key: "actions", content: "", width: 20 },
  ] };
  const rows = applications.map((application) => ({ key: application.id, cells: [
    { key: "id", content: <Text size="small">{application.id}</Text> },
    { key: "processingCode", content: application.processingCode },
    { key: "agency", content: application.agency },
    { key: "status", content: <ApplicationStatusBadge status={application.status} /> },
    { key: "actions", content: <Button appearance="subtle" href={`/applications/${application.id}`}>{t("actions.view")}</Button> },
  ] }));

  return <Box xcss={pageStyles.base}><Stack space="space.400">
    <PageHeader>{t("nav.applications")}</PageHeader>
    <Box xcss={pageStyles.searchInput}><TextField placeholder="Search applications" value={search} onChange={(event) => setSearch((event.target as HTMLInputElement).value)} aria-label="Search applications" /></Box>
    {isError && <SectionMessage appearance="error">{t("errors.generic")}</SectionMessage>}
    {isLoading ? <Spinner label={t("a11y.loading")} /> : <DynamicTable head={head} rows={rows} emptyView={<Text>{t("dashboard.no_exceptions")}</Text>} />}
  </Stack></Box>;
}
