import React from "react";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
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
  const needle = search.trim().toLowerCase();
  const applications = (data?.applications ?? []).filter((application) => needle.length === 0 || application.id.toLowerCase().includes(needle) || application.processingCode.toLowerCase().includes(needle) || application.status.toLowerCase().includes(needle));
  const head = { cells: [{ key: "id", content: t("application.id") }, { key: "processingCode", content: t("application.post") }, { key: "agency", content: t("application.agency") }, { key: "status", content: "Status" }, { key: "actions", content: "" }] };
  const rows = applications.map((application) => ({ key: application.id, cells: [{ key: "id", content: <Text size="small">{application.id}</Text> }, { key: "processingCode", content: application.processingCode }, { key: "agency", content: application.agency }, { key: "status", content: <ApplicationStatusBadge status={application.status} /> }, { key: "actions", content: <Button appearance="subtle" href={`/applications/${application.id}`}>{t("actions.view")}</Button> }] }));
  return <Box xcss={pageStyles.base}><Stack space="space.400"><PageHeader>{t("nav.applications")}</PageHeader><Box xcss={pageStyles.searchInput}><TextField placeholder="Search these results" value={search} onChange={(event) => setSearch((event.target as HTMLInputElement).value)} aria-label="Search the loaded applications" /></Box>{isError && <SectionMessage appearance="error" headingLevel="h3">{t("errors.generic")}</SectionMessage>}{isLoading ? <Spinner label={t("a11y.loading")} /> : <DynamicTable head={head} rows={rows} emptyView={<Text>{t("dashboard.no_exceptions")}</Text>} />}</Stack></Box>;
}
