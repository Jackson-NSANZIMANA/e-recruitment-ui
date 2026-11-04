// ─── Tokens ───────────────────────────────────────────────────────────────────
export { token, agencyTokens, statusLozenge } from "./tokens/usrp-tokens.js";
export type { AgencyTokenSet, LozengeAppearance } from "./tokens/usrp-tokens.js";

// ─── Layout and charts (S13) ─────────────────────────────────────────────────
// The surface layer the officer console lacked: one page column, one card, a
// layout-stable placeholder, and a token-bound chart primitives set. All of it
// is domain-free - it renders numbers and regions, and names no agency.
export { PageShell } from "./layout/PageShell.js";
export { formatCount, formatPercent, formatShare, asSupportedLanguage } from "./format.js";
export { known, PENDING, FAILED, countFrom, valueOf } from "./states/useCount.js";
export type { Count, CountQueryLike } from "./states/useCount.js";
export type { PageShellProps } from "./layout/PageShell.js";
export { Card } from "./layout/Card.js";
export type { CardProps, CardTone } from "./layout/Card.js";
export { SkeletonPanel } from "./layout/SkeletonPanel.js";
export type { SkeletonPanelProps, SkeletonShape } from "./layout/SkeletonPanel.js";
export { Sparkline } from "./charts/Sparkline.js";
export type { SparklineProps, SparklineDatum } from "./charts/Sparkline.js";
export { StackedBar } from "./charts/StackedBar.js";
export type { StackedBarProps, StackedBarSegment } from "./charts/StackedBar.js";
export { BarChart } from "./charts/BarChart.js";
export type { BarChartItem, BarChartProps, BarTone } from "./charts/BarChart.js";
export { TrendChart } from "./charts/TrendChart.js";
export type { TrendChartDatum, TrendChartProps } from "./charts/TrendChart.js";
export { RingGauge } from "./charts/RingGauge.js";
export type { RingGaugeProps, GaugeTone } from "./charts/RingGauge.js";
export { StackedColumnChart } from "./charts/StackedColumnChart.js";
export type { StackedColumnChartProps, ColumnCategory, ColumnSeries } from "./charts/StackedColumnChart.js";
export { SeriesChart } from "./charts/SeriesChart.js";
export type { SeriesChartProps, SeriesChartSeries } from "./charts/SeriesChart.js";
export { HeroMetric } from "./charts/HeroMetric.js";
export type { HeroMetricProps } from "./charts/HeroMetric.js";
export { Heatmap } from "./charts/Heatmap.js";
export type { HeatmapProps } from "./charts/Heatmap.js";
export { StatGrid } from "./charts/StatGrid.js";
export type { StatGridItem, StatTone } from "./charts/StatGrid.js";
export { FigureTable } from "./charts/FigureTable.js";
export type { FigureTableProps, FigureTableColumn, FigureTableRow } from "./charts/FigureTable.js";
export { StackedRows } from "./charts/StackedRows.js";
export type { StackedRowsProps } from "./charts/StackedRows.js";
export { Widget } from "./layout/Widget.js";
export type { WidgetProps } from "./layout/Widget.js";
export { FilterChip } from "./layout/FilterChip.js";
export type { FilterChipProps, FilterChipOption } from "./layout/FilterChip.js";
export { MetricCard } from "./charts/MetricCard.js";
export type { MetricCardProps } from "./charts/MetricCard.js";
export {
  PAGE_MAX_WIDTH,
  CHART_SERIES_TOKENS,
  sparklinePoints,
  sparklinePath,
  sparklineIsDot,
  trendOf,
  trendTone,
  stackShares,
  seriesIndexAt,
} from "./model.js";
export type { PageAlign, TrendDirection } from "./model.js";

// ─── Components ───────────────────────────────────────────────────────────────
export { ApplicationStatusBadge } from "./components/ApplicationStatusBadge/index.js";
export { WizardLayout } from "./components/WizardLayout/index.js";
export { AudioTooltip } from "./components/AudioTooltip/index.js";
export { OfflineIndicator } from "./components/OfflineIndicator/index.js";
export { AgencyLogo } from "./components/AgencyLogo/index.js";
export { BiometricConsent } from "./components/BiometricConsent/index.js";
export { QrScanner } from "./components/QrScanner/index.js";
export { DocumentUpload } from "./components/DocumentUpload/index.js";
export { RouterLink } from "./components/RouterLink/index.js";
export { ErrorBoundary } from "./components/ErrorBoundary/index.js";

// ─── Readiness ladder (ADR-FE-009) ─────────────────────────────────────────────
export {
  READINESS_RUNGS,
  PRODUCTION_FLOOR,
  isReadinessRung,
  rungAtLeast,
  normaliseRoutePath,
  joinRoutePath,
  readinessIndex,
  mountDecision,
  mountByReadiness,
  NotBuiltBanner,
  NotFoundPage,
} from "./readiness/index.js";
export type {
  ReadinessRung,
  SurfaceApp,
  RouteReadiness,
  MountDecision,
  MountByReadinessOptions,
  NotBuiltBannerProps,
} from "./readiness/index.js";
export { ConnectionStatus } from "./components/ConnectionStatus/index.js";

// ─── State patterns (S06) ──────────────────────────────────────────────────────
export * from "./states/index.js";

// ─── National identity layer (ADR-FE-020) ──────────────────────────────────────
export * from "./national/index.js";
