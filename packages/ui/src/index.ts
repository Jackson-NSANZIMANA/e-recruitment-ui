// ─── Tokens ───────────────────────────────────────────────────────────────────
export { token, agencyTokens, statusLozenge } from "./tokens/usrp-tokens.js";
export type { AgencyTokenSet, LozengeAppearance } from "./tokens/usrp-tokens.js";

// ─── Components ───────────────────────────────────────────────────────────────
export { ApplicationStatusBadge } from "./components/ApplicationStatusBadge/index.js";
export { DashboardMetricCard } from "./components/DashboardMetricCard/index.js";
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
