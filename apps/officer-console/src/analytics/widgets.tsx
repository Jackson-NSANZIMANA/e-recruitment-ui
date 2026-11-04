// ══════════════════════════════════════════════════════════════════
// officer-console - the analytics widgets.
//
// Each widget owns its reads, its loading state and its failure, so one slow or
// failing widget never blanks the screen, and each has its own refresh. Every
// figure is an exact count (see ./model.ts); a chart is drawn only once ALL its
// counts have answered, because a half-loaded matrix is a wrong picture.
// ══════════════════════════════════════════════════════════════════

import React from "react";
import { Stack, Text } from "@atlaskit/primitives/compiled";
import type { UseQueryResult } from "@tanstack/react-query";
import type { AmberQueueResponse, ApiClient, CampaignAdminSummary } from "@usrp/api-client";
import { useTranslation } from "@usrp/i18n";
import {
  FigureTable, Heatmap, SeriesChart, SkeletonPanel, StackedColumnChart, StackedRows, StatGrid, Widget,
  formatShare, formatCount,
  type StatGridItem,
} from "@usrp/ui";
import { PIPELINE_STAGES } from "../dashboard/model.js";
import { PanelError } from "../dashboard/panels.js";
import { CLOSED_SHARE_WATCH, ageInDays, dayAsDate, dayQuery, lastDays, ratio, rowSum, stageQuery, toMatrix, weekRows } from "./model.js";
import { useSearchTotals } from "./useSearchTotals.js";

type TFn = ReturnType<typeof useTranslation>["t"];

interface Shared {
  readonly client: ApiClient;
  readonly enabled: boolean;
  readonly now: Date;
}

const STAGE_IDS = PIPELINE_STAGES.map((s) => s.id);
const stageName = (t: TFn, id: string): string => t(`analytics.stages.${id}`);
const dayName = (t: TFn, date: string): string => {
  const at = dayAsDate(date);
  return t("dashboard.series.day_short", { day: at.getUTCDate(), month: t(`dashboard.months.${String(at.getUTCMonth() + 1)}`) });
};
const categoryName = (t: TFn, code: string): string => t(`apply.categories.${code}`, { defaultValue: code });

/** Shared body: skeleton while counts load, the panel error on failure, else the chart. */
function Body({ ready, failed, onRetry, children }: { readonly ready: boolean; readonly failed: boolean; readonly onRetry: () => void; readonly children: React.ReactNode }): React.ReactElement {
  if (failed) return <PanelError onRetry={onRetry} />;
  if (!ready) return <SkeletonPanel shape="chart" />;
  return <>{children}</>;
}

/** The campaign x stage matrix: one exact count per cell. Shared (and de-duplicated by the cache) by several widgets. */
function useCampaignMatrix(shared: Shared, campaigns: readonly CampaignAdminSummary[]): ReturnType<typeof useSearchTotals> & { readonly matrix: readonly (readonly number[])[] } {
  const queries = campaigns.flatMap((c) => STAGE_IDS.map((s) => stageQuery(s, { campaign: c.publicCode })));
  const result = useSearchTotals(shared.client, queries, shared.enabled && campaigns.length > 0);
  return { ...result, matrix: toMatrix(result.totals, campaigns.length) };
}

/** The category x stage matrix. */
function useCategoryMatrix(shared: Shared, categories: readonly string[]): ReturnType<typeof useSearchTotals> & { readonly matrix: readonly (readonly number[])[] } {
  const queries = categories.flatMap((c) => STAGE_IDS.map((s) => stageQuery(s, { category: c })));
  const result = useSearchTotals(shared.client, queries, shared.enabled && categories.length > 0);
  return { ...result, matrix: toMatrix(result.totals, categories.length) };
}

// ── 1. Table: applications by campaign and stage ─────────────────

