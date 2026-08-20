import React from "react";
import { Box, Stack, Inline } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import PageHeader from "@atlaskit/page-header";
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import {
  createApiClient,
  useDashboardMetrics,
} from "@usrp/api-client";
import { useAuthUser } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import {
  AgencyLogo,
  DashboardMetricCard,
} from "@usrp/ui";
import { BFF_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: BFF_BASE_URL });

// Module-level — xcss prop requires cssMap output, not css().
const pageStyles = cssMap({
  base: {
    maxWidth: "1200px",
    marginInline: "auto",
    paddingBlock: token("space.400"),
    paddingInline: token("space.500"),
  },
});

/**
 * Officer exception-based dashboard.
 *
 * HCI design mandates applied here:
 * 1. F-pattern layout: KPIs that demand immediate action (requiresAction) sit
 *    in the top-left "Primary Optical Area".
 * 2. Gestalt grouping: disqualifying/urgent KPIs are visually clustered together.
 * 3. Alert fatigue mitigation: only 4 focused numbers — no data wall.
 * 4. Positive polarity (light bg / dark text) enforced via ADS CSS reset.
 */
export default function DashboardPage(): React.ReactElement {
  const user = useAuthUser();
  const { t } = useTranslation();
  const { data: metrics, isLoading, isError } = useDashboardMetrics(client);

  if (isLoading) {
    return (
      <Box xcss={pageStyles.base}>
        <Spinner label={t("a11y.loading")} />
      </Box>
    );
  }

  if (isError || metrics === undefined) {
    return (
      <Box xcss={pageStyles.base}>
        <SectionMessage appearance="error" title={t("errors.generic")}>
          {t("errors.generic")}
        </SectionMessage>
      </Box>
    );
  }

  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.500">
        <PageHeader
          {...(user?.agency != null ? {
            breadcrumbs: <AgencyLogo agency={user.agency} size="sm" />,
          } : {})}
        >
          {t("dashboard.title")}
        </PageHeader>

        {/*
         * KPI grid — top row carries the two most action-critical metrics
         * so they land in the F-pattern scan zone.
         */}
        <Inline space="space.300" shouldWrap>
          {/* Primary Optical Area — action-critical, rendered first */}
          <DashboardMetricCard
            label={t("dashboard.requires_action")}
            value={metrics.requiresAction}
            urgent={metrics.requiresAction > 0}
            testId="metric-requires-action"
          />
          <DashboardMetricCard
            label={t("dashboard.pending_review")}
            value={metrics.pendingReview}
            testId="metric-pending-review"
          />
          <DashboardMetricCard
            label={t("dashboard.scheduled_today")}
            value={metrics.scheduledToday}
            testId="metric-scheduled-today"
          />
          <DashboardMetricCard
            label={t("dashboard.accepted_this_week")}
            value={metrics.acceptedThisWeek}
            testId="metric-accepted-week"
          />
        </Inline>

        {metrics.requiresAction === 0 && metrics.pendingReview === 0 && (
          <SectionMessage appearance="success">
            {t("dashboard.no_exceptions")}
          </SectionMessage>
        )}
      </Stack>
    </Box>
  );
}
