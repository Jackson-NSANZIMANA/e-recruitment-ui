import React from "react";
import { Box, Text } from "@atlaskit/primitives/compiled";
import SectionMessage from "@atlaskit/section-message";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useAgencyCampaigns, useAmberQueue, useApplicationList, useFieldDevices, useOfficers, useSearchApplications } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import ApplicationsIcon from "@atlaskit/icon/core/briefcase";
import CampaignsIcon from "@atlaskit/icon/core/megaphone";
import DevicesIcon from "@atlaskit/icon/core/clipboard";
import QueueIcon from "@atlaskit/icon/core/inbox";
import StaffIcon from "@atlaskit/icon/core/people-group";
import { useTranslation } from "@usrp/i18n";
import { AgencyLogo, FreshnessStamp, MetricCard, PageShell, SkeletonPanel, countFrom } from "@usrp/ui";
import { EDGE_BASE_URL } from "../env.js";
import { accessFor, attentionItems, fleetSummary, isAdministrationView, openCampaignCount, sortCampaigns, staffSummary } from "../dashboard/model.js";
import { ArrivalsPanel, AttentionPanel, CampaignsPanel, CapacityPanel, FleetPanel, PipelinePanel, StaffPanel } from "../dashboard/panels.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });
// The page column now comes from `PageShell` (one 1280px content box that lines
// up with the national header); only the panel grid is local to this screen.
const pageStyles = cssMap({
  columns: { display: "grid", gap: token("space.300"), gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))" },
  // The headline row: the pipeline gets twice the width of the trend beside it, on
  // a wide screen; on a narrow one they stack. `minmax(0, ...)` lets a chart shrink
  // below its content instead of forcing the page to scroll sideways.
  split: { display: "grid", gap: token("space.300"), gridTemplateColumns: "minmax(0, 1fr)", "@media (min-width: 64rem)": { gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" } },
  // Five tiles share one row from desktop width and are all one height
  // (`alignItems: stretch`); below that they reflow to as many as fit.
  metrics: {
    display: "grid",
    gap: token("space.300"),
    alignItems: "stretch",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 11rem), 1fr))",
    "@media (min-width: 64rem)": { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" },
  },
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
  if (isLoading) {
    // A skeleton of the shape that is about to arrive, not a spinner in the
    // middle of an empty page: the two tiles land where their placeholders were,
    // so nothing jumps after the read resolves.
    return (
      <PageShell align="header" spacious title={t("dashboard.title")} testId="casework-dashboard">
        <SkeletonPanel shape="metrics" />
        <SkeletonPanel shape="prose" rows={2} />
      </PageShell>
    );
  }
  if (isError) {
    return (
      <PageShell align="header" spacious title={t("dashboard.title")} testId="casework-dashboard">
        <SectionMessage appearance="error" title={t("errors.generic")} headingLevel="h3">{t("errors.generic")}</SectionMessage>
      </PageShell>
    );
  }
  return (
    <PageShell
      align="header"
      spacious
      title={t("dashboard.title")}
      {...(session !== null ? { breadcrumbs: <AgencyLogo agency={session.agency} size="sm" /> } : {})}
      testId="casework-dashboard"
    >
      <Box xcss={pageStyles.metrics}>
        <MetricCard label={t("dashboard.requires_action")} count={{ state: "known", value: requiresAction }} urgent={requiresAction > 0} testId="metric-requires-action" />
        <MetricCard label={t("dashboard.pending_review")} count={{ state: "known", value: total }} testId="metric-total-applications" />
      </Box>
      {requiresAction === 0 && (
        <SectionMessage appearance="success" title={t("dashboard.no_exceptions")} headingLevel="h3">{t("dashboard.no_exceptions")}</SectionMessage>
      )}
    </PageShell>
  );
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
    <PageShell
      align="header"
      spacious
      title={t("dashboard.admin_title")}
      description={t("dashboard.admin_lead")}
      {...(signedIn ? { breadcrumbs: <AgencyLogo agency={session.agency} size="sm" /> } : {})}
      {...(updatedAt > 0 ? { actions: <FreshnessStamp updatedAt={new Date(updatedAt).toISOString()} /> } : {})}
      testId="admin-dashboard"
    >
      {isError && <SectionMessage appearance="warning" testId="dashboard-partial"><Text size="large" as="p">{t("dashboard.panel_error")}</Text></SectionMessage>}
      <AttentionPanel items={items} ready={!isLoading} />

      <Box xcss={pageStyles.metrics} testId="dashboard-metrics">
        {access.campaigns && (
          <MetricCard
            label={t("dashboard.metrics.open_campaigns")}
            count={countFrom(campaigns, (d) => openCampaignCount(sortCampaigns(d.campaigns)))}
            icon={<CampaignsIcon label="" color="currentColor" />}
            accent="purple"
            testId="metric-open-campaigns"
          />
        )}
        {access.applications && (
          <MetricCard
            label={t("dashboard.metrics.applications_total")}
            count={countFrom(applications, (d) => d.total)}
            icon={<ApplicationsIcon label="" color="currentColor" />}
            accent="blue"
            testId="metric-applications-total"
          />
        )}
        {access.adjudication && (
          <MetricCard
            label={t("dashboard.metrics.awaiting_adjudication")}
            count={countFrom(amber, (d) => d.length)}
            icon={<QueueIcon label="" color="currentColor" />}
            accent="orange"
            urgent
            testId="metric-requires-action"
          />
        )}
        {access.staff && (
          <MetricCard
            label={t("dashboard.metrics.active_officers")}
            count={countFrom(officers, (d) => staffSummary(d.officers).active)}
            icon={<StaffIcon label="" color="currentColor" />}
            accent="green"
            testId="metric-active-officers"
          />
        )}
        {access.fleet && (
          <MetricCard
            label={t("dashboard.metrics.active_devices")}
            count={countFrom(devices, (d) => fleetSummary(d.devices, now).active)}
            icon={<DevicesIcon label="" color="currentColor" />}
            accent="gray"
            testId="metric-active-devices"
          />
        )}
      </Box>

      {/* Shape of the work: where applications sit, and what is arriving in the queue. */}
      {(access.applications || access.adjudication) && (
        <Box xcss={access.applications && access.adjudication ? pageStyles.split : pageStyles.columns}>
          {access.applications && <PipelinePanel client={client} enabled={signedIn} />}
          {access.adjudication && <ArrivalsPanel entries={amber.data} now={now} />}
        </Box>
      )}

      {/* Capacity of the programme: how full registration is, who works it, what runs the exams. */}
      <Box xcss={pageStyles.columns}>
        {access.campaigns && <CapacityPanel rows={sorted} query={campaigns} />}
        {access.staff && <StaffPanel query={officers} />}
        {access.fleet && <FleetPanel query={devices} now={now} />}
      </Box>

      {access.campaigns && <CampaignsPanel query={campaigns} rows={sorted} canCreate={(session?.permissions ?? []).includes("campaign.create")} />}
    </PageShell>
  );
}