export function CampaignStageTable({ shared, campaigns }: { readonly shared: Shared; readonly campaigns: readonly CampaignAdminSummary[] }): React.ReactElement {
  const { t, i18n } = useTranslation();
  const m = useCampaignMatrix(shared, campaigns);
  const grand = m.matrix.reduce((s, r) => s + rowSum(r), 0);
  const n = (v: number): string => formatCount(v, i18n.language);
  return (
    <Widget title={t("analytics.campaign_stage.title")} onRefresh={m.refetch} testId="analytics-campaign-stage">
      <Body ready={m.ready} failed={m.failed} onRetry={m.refetch}>
        <FigureTable
          label={t("analytics.campaign_stage.title")}
          rowHeading={t("analytics.campaign_stage.campaign")}
          columns={[...STAGE_IDS.map((id) => ({ id, label: stageName(t, id) })), { id: "total", label: t("analytics.campaign_stage.total") }, { id: "share", label: t("analytics.campaign_stage.share") }]}
          rows={campaigns.map((c, ri) => {
            const row = m.matrix[ri] ?? [];
            const total = rowSum(row);
            return { id: c.publicCode, label: c.campaignLabel, testId: `campaign-stage-${c.publicCode}`, cells: [...row.map(n), n(total), formatShare(ratio(total, grand), i18n.language)] };
          })}
          footer={{
            label: t("analytics.campaign_stage.total"),
            cells: [...STAGE_IDS.map((_, si) => n(m.matrix.reduce((s, r) => s + (r[si] ?? 0), 0))), n(grand), formatShare(ratio(grand, grand), i18n.language)],
          }}
        />
      </Body>
    </Widget>
  );
}

// ── 2. Heatmap: received by weekday ──────────────────────────────

export function WeekdayHeatmap({ shared }: { readonly shared: Shared }): React.ReactElement {
  const { t } = useTranslation();
  const weeks = weekRows(shared.now, 4);
  const days = weeks.flatMap((w) => w.days.filter((d): d is string => d !== null));
  const r = useSearchTotals(shared.client, days.map((d) => dayQuery(d)), shared.enabled);
  const byDay = new Map(days.map((d, i) => [d, r.totals[i] ?? 0]));
  return (
    <Widget title={t("analytics.weekday.title")} description={t("analytics.weekday.lead")} onRefresh={r.refetch} testId="analytics-weekday">
      <Body ready={r.ready} failed={r.failed} onRetry={r.refetch}>
        <Heatmap
          label={t("analytics.weekday.title")}
          rows={weeks.map((w) => ({ id: w.start, label: t("analytics.weekday.week_of", { day: dayAsDate(w.start).getUTCDate(), month: t(`dashboard.months.${String(dayAsDate(w.start).getUTCMonth() + 1)}`) }) }))}
          cols={Array.from({ length: 7 }, (_, i) => ({ id: String(i), label: t(`analytics.weekday.days.${String(i)}`) }))}
          values={weeks.map((w) => w.days.map((d) => (d === null ? null : (byDay.get(d) ?? 0))))}
          keyLabels={[t("analytics.weekday.less"), t("analytics.weekday.more")]}
          testId="weekday-heatmap"
        />
      </Body>
    </Widget>
  );
}

// ── 3 + 6. Category outcomes: table and stacked rows ─────────────

export function CategoryOutcomes({ shared, categories }: { readonly shared: Shared; readonly categories: readonly string[] }): React.ReactElement {
  const { t, i18n } = useTranslation();
  const m = useCategoryMatrix(shared, categories);
  const acceptedIdx = STAGE_IDS.indexOf("accepted");
  const closedIdx = STAGE_IDS.indexOf("closed");
  const n = (v: number): string => formatCount(v, i18n.language);
  return (
    <Widget title={t("analytics.category.title")} onRefresh={m.refetch} testId="analytics-category">
      <Body ready={m.ready} failed={m.failed} onRetry={m.refetch}>
        <FigureTable
          label={t("analytics.category.title")}
          rowHeading={t("analytics.category.category")}
          columns={[{ id: "total", label: t("analytics.category.total") }, { id: "accepted", label: t("analytics.category.accepted") }, { id: "closed", label: t("analytics.category.closed") }, { id: "rate", label: t("analytics.category.rate") }]}
          rows={categories.map((c, ri) => {
            const row = m.matrix[ri] ?? [];
            const total = rowSum(row);
            const accepted = row[acceptedIdx] ?? 0;
            return { id: c, label: categoryName(t, c), testId: `category-${c}`, cells: [n(total), n(accepted), n(row[closedIdx] ?? 0), formatShare(ratio(accepted, total), i18n.language)] };
          })}
        />
      </Body>
    </Widget>
  );
}

