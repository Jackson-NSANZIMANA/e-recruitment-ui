import React from "react";
import { Box } from "@atlaskit/primitives/compiled";
import SectionMessage from "@atlaskit/section-message";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { createApiClient, useAgencyCampaigns, useAmberQueue } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { AgencyLogo, PageShell } from "@usrp/ui";
import { EDGE_BASE_URL } from "../env.js";
import { accessFor, sortCampaigns } from "../dashboard/model.js";
import { CampaignRatios, CampaignStageTable, CategoryOutcomes, CategoryStageRows, CategoryTrend, QueueAge, StageByCampaign, WeekdayHeatmap } from "../analytics/widgets.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });

// Three columns on a wide screen, as in a team-performance board; two on a
// tablet; one on a phone. `minmax(0, 1fr)` lets a chart shrink instead of
// pushing the page sideways. A `wide` widget (a table) spans two columns.
const grid = cssMap({
  board: {
    display: "grid",
    gap: token("space.300"),
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "stretch",
    "@media (min-width: 48rem)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    "@media (min-width: 90rem)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
  },
  wide: { "@media (min-width: 48rem)": { gridColumn: "span 2" } },
  full: { gridColumn: "1 / -1" },
  cell: { minWidth: "0" },
});

/** Campaigns compared side by side: the newest live ones. More than five stops being a comparison. */
const FEATURED_CAMPAIGNS = 5;
/** Categories broken out. The rest are not hidden from the total, only from the breakdown. */
const FEATURED_CATEGORIES = 4;

/**
 * Recruitment performance: the pipeline measured the way a team-performance
 * board measures work - a table, a heatmap, grouped and stacked charts, a stat
 * grid - all from exact counts in the application register. Nothing is sampled:
 * each cell is its own count.
 */
export default function AnalyticsPage(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const access = accessFor(session?.permissions ?? []);
  const signedIn = session !== null;
  const permitted = signedIn && access.applications && access.campaigns;
  const campaigns = useAgencyCampaigns(client, { limit: 100 }, permitted);
  const amber = useAmberQueue(client, session?.agency ?? "RDF", signedIn && access.adjudication);
  const now = React.useMemo(() => new Date(), []);

  const all = sortCampaigns(campaigns.data?.campaigns ?? []);
  const featured = all.slice(0, FEATURED_CAMPAIGNS);
  const categories = [...new Set(all.flatMap((c) => c.targetCategories))].sort().slice(0, FEATURED_CATEGORIES);
  const shared = { client, enabled: permitted, now } as const;
  const hasCampaigns = featured.length > 0;

  return (
    <PageShell
      align="bleed"
      spacious
      title={t("analytics.title")}
      description={t("analytics.lead")}
      {...(signedIn ? { breadcrumbs: <AgencyLogo agency={session.agency} size="sm" /> } : {})}
      testId="analytics-page"
    >
      {!permitted ? (
        <SectionMessage appearance="warning" testId="analytics-forbidden">{t("errors.forbidden")}</SectionMessage>
      ) : (
        <>
          {campaigns.isSuccess && !hasCampaigns && <SectionMessage appearance="information" testId="analytics-no-campaigns">{t("analytics.no_campaigns")}</SectionMessage>}
          <Box xcss={grid.board} testId="analytics-board">
            {hasCampaigns && <Box xcss={cx(grid.cell, grid.wide)}><CampaignStageTable shared={shared} campaigns={featured} /></Box>}
            {hasCampaigns && categories.length > 0 && <Box xcss={grid.cell}><CategoryOutcomes shared={shared} categories={categories} /></Box>}
            {hasCampaigns && <Box xcss={cx(grid.cell, grid.wide)}><StageByCampaign shared={shared} campaigns={featured} /></Box>}
            {access.adjudication && <Box xcss={grid.cell}><QueueAge amber={amber} now={now} /></Box>}
            <Box xcss={grid.cell}><WeekdayHeatmap shared={shared} /></Box>
            {hasCampaigns && <Box xcss={grid.cell}><CampaignRatios shared={shared} campaigns={featured} /></Box>}
            {hasCampaigns && categories.length > 0 && <Box xcss={grid.cell}><CategoryStageRows shared={shared} categories={categories} /></Box>}
            {hasCampaigns && categories.length > 0 && <Box xcss={cx(grid.cell, grid.full)}><CategoryTrend shared={shared} categories={categories} /></Box>}
          </Box>
        </>
      )}
    </PageShell>
  );
}
