import React, { useId, useMemo, useState } from "react";
import { Box, Stack, Text } from "@atlaskit/primitives/compiled";
import PageHeader from "@atlaskit/page-header";
import DynamicTable from "@atlaskit/dynamic-table";
import Button from "@atlaskit/button";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import TextField from "@atlaskit/textfield";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import {
  createApiClient,
  useApplicationList,
  type ApplicationListRow,
} from "@usrp/api-client";
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
  searchInput: { maxWidth: "440px" },
});

function filterApplications(
  applications: ReadonlyArray<ApplicationListRow>,
  search: string,
): ReadonlyArray<ApplicationListRow> {
  const needle = search.trim().toLowerCase();
  if (needle.length === 0) return applications;
  return applications.filter(
    (application) =>
      application.id.toLowerCase().includes(needle) ||
      application.processingCode.toLowerCase().includes(needle) ||
      application.status.toLowerCase().includes(needle),
  );
}

export default function ApplicationsPage(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const searchId = useId();
  const descriptionId = useId();
  const [search, setSearch] = useState("");
  const { data, error, isLoading, isError, refetch } = useApplicationList(client, agency);
  const applications = data?.applications ?? [];
  const visibleApplications = useMemo(
    () => filterApplications(applications, search),
    [applications, search],
  );

  const head = useMemo(
    () => ({
      cells: [
        { key: "id", content: t("application.id") },
        { key: "processingCode", content: t("application.post") },
        { key: "agency", content: t("application.agency") },
        { key: "status", content: t("application.status") },
        { key: "actions", content: t("application.actions") },
      ],
    }),
    [t],
  );

  const rows = visibleApplications.map((application) => ({
    key: application.id,
    cells: [
      { key: "id", content: <Text size="small">{application.id}</Text> },
      { key: "processingCode", content: application.processingCode },
      { key: "agency", content: application.agency },
      {
        key: "status",
        content: <ApplicationStatusBadge status={application.status} />,
      },
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
        <Text color="color.text.subtle">{t("application.workspace_description")}</Text>

        <Box xcss={pageStyles.searchInput}>
          <label htmlFor={searchId}>{t("application.search_label")}</label>
          <Text id={descriptionId} size="small" color="color.text.subtle">
            {t("application.search_description")}
          </Text>
          <TextField
            id={searchId}
            value={search}
            onChange={(event) => setSearch((event.target as HTMLInputElement).value)}
            aria-describedby={descriptionId}
          />
        </Box>

        {isError && (
          <SectionMessage
            appearance="error"
            title={t("errors.generic")}
            headingLevel="h3"
          >
            <Stack space="space.200">
              <Text>
                {error instanceof Error && error.message.length > 0
                  ? t("application.load_error")
                  : t("errors.generic")}
              </Text>
              <Button appearance="default" onClick={() => void refetch()}>
                {t("actions.try_again")}
              </Button>
            </Stack>
          </SectionMessage>
        )}

        {isLoading ? (
          <Box aria-live="polite" role="status">
            <Spinner label={t("a11y.loading_applications")} />
          </Box>
        ) : (
          !isError && (
            <>
              <Text aria-live="polite" size="small" color="color.text.subtle">
                {t("application.result_count", { count: visibleApplications.length })}
              </Text>
              <DynamicTable
                head={head}
                rows={rows}
                emptyView={
                  <SectionMessage
                    appearance="information"
                    title={
                      search.trim().length > 0
                        ? t("application.no_results")
                        : t("application.no_applications")
                    }
                    headingLevel="h3"
                  >
                    {search.trim().length > 0
                      ? t("application.no_results_description")
                      : t("application.no_applications_description")}
                  </SectionMessage>
                }
              />
            </>
          )
        )}
      </Stack>
    </Box>
  );
}
