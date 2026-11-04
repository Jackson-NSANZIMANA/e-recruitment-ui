// ══════════════════════════════════════════════════════════════════
// officer-console — administration dashboard panels.
//
// Each panel owns its own read and its own state, so one failing read shows
// its own retry and never blanks the rest of the page. Status is always
// written in words; colour only repeats it. Nothing here names a candidate.
// ══════════════════════════════════════════════════════════════════

import React from "react";
import DynamicTable from "@atlaskit/dynamic-table";
import Heading from "@atlaskit/heading";
import SectionMessage from "@atlaskit/section-message";
import Button, { LinkButton } from "@atlaskit/button/new";
import AddIcon from "@atlaskit/icon/core/add";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import CampaignIcon from "@atlaskit/icon/core/megaphone";
import Lozenge from "@atlaskit/lozenge";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import {
  httpStatusOf, searchApplications, searchKeys,
  type ApiClient, type CampaignAdminSummary, type CampaignStatus, type FleetDevice, type OfficerRow,
} from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import { BarChart, Card, RingGauge, RouterLink, SkeletonPanel, StateBoundary, TrendChart, formatCount, formatShare, listState, type BarChartItem, type BarTone } from "@usrp/ui";
import { AMBER_HISTORY_DAYS, NEAR_CAPACITY_SHARE, amberArrivalSeries, calendarDay, fleetSummary, occupancyShare, PIPELINE_STAGES, staffSummary, type AttentionItem, type PipelineStageId } from "./model.js";

const styles = cssMap({
  meterTrack: { width: "100%", minWidth: "96px", height: "0.5rem", borderRadius: token("radius.small"), backgroundColor: token("color.background.neutral") },
  fill: { height: "100%", borderRadius: token("radius.small"), backgroundColor: token("color.background.brand.bold") },
  fillWarning: { backgroundColor: token("color.background.warning.bold") },
  // All-clear: a notice that hugs its text, not a banner that fills the row.
  allClear: {
    display: "inline-flex",
    alignItems: "center",
    gap: token("space.100"),
    alignSelf: "flex-start",
    paddingBlock: token("space.100"),
    paddingInline: token("space.200"),
    borderRadius: token("radius.medium"),
    backgroundColor: token("color.background.success"),
    color: token("color.text.success"),
  },
  blank: { paddingBlock: token("space.600"), paddingInline: token("space.300"), textAlign: "center" },
  blankIcon: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "4rem", height: "4rem", borderRadius: token("radius.full"),
    backgroundColor: token("color.background.accent.purple.subtlest"), color: token("color.text.accent.purple"),
  },
  blankBody: { maxWidth: "28rem" },
  attentionRow: { paddingBlock: token("space.100"), borderBlockEndWidth: token("border.width"), borderBlockEndStyle: "solid", borderBlockEndColor: token("color.border") },
});

const STATUS_APPEARANCE: Readonly<Record<CampaignStatus, "success" | "inprogress" | "moved" | "default" | "removed">> = {
  REGISTRATION_OPEN: "success",
  EXAMINATION_ACTIVE: "inprogress",
  REGISTRATION_CLOSED: "moved",
  DRAFT: "default",
  COMPLETED: "default",
  CANCELLED: "removed",
};

/**
 * A titled, bordered region; the heading names it for assistive technology.
 *
 * This used to carry its own `panel` cssMap block, which had drifted from the
 * identical block in `DashboardMetricCard`: one bordered on a white surface, the
 * other filled the surface grey. Both now delegate to `Card`, so a panel and a
 * metric tile are the same raised plane and cannot disagree again.
 */
export function Panel({ title, testId, action, description, children }: { readonly title: string; readonly testId: string; readonly action?: React.ReactNode; readonly description?: string; readonly children: React.ReactNode }): React.ReactElement {
  return (
    <Card title={title} titleLevel={2} {...(description !== undefined ? { description } : {})} {...(action !== undefined ? { actions: action } : {})} testId={testId}>
      {children}
    </Card>
  );
}

/** The panel's own failure: says what failed and offers a retry, nothing else. */
function PanelError({ onRetry }: { readonly onRetry: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <SectionMessage appearance="warning" testId="panel-error">
      <Stack space="space.100">
        <Text size="large" as="p">{t("dashboard.panel_error")}</Text>
        <Inline><Button onClick={onRetry}>{t("dashboard.retry")}</Button></Inline>
      </Stack>
    </SectionMessage>
  );
}

