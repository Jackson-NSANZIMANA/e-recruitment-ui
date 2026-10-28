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
import Button from "@atlaskit/button/new";
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
import { RouterLink, StateBoundary, listState } from "@usrp/ui";
import { calendarDay, fleetSummary, occupancyShare, PIPELINE_STAGES, staffSummary, type AttentionItem } from "./model.js";

const styles = cssMap({
  panel: {
    padding: token("space.300"),
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderColor: token("color.border"),
    borderRadius: token("radius.medium"),
    backgroundColor: token("elevation.surface"),
  },
  meterTrack: { width: "100%", minWidth: "96px", height: "0.5rem", borderRadius: token("radius.small"), backgroundColor: token("color.background.neutral") },
  fill: { height: "100%", borderRadius: token("radius.small"), backgroundColor: token("color.background.brand.bold") },
  fillWarning: { backgroundColor: token("color.background.warning.bold") },
  attentionRow: { paddingBlock: token("space.100"), borderBlockEndWidth: token("border.width"), borderBlockEndStyle: "solid", borderBlockEndColor: token("color.border") },
  stageTrack: { width: "100%", height: "0.75rem", borderRadius: token("radius.small"), backgroundColor: token("color.background.neutral") },
  stageLabel: { minWidth: "220px" },
  figure: { minWidth: "140px" },
});

const STATUS_APPEARANCE: Readonly<Record<CampaignStatus, "success" | "inprogress" | "moved" | "default" | "removed">> = {
  REGISTRATION_OPEN: "success",
  EXAMINATION_ACTIVE: "inprogress",
  REGISTRATION_CLOSED: "moved",
  DRAFT: "default",
  COMPLETED: "default",
  CANCELLED: "removed",
};

/** A titled, bordered region; the heading names it for assistive technology. */
export function Panel({ title, testId, action, children }: { readonly title: string; readonly testId: string; readonly action?: React.ReactNode; readonly children: React.ReactNode }): React.ReactElement {
  const id = `${testId}-title`;
  return (
    <section aria-labelledby={id} data-testid={testId}>
      <Box xcss={styles.panel}>
        <Stack space="space.200">
          <Inline spread="space-between" alignBlock="center" shouldWrap>
            <Heading size="medium" as="h2" id={id}>{title}</Heading>
            {action}
          </Inline>
          {children}
        </Stack>
      </Box>
    </section>
  );
}

