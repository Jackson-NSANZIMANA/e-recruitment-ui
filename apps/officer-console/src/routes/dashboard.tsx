import React from "react";
import { Box, Stack, Inline } from "@atlaskit/primitives/compiled";
import PageHeader from "@atlaskit/page-header";
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useAmberQueue, useApplicationList } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { AgencyLogo, DashboardMetricCard } from "@usrp/ui";
import { EDGE_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const pageStyles = cssMap({ base: { maxWidth: "1200px", marginInline: "auto", paddingBlock: token("space.400"), paddingInline: token("space.500") } });

export default function DashboardPage(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const applications = useApplicationList(client, agency);
  const amber = useAmberQueue(client, agency);
  const isLoading = applications.isLoading || amber.isLoading;
  const isError = applications.isError || amber.isError;
  const total = applications.data?.applications.length ?? 0;
  const requiresAction = amber.data?.queue.length ?? 0;

  if (isLoading) return <Box xcss={pageStyles.base}><Spinner label={t("a11y.loading")} /></Box>;
  if (isError) return <Box xcss={pageStyles.base}><SectionMessage appearance="error" title={t("errors.generic")}>{t("errors.generic")}</SectionMessage></Box>;

  return <Box xcss={pageStyles.base}><Stack space="space.500">
    <PageHeader {...(session !== null ? { breadcrumbs: <AgencyLogo agency={session.agency} size="sm" /> } : {})}>{t("dashboard.title")}</PageHeader>
    <Inline space="space.300" shouldWrap>
      <DashboardMetricCard label={t("dashboard.requires_action")} value={requiresAction} urgent={requiresAction > 0} testId="metric-requires-action" />
      <DashboardMetricCard label={t("dashboard.pending_review")} value={total} testId="metric-total-applications" />
    </Inline>
    {requiresAction === 0 && <SectionMessage appearance="success">{t("dashboard.no_exceptions")}</SectionMessage>}
  </Stack></Box>;
}