function Meter({ value, max, label }: { readonly value: number; readonly max: number; readonly label: string }): React.ReactElement {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <Box xcss={styles.meterTrack}>
        <Box xcss={cx(styles.fill, pct >= 90 && styles.fillWarning)} style={{ width: `${String(pct)}%` }} />
      </Box>
    </div>
  );
}

export function StatusBadge({ status }: { readonly status: CampaignStatus }): React.ReactElement {
  const { t } = useTranslation();
  return <Lozenge appearance={STATUS_APPEARANCE[status]} testId={`campaign-status-${status}`}>{t(`dashboard.campaigns.status.${status}`)}</Lozenge>;
}

// ── Requires attention ──────────────────────────────────────────

export function AttentionPanel({ items, ready }: { readonly items: readonly AttentionItem[]; readonly ready: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const line = (i: AttentionItem): string =>
    i.kind === "amber" || i.kind === "pending_release" || i.kind === "stale_devices"
      ? t(`dashboard.attention.${i.kind}`, { count: i.count })
      : t(`dashboard.attention.${i.kind}`, { campaign: i.campaign });
  // Nothing to do is good news and takes one line. It was a full-width card around
  // a full-width green banner around one sentence: the most prominent thing on a
  // quiet day was the statement that there is nothing to see.
  if (ready && items.length === 0) {
    return (
      <Box xcss={styles.allClear} role="status" testId="dashboard-attention">
        <CheckCircleIcon label="" color="currentColor" />
        <Text size="large" weight="medium" color="color.text.success" testId="attention-none">{t("dashboard.attention.none")}</Text>
      </Box>
    );
  }
  return (
    <Panel title={t("dashboard.attention.title")} testId="dashboard-attention">
      {!ready ? <StateBoundary state="loading" /> : (
        <Stack space="space.0" testId="attention-list">
          {items.map((i) => (
            <Box key={`${i.kind}-${"publicCode" in i ? i.publicCode : ""}`} xcss={styles.attentionRow} testId={`attention-${i.kind}`}>
              <Inline spread="space-between" alignBlock="center" shouldWrap space="space.200">
                <Text size="large" as="p" weight="medium">{line(i)}</Text>
                {"href" in i && <RouterLink href={i.href}>{t("dashboard.attention.open")}</RouterLink>}
              </Inline>
            </Box>
          ))}
        </Stack>
      )}
    </Panel>
  );
}

// ── Campaigns ───────────────────────────────────────────────────


/**
 * The Atlassian blank-state pattern: an icon, a heading, one muted sentence and the
 * primary action - so an empty panel invites the next step instead of reporting
 * a lack. The button is offered only to a post that may create campaigns.
 */
function CampaignsBlank({ canCreate }: { readonly canCreate: boolean }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Stack space="space.200" alignInline="center" xcss={styles.blank} testId="campaigns-blank">
      <Box xcss={styles.blankIcon} aria-hidden="true"><CampaignIcon label="" color="currentColor" size="medium" /></Box>
      <Heading size="medium" as="h3">{t("dashboard.campaigns.blank_title")}</Heading>
      <Box xcss={styles.blankBody}><Text as="p" size="large" color="color.text.subtle" align="center">{t("dashboard.campaigns.blank_body")}</Text></Box>
      {canCreate && (
        <LinkButton appearance="primary" href="/campaigns/new" iconBefore={AddIcon} testId="campaigns-blank-create">{t("dashboard.campaigns.blank_action")}</LinkButton>
      )}
    </Stack>
  );
}

