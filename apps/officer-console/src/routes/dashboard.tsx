import React from "react";
import { Box, Inline, Text } from "@atlaskit/primitives/compiled";
import SectionMessage from "@atlaskit/section-message";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { createApiClient, useAgencyCampaigns, useAmberQueue, useApplicationList, useFieldDevices, useOfficers } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { AgencyLogo, BarChart, FilterChip, FreshnessStamp, HeroMetric, MetricCard, PageShell, SkeletonPanel, countFrom, formatCount, formatShare, known, PENDING, FAILED, type Count } from "@usrp/ui";
import { EDGE_BASE_URL } from "../env.js";
import { NEAR_CAPACITY_SHARE, accessFor, amberArrivalSeries, attentionItems, fleetSummary, isAdministrationView, openCampaignCount, sortCampaigns, staffSummary } from "../dashboard/model.js";
import { ArrivalsPanel, AttentionPanel, CampaignsPanel, CapacityPanel, FleetPanel, PipelinePanel, ReceivedPanel, StaffPanel } from "../dashboard/panels.js";
import { dayAsDate, dayQuery, periodWindows } from "../analytics/model.js";
import { useSearchTotals } from "../analytics/useSearchTotals.js";

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
    gridTemplateColumns: "minmax(0, 1fr)",
    "@media (min-width: 48rem)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
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
  const { t, i18n } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  const access = accessFor(session?.permissions ?? []);
  const signedIn = session !== null;
  const now = new Date();

  // The two dashboard filters. They narrow what the figures count (the campaign) and
  // how far back the trend looks (the period); nothing else on the page is a filter.
  const [campaign, setCampaign] = React.useState<string>("ALL");
  const [period, setPeriod] = React.useState<string>("7");
  const days = period === "14" ? 14 : 7;
  const narrow = campaign === "ALL" ? undefined : campaign;

  const campaigns = useAgencyCampaigns(client, { limit: 100 }, signedIn && access.campaigns);
  const amber = useAmberQueue(client, agency, signedIn && access.adjudication);
  const officers = useOfficers(client, signedIn && access.staff);
  const devices = useFieldDevices(client, signedIn && access.fleet);

  // Applications received, one exact count per calendar day: this period then the one before.
  const win = periodWindows(now, days);
  const received = useSearchTotals(
    client,
    [...win.current, ...win.previous].map((d) => dayQuery(d, narrow === undefined ? {} : { campaign: narrow })),
    signedIn && access.applications,
  );
  const receivedCurrent = received.totals.slice(0, days);
  const receivedPrevious = received.totals.slice(days, days * 2);
  const sum = (values: readonly number[]): number => values.reduce((a, v) => a + v, 0);
  const receivedCount: Count = received.failed ? FAILED : received.ready ? known(sum(receivedCurrent)) : PENDING;
  const dayText = (date: string): string => {
    const at = dayAsDate(date);
    return t("dashboard.series.day_short", { day: at.getUTCDate(), month: t(`dashboard.months.${String(at.getUTCMonth() + 1)}`) });
  };

  // The queue's arrivals: the same rows, counted by the day they entered, this period and the one before.
  const arrivals = amber.data === undefined ? undefined : amberArrivalSeries(amber.data, now, days * 2);
  const arrivalsNow = arrivals?.slice(days);
  const arrivalsBefore = arrivals?.slice(0, days);

  const sorted = sortCampaigns(campaigns.data?.campaigns ?? []);
  const live = sorted.filter((c) => c.status === "REGISTRATION_OPEN" || c.status === "EXAMINATION_ACTIVE");
  const seats = live.reduce((acc, c) => (c.occupancy.capacityTotal === null ? acc : { registered: acc.registered + c.occupancy.registeredTotal, capacity: acc.capacity + c.occupancy.capacityTotal }), { registered: 0, capacity: 0 });

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
  const updatedAt = Math.max(campaigns.dataUpdatedAt, amber.dataUpdatedAt, officers.dataUpdatedAt, devices.dataUpdatedAt, received.updatedAt);

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

      <Inline space="space.150" shouldWrap testId="dashboard-filters">
        {access.campaigns && (
          <FilterChip
            label={t("dashboard.filters.campaign")}
            value={campaign}
            neutralValue="ALL"
            options={[{ value: "ALL", label: t("dashboard.filters.all") }, ...sorted.map((c) => ({ value: c.publicCode, label: c.campaignLabel }))]}
            onChange={setCampaign}
            testId="filter-campaign"
          />
        )}
        <FilterChip
          label={t("dashboard.filters.period")}
          value={period}
          neutralValue="7"
          options={[{ value: "7", label: t("dashboard.filters.days7") }, { value: "14", label: t("dashboard.filters.days14") }]}
          onChange={setPeriod}
          testId="filter-period"
        />
      </Inline>

      <Box xcss={pageStyles.metrics} testId="dashboard-metrics">
        {access.applications && (
          <HeroMetric
            label={t("dashboard.hero.received")}
            count={receivedCount}
            previous={received.ready ? sum(receivedPrevious) : null}
            {...(received.ready ? { series: win.current.map((d, i) => ({ label: dayText(d), value: receivedCurrent[i] ?? 0 })) } : {})}
            goodDirection="up"
            caption={t("dashboard.hero.vs_previous", { days })}
            testId="metric-applications-total"
          />
        )}
        {access.adjudication && (
          <HeroMetric
            label={t("dashboard.metrics.awaiting_adjudication")}
            count={countFrom(amber, (d) => d.length)}
            // A rising queue is bad news, so "down" is the good direction. The badge compares ARRIVALS
            // (of what still waits) across the two periods; the caption says so.
            previous={arrivalsBefore === undefined ? null : sum(arrivalsBefore.map((d) => d.count))}
            {...(arrivalsNow !== undefined ? { series: arrivalsNow.map((d) => ({ label: dayText(d.at.toISOString().slice(0, 10)), value: d.count })) } : {})}
            goodDirection="down"
            caption={t("dashboard.hero.arrivals_vs", { days })}
            testId="metric-requires-action"
          />
        )}
        {access.campaigns && (
          <HeroMetric
            label={t("dashboard.metrics.open_campaigns")}
            count={countFrom(campaigns, (d) => openCampaignCount(sortCampaigns(d.campaigns)))}
            goodDirection="up"
            caption={seats.capacity > 0 ? t("dashboard.hero.seats", { registered: formatCount(seats.registered, i18n.language), capacity: formatCount(seats.capacity, i18n.language) }) : t("dashboard.hero.seats_none")}
            testId="metric-open-campaigns"
          >
            {seats.capacity > 0 && (
              <BarChart
                label={t("dashboard.charts.capacity_title")}
                items={[{ id: "seats", label: formatShare(seats.registered / seats.capacity, i18n.language), value: seats.registered, max: seats.capacity, display: "", tone: seats.registered / seats.capacity >= NEAR_CAPACITY_SHARE ? "warning" : "brand" }]}
              />
            )}
          </HeroMetric>
        )}
      </Box>

      {/* The shape of the work: where applications sit, and what is arriving in the queue. */}
      {(access.applications || access.adjudication) && (
        <Box xcss={access.applications && access.adjudication ? pageStyles.split : pageStyles.columns}>
          {access.applications && <PipelinePanel client={client} enabled={signedIn} {...(narrow !== undefined ? { campaign: narrow } : {})} />}
          {access.adjudication && <ArrivalsPanel entries={amber.data} now={now} onRefresh={() => void amber.refetch()} />}
        </Box>
      )}

      {access.applications && (
        <ReceivedPanel data={{ days: win.current, current: receivedCurrent, previous: receivedPrevious, ready: received.ready, failed: received.failed, refetch: received.refetch }} />
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