export function CategoryStageRows({ shared, categories }: { readonly shared: Shared; readonly categories: readonly string[] }): React.ReactElement {
  const { t } = useTranslation();
  const m = useCategoryMatrix(shared, categories);
  return (
    <Widget title={t("analytics.category_stage.title")} onRefresh={m.refetch} testId="analytics-category-stage">
      <Body ready={m.ready} failed={m.failed} onRetry={m.refetch}>
        <StackedRows
          label={t("analytics.category_stage.title")}
          series={STAGE_IDS.map((id) => ({ id, label: stageName(t, id) }))}
          rows={categories.map((c, ri) => ({ id: c, label: categoryName(t, c), values: m.matrix[ri] ?? [], testId: `category-stage-${c}` }))}
          testId="category-stage-rows"
        />
      </Body>
    </Widget>
  );
}

// ── 4. Grouped columns: stage totals by campaign ─────────────────

export function StageByCampaign({ shared, campaigns }: { readonly shared: Shared; readonly campaigns: readonly CampaignAdminSummary[] }): React.ReactElement {
  const { t } = useTranslation();
  const m = useCampaignMatrix(shared, campaigns);
  return (
    <Widget title={t("analytics.stage_by_campaign.title")} onRefresh={m.refetch} testId="analytics-stage-by-campaign">
      <Body ready={m.ready} failed={m.failed} onRetry={m.refetch}>
        <StackedColumnChart
          mode="grouped"
          label={t("analytics.stage_by_campaign.title")}
          series={campaigns.map((c) => ({ id: c.publicCode, label: c.campaignLabel }))}
          categories={STAGE_IDS.map((id, si) => ({ id, label: stageName(t, id), values: campaigns.map((_, ci) => m.matrix[ci]?.[si] ?? 0) }))}
          testId="stage-by-campaign-chart"
        />
      </Body>
    </Widget>
  );
}

// ── 5. Stat grid: accepted and closed share by campaign ──────────

export function CampaignRatios({ shared, campaigns }: { readonly shared: Shared; readonly campaigns: readonly CampaignAdminSummary[] }): React.ReactElement {
  const { t, i18n } = useTranslation();
  const shown = campaigns.slice(0, 3);
  const m = useCampaignMatrix(shared, shown);
  const acceptedIdx = STAGE_IDS.indexOf("accepted");
  const closedIdx = STAGE_IDS.indexOf("closed");
  return (
    <Widget title={t("analytics.ratios.title")} description={t("analytics.ratios.lead")} onRefresh={m.refetch} testId="analytics-ratios">
      <Body ready={m.ready} failed={m.failed} onRetry={m.refetch}>
        <Stack space="space.200">
          {shown.map((c, ri) => {
            const row = m.matrix[ri] ?? [];
            const total = rowSum(row);
            const closed = ratio(row[closedIdx] ?? 0, total);
            const items: StatGridItem[] = [
              { id: "total", label: t("analytics.ratios.total"), value: formatCount(total, i18n.language), testId: `ratio-${c.publicCode}-total` },
              { id: "accepted", label: t("analytics.ratios.accepted"), value: formatShare(ratio(row[acceptedIdx] ?? 0, total), i18n.language), tone: "success", testId: `ratio-${c.publicCode}-accepted` },
              // A closed share at or above the watch line is flagged in colour and, by the lead line, in words.
              { id: "closed", label: t("analytics.ratios.closed"), value: formatShare(closed, i18n.language), tone: closed !== null && closed >= CLOSED_SHARE_WATCH ? "warning" : "neutral", testId: `ratio-${c.publicCode}-closed` },
            ];
            return (
              <Stack key={c.publicCode} space="space.100">
                <Text as="p" size="large" weight="semibold">{c.campaignLabel}</Text>
                <StatGrid label={c.campaignLabel} items={items} />
              </Stack>
            );
          })}
        </Stack>
      </Body>
    </Widget>
  );
}

