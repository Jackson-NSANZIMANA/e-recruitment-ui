// ╔══════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT BY HAND.                       ║
// ║                                                              ║
// ║  Source:   openapi/*.yaml                                    ║
// ║  Producer: pnpm --filter @usrp/contracts generate             ║
// ║  Backend:  47d9ad3ab019f6d2f826cfae2136cbff898d733f          ║
// ║                                                              ║
// ║  Edits here are erased on the next generate, and `verify`     ║
// ║  fails on any diff between committed and regenerated output,  ║
// ║  so a hand edit is a red build rather than a silent           ║
// ║  divergence. Change openapi/*.yaml instead.                  ║
// ╚══════════════════════════════════════════════════════════════╝

//
// NAMESPACED ON PURPOSE. Eleven services independently name a schema `Uuid`,
// and six of them name one `Forbidden403` — with THREE genuinely different
// shapes behind that name across the platform. A flat barrel would have to pick
// a winner and would silently hand callers the wrong 403. Namespaces make the
// service you are talking to part of the type you import.

export * as applicationService from './application-service.zod.js';
export type * as applicationServiceTypes from './application-service.types.js';
export * as auditService from './audit-service.zod.js';
export type * as auditServiceTypes from './audit-service.types.js';
export * as backgroundVettingService from './background-vetting-service.zod.js';
export type * as backgroundVettingServiceTypes from './background-vetting-service.types.js';
export * as biometricService from './biometric-service.zod.js';
export type * as biometricServiceTypes from './biometric-service.types.js';
export * as documentForensicsService from './document-forensics-service.zod.js';
export type * as documentForensicsServiceTypes from './document-forensics-service.types.js';
export * as eligibilityService from './eligibility-service.zod.js';
export type * as eligibilityServiceTypes from './eligibility-service.types.js';
export * as fieldSyncService from './field-sync-service.zod.js';
export type * as fieldSyncServiceTypes from './field-sync-service.types.js';
export * as iamService from './iam-service.zod.js';
export type * as iamServiceTypes from './iam-service.types.js';
export * as identityService from './identity-service.zod.js';
export type * as identityServiceTypes from './identity-service.types.js';
export * as notificationService from './notification-service.zod.js';
export type * as notificationServiceTypes from './notification-service.types.js';
export * as schedulingService from './scheduling-service.zod.js';
export type * as schedulingServiceTypes from './scheduling-service.types.js';
export { ROUTE_TABLE, BROWSER_ROUTES, SERVICE_INTERNAL_ROUTES } from './routes.js';
export type { RouteFact } from './routes.js';
