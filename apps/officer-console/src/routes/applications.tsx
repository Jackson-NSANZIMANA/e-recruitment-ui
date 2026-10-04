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
  return applications.filter((application) =>
    [application.applicationId, application.processingCode, application.status]
      .some((value) => value?.toLowerCase().includes(needle) === true),
  );
}

export default function ApplicationsPage(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  // The fallback is only a disabled-query cache key while AuthProvider checks
  // the httpOnly session cookie. It is never sent to the edge without a session.
  const agency = session?.agency ?? "RDF";
  const searchId = useId();
  const descriptionId = useId();
  const [search, setSearch] = useState("");
  const { data, error, isLoading, isError, refetch } = useApplicationList(
    client,
    agency,
    session !== null,
  );
  const applications = data ?? [];
  const visibleApplications = useMemo(
    () => filterApplications(applications, search),
    [applications, search],
  );

  const head = useMemo(
    () => ({
      cells: [
        { key: "id", content: t("application.id") },
        { key: "processingCode", content: t("application.processing_code") },
        { key: "agency", content: t("application.agency") },
        { key: "status", content: t("application.status") },
        { key: "actions", content: t("application.actions") },
      ],
    }),
    [t],
  );

  const rows = visibleApplications.map((application, index) => {
    const applicationId = application.applicationId;
    const rowKey = applicationId ?? application.processingCode ?? `row-${index}`;
    return {
      key: rowKey,
      cells: [
        {
          key: "id",
          content: <Text size="small">{applicationId ?? t("application.not_provided")}</Text>,
        },
        {
          key: "processingCode",
          content: application.processingCode ?? t("application.not_provided"),
        },
        { key: "agency", content: application.agency },
        {
          key: "status",
          content: <ApplicationStatusBadge status={application.status} />,
        },
        {
          key: "actions",
          content: applicationId === null ? (
            <Text size="small" color="color.text.subtle">{t("application.identifier_unavailable")}</Text>
          ) : (
            <Button appearance="subtle" href={`/applications/${applicationId}`}>
              {t("actions.view")}
            </Button>
          ),
        },
      ],
    };
  });

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

        {session === null && !isLoading && !isError && (
          <Box aria-live="polite" role="status">
            <Spinner label={t("a11y.loading_applications")} />
          </Box>
        )}

        {isError && (
          <SectionMessage appearance="error" title={t("errors.generic")} headingLevel="h3">
            <Stack space="space.200">
              <Text>{t("application.load_error")}</Text>
              <Button appearance="default" onClick={() => void refetch()}>
                {t("actions.try_again")}
              </Button>
            </Stack>
          </SectionMessage>
        )}

        {session !== null && (isLoading ? (
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
        ))}
      </Stack>
    </Box>
  );
}