export function CampaignsPanel({ query, rows, canCreate = false }: { readonly query: UseQueryResult<unknown, Error>; readonly rows: readonly CampaignAdminSummary[]; readonly canCreate?: boolean }): React.ReactElement {
  const { t } = useTranslation();
  // Day before month, as on official documents: "27 Ukwakira 2026".
  const day = (value: string): string => {
    const d = calendarDay(value);
    return d === null ? value : t("dashboard.day", { day: d.day, month: t(`dashboard.months.${String(d.month)}`), year: d.year });
  };
  const state = listState({ isLoading: query.isLoading, errorStatus: query.isError ? httpStatusOf(query.error) : null, rowCount: rows.length, filtersActive: false });
  const head = {
    cells: [
      { key: "campaign", content: t("dashboard.campaigns.cols.campaign") },
      { key: "status", content: t("dashboard.campaigns.cols.status") },
      { key: "registration", content: t("dashboard.campaigns.cols.registration") },
      { key: "examination", content: t("dashboard.campaigns.cols.examination") },
      { key: "occupancy", content: t("dashboard.campaigns.cols.occupancy") },
      { key: "sessions", content: t("dashboard.campaigns.cols.sessions") },
    ],
  };
  const tableRows = rows.map((c) => {
    const share = occupancyShare(c);
    const cap = c.occupancy.capacityTotal;
    const occupancyText = cap === null
      ? t("dashboard.campaigns.occupancy_unbounded", { registered: c.occupancy.registeredTotal })
      : t("dashboard.campaigns.occupancy_value", { registered: c.occupancy.registeredTotal, capacity: cap });
    return {
      key: c.publicCode,
      testId: `campaign-row-${c.publicCode}`,
      cells: [
        { key: "campaign", content: <Stack space="space.025"><Text size="large" weight="semibold">{c.campaignLabel}</Text><Text size="large" color="color.text.subtle">{c.publicCode}</Text></Stack> },
        { key: "status", content: <StatusBadge status={c.status} /> },
        { key: "registration", content: <Text size="large">{t("dashboard.campaigns.range", { from: day(c.registrationOpensAt), to: day(c.registrationClosesAt) })}</Text> },
        { key: "examination", content: <Text size="large">{t("dashboard.campaigns.range", { from: day(c.examinationStartDate), to: day(c.examinationEndDate) })}</Text> },
        {
          key: "occupancy",
          content: (
            <Stack space="space.050">
              <Text size="large">{occupancyText}</Text>
              {share !== null && cap !== null && <Meter value={c.occupancy.registeredTotal} max={cap} label={occupancyText} />}
            </Stack>
          ),
        },
        { key: "sessions", content: <Text size="large">{String(c.occupancy.sessionCount)}</Text> },
      ],
    };
  });
  if (query.isError) return <Panel title={t("dashboard.campaigns.title")} testId="dashboard-campaigns"><PanelError onRetry={() => void query.refetch()} /></Panel>;
  if (state === "empty") return <Panel title={t("dashboard.campaigns.title")} testId="dashboard-campaigns"><CampaignsBlank canCreate={canCreate} /></Panel>;
  return (
    <Panel title={t("dashboard.campaigns.title")} testId="dashboard-campaigns">
      <StateBoundary state={state}>
        <DynamicTable label={t("dashboard.campaigns.title")} head={head} rows={tableRows} />
      </StateBoundary>
    </Panel>
  );
}

// ── Applications by stage ───────────────────────────────────────

/** What each stage's bar means. Work in progress is one hue; the two end states say what they are. */
const STAGE_TONE: Readonly<Record<PipelineStageId, BarTone>> = {
  vetting: "brand", documents: "brand", exam: "brand", medical: "brand", accepted: "success", closed: "neutral",
};

export function PipelinePanel({ client, enabled }: { readonly client: ApiClient; readonly enabled: boolean }): React.ReactElement {
  const { t, i18n } = useTranslation();
  const results = useQueries({
    queries: PIPELINE_STAGES.map((s) => {
      const q = { status: s.statuses, limit: 1 };
      return { queryKey: searchKeys.query(q), queryFn: () => searchApplications(client, q), enabled, retry: false, staleTime: 30_000 };
    }),
  });
  const loading = results.some((r) => r.isLoading);
  const failed = results.some((r) => r.isError);
  const totals = results.map((r) => r.data?.total ?? 0);
  const grand = totals.reduce((sum, n) => sum + n, 0);
  const items: readonly BarChartItem[] = PIPELINE_STAGES.map((stage, index) => ({
    id: stage.id,
    label: t(`dashboard.pipeline.stages.${stage.id}`),
    value: totals.at(index) ?? 0,
    tone: STAGE_TONE[stage.id],
    ...(grand > 0 ? { detail: formatShare((totals.at(index) ?? 0) / grand, i18n.language) } : {}),
    // The row and its bare number keep their own ids: an officer reads the exact
    // count before acting on it, and the e2e suite asserts `stage-<id>-total`.
    testId: `stage-${stage.id}`,
    valueTestId: `stage-${stage.id}-total`,
  }));
  return (
    <Panel title={t("dashboard.pipeline.title")} description={failed || loading ? t("dashboard.pipeline.lead") : t("dashboard.pipeline.total", { count: grand })} testId="dashboard-pipeline">
      {failed ? <PanelError onRetry={() => { for (const r of results) void r.refetch(); }} /> : loading ? <SkeletonPanel shape="chart" /> : (
        <BarChart label={t("dashboard.pipeline.title")} items={items} max={Math.max(1, ...totals)} testId="pipeline-chart" />
      )}
    </Panel>
  );
}