/** The panel's own failure: says what failed and offers a retry, nothing else. */
function PanelError({ onRetry }: { readonly onRetry: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <SectionMessage appearance="warning" testId="panel-error">
      <Stack space="space.100">
        <Text as="p">{t("dashboard.panel_error")}</Text>
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
  return (
    <Panel title={t("dashboard.attention.title")} testId="dashboard-attention">
      {!ready ? <StateBoundary state="loading" /> : items.length === 0 ? (
        <SectionMessage appearance="success" testId="attention-none"><Text as="p">{t("dashboard.attention.none")}</Text></SectionMessage>
      ) : (
        <Stack space="space.0" testId="attention-list">
          {items.map((i) => (
            <Box key={`${i.kind}-${"publicCode" in i ? i.publicCode : ""}`} xcss={styles.attentionRow} testId={`attention-${i.kind}`}>
              <Inline spread="space-between" alignBlock="center" shouldWrap space="space.200">
                <Text as="p" weight="medium">{line(i)}</Text>
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


export function CampaignsPanel({ query, rows }: { readonly query: UseQueryResult<unknown, Error>; readonly rows: readonly CampaignAdminSummary[] }): React.ReactElement {
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
        { key: "campaign", content: <Stack space="space.025"><Text weight="semibold">{c.campaignLabel}</Text><Text size="small" color="color.text.subtle">{c.publicCode}</Text></Stack> },
        { key: "status", content: <StatusBadge status={c.status} /> },
        { key: "registration", content: <Text>{t("dashboard.campaigns.range", { from: day(c.registrationOpensAt), to: day(c.registrationClosesAt) })}</Text> },
        { key: "examination", content: <Text>{t("dashboard.campaigns.range", { from: day(c.examinationStartDate), to: day(c.examinationEndDate) })}</Text> },
        {
          key: "occupancy",
          content: (
            <Stack space="space.050">
              <Text size="small">{occupancyText}</Text>
              {share !== null && cap !== null && <Meter value={c.occupancy.registeredTotal} max={cap} label={occupancyText} />}
            </Stack>
          ),
        },
        { key: "sessions", content: <Text>{String(c.occupancy.sessionCount)}</Text> },
      ],
    };
  });
  if (query.isError) return <Panel title={t("dashboard.campaigns.title")} testId="dashboard-campaigns"><PanelError onRetry={() => void query.refetch()} /></Panel>;
  return (
    <Panel title={t("dashboard.campaigns.title")} testId="dashboard-campaigns">
      <StateBoundary state={state} copy={{ empty: { title: t("dashboard.campaigns.empty"), body: "" } }}>
        <DynamicTable label={t("dashboard.campaigns.title")} head={head} rows={tableRows} />
      </StateBoundary>
    </Panel>
  );
}

// ── Applications by stage ───────────────────────────────────────

export function PipelinePanel({ client, enabled }: { readonly client: ApiClient; readonly enabled: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const results = useQueries({
    queries: PIPELINE_STAGES.map((s) => {
      const q = { status: s.statuses, limit: 1 };
      return { queryKey: searchKeys.query(q), queryFn: () => searchApplications(client, q), enabled, retry: false, staleTime: 30_000 };
    }),
  });
  const loading = results.some((r) => r.isLoading);
  const failed = results.some((r) => r.isError);
  const totals = results.map((r) => r.data?.total ?? 0);
  const max = Math.max(1, ...totals);
  return (
    <Panel title={t("dashboard.pipeline.title")} testId="dashboard-pipeline">
      <Text as="p" color="color.text.subtle">{t("dashboard.pipeline.lead")}</Text>
      {failed ? <PanelError onRetry={() => { for (const r of results) void r.refetch(); }} /> : loading ? <StateBoundary state="loading" /> : (
        <Stack space="space.150">
          {PIPELINE_STAGES.map((s, i) => {
            const total = totals.at(i) ?? 0;
            const label = t(`dashboard.pipeline.stages.${s.id}`);
            return (
              <Inline key={s.id} space="space.200" alignBlock="center" testId={`stage-${s.id}`}>
                <Box xcss={styles.stageLabel}><Text>{label}</Text></Box>
                <Box xcss={styles.stageTrack}>
                  <Box aria-hidden xcss={styles.fill} style={{ width: `${String(Math.round((total / max) * 100))}%` }} />
                </Box>
                <Text weight="semibold" testId={`stage-${s.id}-total`}>{String(total)}</Text>
              </Inline>
            );
          })}
        </Stack>
      )}
    </Panel>
  );
}

// ── Staff ───────────────────────────────────────────────────────

function Figure({ label, value, testId }: { readonly label: string; readonly value: number; readonly testId: string }): React.ReactElement {
  return (
    <Box xcss={styles.figure} testId={testId}>
      <Stack space="space.025">
        <Text size="small" color="color.text.subtle">{label}</Text>
        <Text size="large" weight="bold">{String(value)}</Text>
      </Stack>
    </Box>
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
      <Inline space="space.300" shouldWrap>
        <Figure label={t("dashboard.staff.active")} value={s.active} testId="staff-active" />
        <Figure label={t("dashboard.staff.pending")} value={s.pending} testId="staff-pending" />
        <Figure label={t("dashboard.staff.disabled")} value={s.disabled} testId="staff-disabled" />
      </Inline>
      {s.byPost.length > 0 && (
        <Stack space="space.075">
          <Heading size="xsmall" as="h3">{t("dashboard.staff.by_post")}</Heading>
          {s.byPost.map((p) => (
            <Inline key={p.post} spread="space-between" testId={`post-${p.post}`}>
              <Text>{t(`dashboard.staff.posts.${p.post}`)}</Text>
              <Text weight="semibold">{String(p.count)}</Text>
            </Inline>
          ))}
        </Stack>
      )}
    </Panel>
  );
}

// ── Field tablets ───────────────────────────────────────────────

export function FleetPanel({ query, now }: { readonly query: UseQueryResult<{ readonly devices: readonly FleetDevice[] }, Error>; readonly now: Date }): React.ReactElement {
  const { t } = useTranslation();
  if (query.isError) return <Panel title={t("dashboard.fleet.title")} testId="dashboard-fleet"><PanelError onRetry={() => void query.refetch()} /></Panel>;
  if (query.data === undefined) return <Panel title={t("dashboard.fleet.title")} testId="dashboard-fleet"><StateBoundary state="loading" /></Panel>;
  if (query.data.devices.length === 0) {
    return <Panel title={t("dashboard.fleet.title")} testId="dashboard-fleet"><Text as="p" testId="fleet-empty">{t("dashboard.fleet.empty")}</Text></Panel>;
  }
  const f = fleetSummary(query.data.devices, now);
  return (
    <Panel title={t("dashboard.fleet.title")} testId="dashboard-fleet">
      <Inline space="space.300" shouldWrap>
        <Figure label={t("dashboard.fleet.active")} value={f.active} testId="fleet-active" />
        <Figure label={t("dashboard.fleet.seen_today")} value={f.seenToday} testId="fleet-seen-today" />
        <Figure label={t("dashboard.fleet.assigned")} value={f.assigned} testId="fleet-assigned" />
        <Figure label={t("dashboard.fleet.revoked")} value={f.revoked} testId="fleet-revoked" />
      </Inline>
    </Panel>
  );
}
