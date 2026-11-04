// ─── Tokens ───────────────────────────────────────────────────────────────────
export { token, agencyTokens, statusLozenge } from "./tokens/usrp-tokens.js";
export type { AgencyTokenSet, LozengeAppearance } from "./tokens/usrp-tokens.js";

// ─── Layout and charts (S13) ─────────────────────────────────────────────────
// The surface layer the officer console lacked: one page column, one card, a
// layout-stable placeholder, and a token-bound chart primitives set. All of it
// is domain-free - it renders numbers and regions, and names no agency.
export { PageShell } from "./layout/PageShell.js";
export { formatCount, formatPercent, asSupportedLanguage } from "./format.js";
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
  seriesTokenAt,
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