// ── Adjudication queue: arrivals ────────────────────────────────

export function ArrivalsPanel({ entries, now }: { readonly entries: readonly { readonly queuedAt: string | null }[] | undefined; readonly now: Date }): React.ReactElement {
  const { t } = useTranslation();
  const dayLabel = (at: Date): string => t("dashboard.series.day_short", { day: at.getUTCDate(), month: t(`dashboard.months.${String(at.getUTCMonth() + 1)}`) });
  return (
    <Panel title={t("dashboard.charts.arrivals_title")} description={t("dashboard.series.arrivals_caption", { days: AMBER_HISTORY_DAYS })} testId="dashboard-arrivals">
      {entries === undefined ? <SkeletonPanel shape="chart" /> : (
        <TrendChart
          data={amberArrivalSeries(entries, now).map((d) => ({ label: dayLabel(d.at), value: d.count }))}
          label={t("dashboard.series.arrivals_caption", { days: AMBER_HISTORY_DAYS })}
          unit={t("dashboard.charts.arrivals_unit")}
          emptyText={t("dashboard.charts.arrivals_empty", { days: AMBER_HISTORY_DAYS })}
          testId="arrivals-chart"
        />
      )}
    </Panel>
  );
}

// ── Registration capacity ───────────────────────────────────────

const CAPACITY_STATES: ReadonlySet<CampaignStatus> = new Set<CampaignStatus>(["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "EXAMINATION_ACTIVE"]);

export function CapacityPanel({ rows, query }: { readonly rows: readonly CampaignAdminSummary[]; readonly query: UseQueryResult<unknown, Error> }): React.ReactElement {
  const { t, i18n } = useTranslation();
  if (query.isError) return <Panel title={t("dashboard.charts.capacity_title")} testId="dashboard-capacity"><PanelError onRetry={() => void query.refetch()} /></Panel>;
  if (query.isLoading) return <Panel title={t("dashboard.charts.capacity_title")} testId="dashboard-capacity"><SkeletonPanel shape="chart" /></Panel>;
  const items: BarChartItem[] = [];
  for (const c of rows) {
    const cap = c.occupancy.capacityTotal;
    const share = occupancyShare(c);
    if (!CAPACITY_STATES.has(c.status) || cap === null || share === null) continue;
    items.push({
      id: c.publicCode,
      label: c.campaignLabel,
      value: c.occupancy.registeredTotal,
      max: cap,
      display: t("dashboard.campaigns.occupancy_value", { registered: formatCount(c.occupancy.registeredTotal, i18n.language), capacity: formatCount(cap, i18n.language) }),
      detail: formatShare(share, i18n.language),
      // Nearly full is a heads-up, not a failure: warning, never danger.
      tone: share >= NEAR_CAPACITY_SHARE ? "warning" : "brand",
      testId: `capacity-${c.publicCode}`,
    });
  }
  return (
    <Panel title={t("dashboard.charts.capacity_title")} description={t("dashboard.charts.capacity_lead")} testId="dashboard-capacity">
      <BarChart label={t("dashboard.charts.capacity_title")} items={items} emptyText={t("dashboard.charts.capacity_empty")} testId="capacity-chart" />
    </Panel>
  );
}

// ── Staff ───────────────────────────────────────────────────────

const statStyles = cssMap({
  figure: {
    // eslint-disable-next-line @atlaskit/design-system/use-tokens-typography -- the ADS metric face has no allowlisted family
    font: token("font.metric.medium"),
    fontWeight: token("font.weight.bold"),
    fontVariantNumeric: "tabular-nums",
    color: token("color.text"),
    margin: token("space.0"),
  },
  stat: { minWidth: "0" },
  figures: { display: "grid", gap: token("space.200"), gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 5.5rem), 1fr))" },
});