// ── 7. Stacked area: received by category over time ──────────────

const TREND_DAYS = 14;
const TREND_CATEGORIES = 3;

export function CategoryTrend({ shared, categories }: { readonly shared: Shared; readonly categories: readonly string[] }): React.ReactElement {
  const { t } = useTranslation();
  const days = lastDays(shared.now, TREND_DAYS);
  const top = categories.slice(0, TREND_CATEGORIES);
  // One request per (day, top category) plus one per day for the total: "other" is the total minus the named ones.
  const queries = [...top.flatMap((c) => days.map((d) => dayQuery(d, { category: c }))), ...days.map((d) => dayQuery(d))];
  const r = useSearchTotals(shared.client, queries, shared.enabled);
  const named = top.map((_, ci) => days.map((_, di) => r.totals[ci * days.length + di] ?? 0));
  const totals = days.map((_, di) => r.totals[top.length * days.length + di] ?? 0);
  const other = days.map((_, di) => Math.max(0, (totals[di] ?? 0) - named.reduce((s, series) => s + (series[di] ?? 0), 0)));
  return (
    <Widget title={t("analytics.trend.title")} description={t("analytics.trend.lead")} onRefresh={r.refetch} testId="analytics-trend">
      <Body ready={r.ready} failed={r.failed} onRetry={r.refetch}>
        <SeriesChart
          mode="stacked-area"
          label={t("analytics.trend.title")}
          xLabels={days.map((d) => dayName(t, d))}
          series={[...top.map((c, ci) => ({ id: c, label: categoryName(t, c), values: named[ci] ?? [] })), { id: "other", label: t("analytics.trend.other"), values: other }]}
          emptyText={t("analytics.trend.empty")}
          testId="category-trend-chart"
        />
      </Body>
    </Widget>
  );
}

// ── 8. Columns: average days waiting, by hold ────────────────────

export function QueueAge({ amber, now }: { readonly amber: UseQueryResult<AmberQueueResponse>; readonly now: Date }): React.ReactElement {
  const { t } = useTranslation();
  const groups = new Map<string, number[]>();
  for (const entry of amber.data ?? []) {
    const age = ageInDays(entry.queuedAt, now);
    if (age === null) continue;
    const key = entry.status ?? "UNKNOWN";
    groups.set(key, [...(groups.get(key) ?? []), age]);
  }
  const categories = [...groups].map(([status, ages]) => ({
    id: status,
    label: status === "UNKNOWN" ? "—" : t(`status.${status}`, { defaultValue: status }),
    values: [Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10],
  }));
  return (
    <Widget title={t("analytics.queue_age.title")} onRefresh={() => void amber.refetch()} testId="analytics-queue-age">
      {amber.isError ? <PanelError onRetry={() => void amber.refetch()} /> : amber.data === undefined ? <SkeletonPanel shape="chart" /> : categories.length === 0 ? (
        <Text as="p" size="large" color="color.text.subtle" testId="queue-age-empty">{t("analytics.queue_age.empty")}</Text>
      ) : (
        <StackedColumnChart mode="grouped" label={t("analytics.queue_age.title")} series={[{ id: "avg", label: t("analytics.queue_age.series") }]} categories={categories} height={240} testId="queue-age-chart" />
      )}
    </Widget>
  );
}

