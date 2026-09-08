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

const pageStyles = cssMap({
  base: {
    maxWidth: "1200px",
    marginInline: "auto",
    paddingBlock: token("space.400"),
    paddingInline: token("space.500"),
  },
  searchInput: {
    maxWidth: "400px",
  },
});

/**
 * The officer application queue.
 *
 * The list is NOT paginated and NOT server-filtered: GET /edge/v1/applications
 * takes no query parameters and returns the officer's whole RLS-scoped set,
 * capped upstream. The agency passed to the hook is a CACHE KEY, not a filter -
 * the server scopes by the officer's own database role and ignores anything the
 * client might send, which is why AgencyGuard is presentational and RLS is the
 * boundary.
 *
 * Search is therefore local, over rows already returned. That is a deliberate
 * limitation rather than a hidden one: a search box that appears to query the
 * server while filtering a truncated page is worse than one that admits its
 * scope.
 */
export default function ApplicationsPage(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const [search, setSearch] = React.useState("");
  const { data, isLoading, isError } = useApplicationList(client, agency);

  const needle = search.trim().toLowerCase();
  const applications = (data?.applications ?? []).filter((application) => {
    if (needle.length === 0) return true;
    return (
      application.id.toLowerCase().includes(needle) ||
      application.processingCode.toLowerCase().includes(needle) ||
      application.status.toLowerCase().includes(needle)
    );
  });

  const head = {
    cells: [
      { key: "id", content: t("application.id"), width: 20 },
      { key: "processingCode", content: t("application.post"), width: 25 },
      { key: "agency", content: t("application.agency"), width: 15 },
      { key: "status", content: "Status", width: 20 },
      { key: "actions", content: "", width: 20 },
    ],
  };

  const rows = applications.map((application) => ({
    key: application.id,
    cells: [
      { key: "id", content: <Text size="small">{application.id}</Text> },
      { key: "processingCode", content: application.processingCode },
      { key: "agency", content: application.agency },
      { key: "status", content: <ApplicationStatusBadge status={application.status} /> },
      {
        key: "actions",
        content: (
          <Button appearance="subtle" href={`/applications/${application.id}`}>
            {t("actions.view")}
          </Button>
        ),
      },
    ],
  }));

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.400">
        <PageHeader>{t("nav.applications")}</PageHeader>

        <Box xcss={pageStyles.searchInput}>
          <TextField
            placeholder="Search these results"
            value={search}
            onChange={(event) => setSearch((event.target as HTMLInputElement).value)}
            aria-label="Search the loaded applications"
          />
        </Box>

        {isError && (
          <SectionMessage appearance="error">{t("errors.generic")}</SectionMessage>
        )}

        {isLoading ? (
          <Spinner label={t("a11y.loading")} />
        ) : (
          <DynamicTable
            head={head}
            rows={rows}
            emptyView={<Text>{t("dashboard.no_exceptions")}</Text>}
          />
        )}
      </Stack>
    </Box>
  );
}