/**
 * A staff/fleet figure inside a panel: label over a metric-face number.
 *
 * Not a `MetricCard`: a card inside a card doubles the border and shadow and made
 * the panel read as a stack of boxes. `testId` still lands on the outer element,
 * so the `staff-active` / `fleet-active` e2e assertions are unchanged.
 */
function Figure({ label, value, testId }: { readonly label: string; readonly value: number; readonly testId: string }): React.ReactElement {
  const { i18n } = useTranslation();
  return (
    <Stack space="space.025" xcss={statStyles.stat} testId={testId}>
      <Text as="p" size="large" color="color.text.subtle">{label}</Text>
      <Box as="p" xcss={statStyles.figure}>{formatCount(value, i18n.language)}</Box>
    </Stack>
  );
}

export function StaffPanel({ query }: { readonly query: UseQueryResult<{ readonly officers: readonly OfficerRow[] }, Error> }): React.ReactElement {
  const { t } = useTranslation();
  const manage = <RouterLink href="/staff">{t("dashboard.staff.manage")}</RouterLink>;
  if (query.isError) return <Panel title={t("dashboard.staff.title")} testId="dashboard-staff" action={manage}><PanelError onRetry={() => void query.refetch()} /></Panel>;
  if (query.data === undefined) return <Panel title={t("dashboard.staff.title")} testId="dashboard-staff" action={manage}><StateBoundary state="loading" /></Panel>;
  const s = staffSummary(query.data.officers);
  return (
    <Panel title={t("dashboard.staff.title")} testId="dashboard-staff" action={manage}>
      <Box xcss={statStyles.figures}>
        <Figure label={t("dashboard.staff.active")} value={s.active} testId="staff-active" />
        <Figure label={t("dashboard.staff.pending")} value={s.pending} testId="staff-pending" />
        <Figure label={t("dashboard.staff.disabled")} value={s.disabled} testId="staff-disabled" />
      </Box>
      {s.byPost.length > 0 && (
        <Stack space="space.150">
          <Heading size="xsmall" as="h3">{t("dashboard.staff.by_post")}</Heading>
          <BarChart
            label={t("dashboard.staff.by_post")}
            items={s.byPost.map((p) => ({ id: p.post, label: t(`dashboard.staff.posts.${p.post}`), value: p.count, testId: `post-${p.post}` }))}
          />
        </Stack>
      )}
    </Panel>
  );
}

// ── Field tablets ───────────────────────────────────────────────

export function FleetPanel({ query, now }: { readonly query: UseQueryResult<{ readonly devices: readonly FleetDevice[] }, Error>; readonly now: Date }): React.ReactElement {
  const { t, i18n } = useTranslation();
  if (query.isError) return <Panel title={t("dashboard.fleet.title")} testId="dashboard-fleet"><PanelError onRetry={() => void query.refetch()} /></Panel>;
  if (query.data === undefined) return <Panel title={t("dashboard.fleet.title")} testId="dashboard-fleet"><StateBoundary state="loading" /></Panel>;
  if (query.data.devices.length === 0) {
    return <Panel title={t("dashboard.fleet.title")} testId="dashboard-fleet"><Text size="large" as="p" testId="fleet-empty">{t("dashboard.fleet.empty")}</Text></Panel>;
  }
  const f = fleetSummary(query.data.devices, now);
  return (
    <Panel title={t("dashboard.fleet.title")} testId="dashboard-fleet">
      <Stack space="space.300">
        <Inline space="space.300" alignBlock="center" shouldWrap>
          <RingGauge value={f.seenToday} total={f.active} label={t("dashboard.fleet.seen_today")} tone={f.active > 0 && f.seenToday < f.active ? "warning" : "success"} testId="fleet-gauge" />
          <Text as="p" size="large" weight="semibold">{t("dashboard.campaigns.occupancy_value", { registered: formatCount(f.seenToday, i18n.language), capacity: formatCount(f.active, i18n.language) })}</Text>
        </Inline>
      <Box xcss={statStyles.figures}>
        <Figure label={t("dashboard.fleet.active")} value={f.active} testId="fleet-active" />
        <Figure label={t("dashboard.fleet.seen_today")} value={f.seenToday} testId="fleet-seen-today" />
        <Figure label={t("dashboard.fleet.assigned")} value={f.assigned} testId="fleet-assigned" />
        <Figure label={t("dashboard.fleet.revoked")} value={f.revoked} testId="fleet-revoked" />
      </Box>
      </Stack>
    </Panel>
  );
}
