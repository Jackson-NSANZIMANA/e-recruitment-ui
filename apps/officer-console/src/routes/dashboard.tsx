import React from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import PageHeader from "@atlaskit/page-header";
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useAgencyCampaigns, useAmberQueue, useApplicationList, useFieldDevices, useOfficers, useSearchApplications } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { AgencyLogo, DashboardMetricCard, FreshnessStamp } from "@usrp/ui";
import { EDGE_BASE_URL } from "../env.js";
import { accessFor, attentionItems, fleetSummary, isAdministrationView, openCampaignCount, sortCampaigns, staffSummary } from "../dashboard/model.js";
import { AttentionPanel, CampaignsPanel, FleetPanel, PipelinePanel, StaffPanel } from "../dashboard/panels.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
const pageStyles = cssMap({
  base: { maxWidth: "1200px", marginInline: "auto", paddingBlock: token("space.400"), paddingInline: token("space.500") },
  columns: { display: "grid", gap: token("space.300"), gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" },
});

/**
 * The officer's landing page. Posts that run the agency (campaigns, staff,
 * fleet) get the administration view: exceptions first, then the figures
 * behind them. Case-working posts keep the exception counts they act on.
 */
export default function DashboardPage(): React.ReactElement {
  const session = useOfficerSession();
  const access = accessFor(session?.permissions ?? []);
  return isAdministrationView(access) ? <AdministrationDashboard /> : <CaseworkDashboard />;
}

function CaseworkDashboard(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const applications = useApplicationList(client, agency, session !== null);
  const amber = useAmberQueue(client, agency, session !== null);
  const isLoading = applications.isLoading || amber.isLoading;
  const isError = applications.isError || amber.isError;
  const total = applications.data?.length ?? 0;
  const requiresAction = amber.data?.length ?? 0;
  if (isLoading) return <Box xcss={pageStyles.base}><Spinner label={t("a11y.loading")} /></Box>;
  if (isError) return <Box xcss={pageStyles.base}><SectionMessage appearance="error" title={t("errors.generic")} headingLevel="h3">{t("errors.generic")}</SectionMessage></Box>;
  return <Box xcss={pageStyles.base}><Stack space="space.500"><PageHeader {...(session !== null ? { breadcrumbs: <AgencyLogo agency={session.agency} size="sm" /> } : {})}>{t("dashboard.title")}</PageHeader><Inline space="space.300" shouldWrap><DashboardMetricCard label={t("dashboard.requires_action")} value={requiresAction} urgent={requiresAction > 0} testId="metric-requires-action" /><DashboardMetricCard label={t("dashboard.pending_review")} value={total} testId="metric-total-applications" /></Inline>{requiresAction === 0 && <SectionMessage appearance="success" title={t("dashboard.no_exceptions")} headingLevel="h3">{t("dashboard.no_exceptions")}</SectionMessage>}</Stack></Box>;
}

function AdministrationDashboard(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const access = accessFor(session?.permissions ?? []);
  const signedIn = session !== null;
  const now = new Date();

  const campaigns = useAgencyCampaigns(client, { limit: 100 }, signedIn && access.campaigns);
  const amber = useAmberQueue(client, agency, signedIn && access.adjudication);
  const applications = useSearchApplications(client, { limit: 1 });
  const officers = useOfficers(client, signedIn && access.staff);
  const devices = useFieldDevices(client, signedIn && access.fleet);

  const sorted = sortCampaigns(campaigns.data?.campaigns ?? []);
  const requiresAction = amber.data?.length ?? 0;
  // The attention list waits for every read it draws on, so a late answer can never read as "all clear".
  const isLoading = [access.campaigns && campaigns.isLoading, access.adjudication && amber.isLoading, access.staff && officers.isLoading, access.fleet && devices.isLoading].some(Boolean);
  const isError = [access.campaigns && campaigns.isError, access.adjudication && amber.isError, access.staff && officers.isError, access.fleet && devices.isError].some(Boolean);
  const items = attentionItems({
    amberCount: access.adjudication ? (amber.data?.length ?? null) : null,
    campaigns: access.campaigns ? (campaigns.data?.campaigns ?? null) : null,
    officers: access.staff ? (officers.data?.officers ?? null) : null,
    devices: access.fleet ? (devices.data?.devices ?? null) : null,
    now,
  });
  const updatedAt = Math.max(campaigns.dataUpdatedAt, amber.dataUpdatedAt, officers.dataUpdatedAt, devices.dataUpdatedAt);

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.400">
        <PageHeader {...(signedIn ? { breadcrumbs: <AgencyLogo agency={session.agency} size="sm" /> } : {})}>{t("dashboard.admin_title")}</PageHeader>
        <Inline spread="space-between" alignBlock="center" shouldWrap>
          <Text as="p" color="color.text.subtle">{t("dashboard.admin_lead")}</Text>
          {updatedAt > 0 && <FreshnessStamp updatedAt={new Date(updatedAt).toISOString()} />}
        </Inline>

        {isError && <SectionMessage appearance="warning" testId="dashboard-partial"><Text as="p">{t("dashboard.panel_error")}</Text></SectionMessage>}
        <AttentionPanel items={items} ready={!isLoading} />

        <Inline space="space.300" shouldWrap testId="dashboard-metrics">
          {access.campaigns && <DashboardMetricCard label={t("dashboard.metrics.open_campaigns")} value={openCampaignCount(sorted)} testId="metric-open-campaigns" />}
          {access.applications && <DashboardMetricCard label={t("dashboard.metrics.applications_total")} value={applications.data?.total ?? 0} testId="metric-applications-total" />}
          {access.adjudication && <DashboardMetricCard label={t("dashboard.metrics.awaiting_adjudication")} value={requiresAction} urgent={requiresAction > 0} testId="metric-requires-action" />}
          {access.staff && <DashboardMetricCard label={t("dashboard.metrics.active_officers")} value={staffSummary(officers.data?.officers ?? []).active} testId="metric-active-officers" />}
          {access.fleet && <DashboardMetricCard label={t("dashboard.metrics.active_devices")} value={fleetSummary(devices.data?.devices ?? [], now).active} testId="metric-active-devices" />}
        </Inline>

        {access.campaigns && <CampaignsPanel query={campaigns} rows={sorted} />}

        <Box xcss={pageStyles.columns}>
          {access.applications && <PipelinePanel client={client} enabled={signedIn} />}
          {access.staff && <StaffPanel query={officers} />}
          {access.fleet && <FleetPanel query={devices} now={now} />}
        </Box>
      </Stack>
    </Box>
  );
}
