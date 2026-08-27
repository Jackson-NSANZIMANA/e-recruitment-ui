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
// THE ROUTE TABLE, as data. tooling/contract-drift diffs this against the
// backend's own `*_PATH` constants and route registrations, so this file is the
// machine-readable half of "the frontend and the backend agree about what
// exists".
//
// 36 business operations + 22 probes = 58 total.

export interface RouteFact {
  readonly service: string;
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly auth: readonly string[];
  readonly reach: string;
  readonly verified: string;
  readonly source: string;
  readonly statuses: readonly string[];
}

export const ROUTE_TABLE: readonly RouteFact[] = [
  {
    "service": "application-service",
    "operationId": "applicationHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "application-service",
    "operationId": "applicationReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (readiness callback)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "application-service",
    "operationId": "listApplications",
    "method": "GET",
    "path": "/v1/applications",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/list-applications.controller.ts (listApplicationsRoute)",
    "statuses": [
      "200",
      "401",
      "403",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "submitApplication",
    "method": "POST",
    "path": "/v1/applications",
    "auth": [
      "system"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/submit-application.controller.ts (SUBMIT_APPLICATION_PATH)",
    "statuses": [
      "201",
      "400",
      "401",
      "403",
      "404",
      "409",
      "422",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "acceptApplication",
    "method": "POST",
    "path": "/v1/applications/accept",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/officer-transitions.controller.ts (ACCEPT_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "adjudicateApplication",
    "method": "POST",
    "path": "/v1/applications/adjudicate",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/officer-transitions.controller.ts (ADJUDICATE_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "listAmberQueue",
    "method": "GET",
    "path": "/v1/applications/amber-queue",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/list-applications.controller.ts (amberQueueRoute)",
    "statuses": [
      "200",
      "401",
      "403",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "listApplicationsByApplicant",
    "method": "GET",
    "path": "/v1/applications/by-applicant",
    "auth": [
      "system"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/list-applications.controller.ts (byApplicantRoute)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "findApplicationById",
    "method": "GET",
    "path": "/v1/applications/by-id",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/list-applications.controller.ts (byIdRoute)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "recordFinalDecision",
    "method": "POST",
    "path": "/v1/applications/final-decision",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/officer-transitions.controller.ts (FINAL_DECISION_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "recordMedicalReview",
    "method": "POST",
    "path": "/v1/applications/medical-review",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/officer-transitions.controller.ts (MEDICAL_REVIEW_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "422",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "getApplicationStatusHistory",
    "method": "GET",
    "path": "/v1/applications/status-history",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/list-applications.controller.ts (statusHistoryRoute)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "500"
    ]
  },
  {
    "service": "application-service",
    "operationId": "registerWalkIn",
    "method": "POST",
    "path": "/v1/applications/walk-in/register",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/walk-in.controller.ts (WALK_IN_REGISTER_PATH)",
    "statuses": [
      "201",
      "400",
      "401",
      "403",
      "404",
      "409",
      "422",
      "500",
      "501"
    ]
  },
  {
    "service": "application-service",
    "operationId": "vetWalkIn",
    "method": "POST",
    "path": "/v1/applications/walk-in/vet",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/walk-in.controller.ts (WALK_IN_VET_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500",
      "501"
    ]
  },
  {
    "service": "application-service",
    "operationId": "withdrawOwnApplication",
    "method": "POST",
    "path": "/v1/applications/withdraw-own",
    "auth": [
      "system"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/self-withdrawal.controller.ts (WITHDRAW_OWN_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500"
    ]
  },
  {
    "service": "audit-service",
    "operationId": "auditHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "audit-service",
    "operationId": "auditReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (readiness callback)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "background-vetting-service",
    "operationId": "vettingHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "background-vetting-service",
    "operationId": "vettingReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (readiness callback)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "biometric-service",
    "operationId": "biometricHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "biometric-service",
    "operationId": "biometricReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (NO readiness callback passed)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "biometric-service",
    "operationId": "verifyBiometric",
    "method": "POST",
    "path": "/v1/biometric/verify",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/verify-biometric.controller.ts (VERIFY_BIOMETRIC_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "422",
      "500",
      "503"
    ]
  },
  {
    "service": "document-forensics-service",
    "operationId": "forensicsHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "document-forensics-service",
    "operationId": "forensicsReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (readiness callback)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "document-forensics-service",
    "operationId": "uploadDocument",
    "method": "POST",
    "path": "/v1/documents/upload",
    "auth": [
      "system"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/upload-document.controller.ts (UPLOAD_DOCUMENT_PATH)",
    "statuses": [
      "201",
      "400",
      "401",
      "403",
      "404",
      "409",
      "413",
      "422",
      "500",
      "503"
    ]
  },
  {
    "service": "document-forensics-service",
    "operationId": "analyzeDocument",
    "method": "POST",
    "path": "/v1/forensics/analyze",
    "auth": [
      "system"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/analyze-document.controller.ts (ANALYZE_DOCUMENT_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "422",
      "500",
      "503"
    ]
  },
  {
    "service": "eligibility-service",
    "operationId": "eligibilityHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "eligibility-service",
    "operationId": "eligibilityReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (readiness callback)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "eligibility-service",
    "operationId": "checkAgeEligibility",
    "method": "POST",
    "path": "/v1/eligibility/age-check",
    "auth": [
      "system"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/eligibility.controller.ts (AGE_CHECK_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500",
      "503"
    ]
  },
  {
    "service": "eligibility-service",
    "operationId": "checkDegreeEligibility",
    "method": "POST",
    "path": "/v1/eligibility/degree-check",
    "auth": [
      "system"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/degree.controller.ts (DEGREE_CHECK_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "422",
      "500",
      "503"
    ]
  },
  {
    "service": "eligibility-service",
    "operationId": "checkEducationEligibility",
    "method": "POST",
    "path": "/v1/eligibility/education-check",
    "auth": [
      "system"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/education.controller.ts (EDUCATION_CHECK_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "422",
      "500",
      "503"
    ]
  },
  {
    "service": "field-sync-service",
    "operationId": "fieldSyncHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "field-sync-service",
    "operationId": "fieldSyncReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (checkDatabaseReadiness)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "field-sync-service",
    "operationId": "resolveFieldConflict",
    "method": "POST",
    "path": "/v1/field-sync/conflicts/resolve",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/resolve-conflict.controller.ts (RESOLVE_CONFLICT_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500"
    ]
  },
  {
    "service": "field-sync-service",
    "operationId": "enrollFieldDevice",
    "method": "POST",
    "path": "/v1/field-sync/devices",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/enroll-device.controller.ts (ENROLL_DEVICE_PATH)",
    "statuses": [
      "200",
      "201",
      "400",
      "401",
      "403",
      "500"
    ]
  },
  {
    "service": "field-sync-service",
    "operationId": "syncFieldScores",
    "method": "POST",
    "path": "/v1/field-sync/scores",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/sync-scores.controller.ts (SYNC_SCORES_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "500"
    ]
  },
  {
    "service": "iam-service",
    "operationId": "iamHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "iam-service",
    "operationId": "iamReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (readiness callback)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "iam-service",
    "operationId": "officerLogin",
    "method": "POST",
    "path": "/v1/auth/officer/login",
    "auth": [
      "none"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/officer-login.controller.ts (OFFICER_LOGIN_PATH)",
    "statuses": [
      "200",
      "400",
      "401"
    ]
  },
  {
    "service": "iam-service",
    "operationId": "issueServiceToken",
    "method": "POST",
    "path": "/v1/auth/service/token",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/service-token.controller.ts (SERVICE_TOKEN_PATH)",
    "statuses": [
      "200",
      "400",
      "401"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "identityHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "identityReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (readiness callback)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "logoutApplicant",
    "method": "POST",
    "path": "/v1/applicants/auth/logout",
    "auth": [
      "applicant-session"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/applicant-auth.controller.ts (LOGOUT_PATH)",
    "statuses": [
      "204",
      "401",
      "500"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "requestApplicantOtp",
    "method": "POST",
    "path": "/v1/applicants/auth/otp/request",
    "auth": [
      "none"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/applicant-auth.controller.ts (OTP_REQUEST_PATH)",
    "statuses": [
      "202",
      "400",
      "500",
      "502",
      "503"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "verifyApplicantOtp",
    "method": "POST",
    "path": "/v1/applicants/auth/otp/verify",
    "auth": [
      "none"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/applicant-auth.controller.ts (OTP_VERIFY_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "500",
      "502",
      "503"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "listMyApplications",
    "method": "GET",
    "path": "/v1/applicants/me/applications",
    "auth": [
      "applicant-session"
    ],
    "reach": "browser",
    "verified": "proxy-derived",
    "source": "src/adapters/http/applicant-auth.controller.ts (ME_APPLICATIONS_PATH)",
    "statuses": [
      "200",
      "401",
      "500",
      "502"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "withdrawMyApplication",
    "method": "POST",
    "path": "/v1/applicants/me/applications/withdraw",
    "auth": [
      "applicant-session"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/applicant-auth.controller.ts (ME_WITHDRAW_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "404",
      "409",
      "500",
      "502"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "getMyErasureRequest",
    "method": "GET",
    "path": "/v1/applicants/me/erasure-request",
    "auth": [
      "applicant-session"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/erasure-request.controller.ts (ME_ERASURE_REQUEST_PATH)",
    "statuses": [
      "200",
      "401",
      "404",
      "500"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "fileMyErasureRequest",
    "method": "POST",
    "path": "/v1/applicants/me/erasure-request",
    "auth": [
      "applicant-session"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/erasure-request.controller.ts (ME_ERASURE_REQUEST_PATH)",
    "statuses": [
      "202",
      "401",
      "500"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "eraseIdentity",
    "method": "POST",
    "path": "/v1/identities/erasure",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/erasure.controller.ts (ERASURE_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "listErasureRequests",
    "method": "GET",
    "path": "/v1/identities/erasure-requests",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/erasure-request.controller.ts (ERASURE_REQUESTS_QUEUE_PATH)",
    "statuses": [
      "200",
      "401",
      "403",
      "500"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "declineErasureRequest",
    "method": "POST",
    "path": "/v1/identities/erasure-requests/decline",
    "auth": [
      "officer"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/erasure-request.controller.ts (ERASURE_REQUEST_DECLINE_PATH)",
    "statuses": [
      "200",
      "400",
      "401",
      "403",
      "404",
      "409",
      "500"
    ]
  },
  {
    "service": "identity-service",
    "operationId": "verifyIdentity",
    "method": "POST",
    "path": "/v1/identities/verify",
    "auth": [
      "system",
      "officer"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/adapters/http/verify-identity.controller.ts (VERIFY_IDENTITY_PATH)",
    "statuses": [
      "200",
      "201",
      "400",
      "401",
      "403",
      "404",
      "422",
      "500",
      "503"
    ]
  },
  {
    "service": "notification-service",
    "operationId": "notificationHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "notification-service",
    "operationId": "notificationReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (readiness callback)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "scheduling-service",
    "operationId": "schedulingHealth",
    "method": "GET",
    "path": "/health",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "@usrp/shared-http (reserved probe)",
    "statuses": [
      "200"
    ]
  },
  {
    "service": "scheduling-service",
    "operationId": "schedulingReady",
    "method": "GET",
    "path": "/ready",
    "auth": [
      "none"
    ],
    "reach": "service-internal",
    "verified": "controller-verbatim",
    "source": "src/main.ts (readiness callback)",
    "statuses": [
      "200",
      "503"
    ]
  },
  {
    "service": "scheduling-service",
    "operationId": "getSlotInvitationKey",
    "method": "GET",
    "path": "/v1/slots/invitation-key",
    "auth": [
      "none"
    ],
    "reach": "browser",
    "verified": "controller-verbatim",
    "source": "src/main.ts (inline route, startHttpServer routes[0])",
    "statuses": [
      "200"
    ]
  }
] as const;

/** Everything a browser may legitimately reach. */
export const BROWSER_ROUTES: readonly RouteFact[] = ROUTE_TABLE.filter(
  (route) => route.reach === 'browser',
);

/**
 * System-token routes. PROXYING ONE OF THESE TO A BROWSER IS A SECURITY
 * INCIDENT, not a convenience — that is why the set is exported as data an
 * edge-tier check can assert against instead of a comment reviewers must
 * remember.
 */
export const SERVICE_INTERNAL_ROUTES: readonly RouteFact[] = ROUTE_TABLE.filter(
  (route) => route.reach === 'service-internal',
);
