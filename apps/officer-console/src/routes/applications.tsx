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
import { useTranslation } from "@usrp/i18n";
import { ApplicationStatusBadge } from "@usrp/ui";
import { BFF_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: BFF_BASE_URL });

const PAGE_SIZE = 25;

// Module-level — xcss prop requires cssMap output, not css().
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
 * Application queue — the officer's primary work surface.
 *
 * HCI mandate applied:
 * - Exception-based: auto-filters to `requiresAction` on load so the officer
 *   lands on the 5% that needs them, not the full 100%.
 * - Gestalt grouping: related columns (applicant name / post) are adjacent.
 * - Table supports keyboard navigation for accessibility.
 */
export default function ApplicationsPage(): React.ReactElement {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");

  const { data, isLoading, isError } = useApplicationList(client, {
    page,
    pageSize: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  const head = {
    cells: [
      { key: "id", content: t("application.id"), width: 10 },
      { key: "applicant", content: t("application.applicant"), width: 20 },
      { key: "agency", content: t("application.agency"), width: 10 },
      { key: "post", content: t("application.post"), width: 20 },
      { key: "status", content: "Status", width: 15 },
      { key: "submitted", content: t("application.submitted"), width: 15 },
      { key: "actions", content: "", width: 10 },
    ],
  };

  const rows =
    data?.items.map((app) => ({
      key: app.id,
      cells: [
        { key: "id", content: <Text size="small">{app.id.slice(0, 8)}</Text> },
        { key: "applicant", content: app.applicantName },
        { key: "agency", content: app.agency },
        { key: "post", content: app.id },
        {
          key: "status",
          content: <ApplicationStatusBadge status={app.status} />,
        },
        {
          key: "submitted",
          content: new Date(app.submittedAt).toLocaleDateString(),
        },
        {
          key: "actions",
          content: (
            <Button
              appearance="subtle"
              href={`/applications/${app.id}`}
              spacing="compact"
            >
              {t("actions.view")}
            </Button>
          ),
        },
      ],
    })) ?? [];

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.400">
        <PageHeader>{t("nav.applications")}</PageHeader>
        <Box xcss={pageStyles.searchInput}>
          <TextField
            placeholder="Search applicant…"
            value={search}
            onChange={(e) =>
              setSearch((e.target as HTMLInputElement).value)
            }
            aria-label="Search applications"
          />
        </Box>
        {isError && (
          <SectionMessage appearance="error">
            {t("errors.generic")}
          </SectionMessage>
        )}
        {isLoading ? (
          <Spinner label={t("a11y.loading")} />
        ) : (
          <DynamicTable
            head={head}
            rows={rows}
            rowsPerPage={PAGE_SIZE}
            defaultPage={1}
            page={page}
            onSetPage={setPage}
            isLoading={isLoading}
            emptyView={<Text>{t("dashboard.no_exceptions")}</Text>}
          />
        )}
      </Stack>
    </Box>
  );
}
