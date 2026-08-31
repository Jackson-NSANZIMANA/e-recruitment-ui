// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — officer operations
//
// `useTransitionApplication` IS GONE. It sent
// `PATCH /applications/${id}/status` with `{ toStatus }`, and every part of that
// was fiction: no PATCH route exists anywhere in the platform, the path was
// templated (unroutable by `shared-http`), and no endpoint accepts a target
// status. The real surface is FOUR distinct POST routes, each with its own body
// and its own outcome set.
//
// Four, not three. `accept` is ADR-014's cross-agency lock — the write that
// enforces one citizen, one acceptance across RDF, RNP and RCS. Omitting it
// leaves the console unable to complete a recruitment, and the first person who
// needs it will hand-roll a `fetch`, putting the most safety-critical write in
// the platform outside the typed layer.
//
// Each operation gets its OWN narrowed error union, deliberately STRICTER than
// the HTTP layer. The backend's `runTransition` funnels all four commands through
// one `mapOutcome`, so at the type level every route can emit
// `422 INVALID_MEDICAL_INPUT` and `409 CROSS_AGENCY_LOCKED`. Mirroring that here
// would grow a cross-agency-lock branch in the medical UI and an
// invalid-medical-input branch in the accept UI — dead code indistinguishable
// from live code. So we narrow per route and report the divergence upward.
// ══════════════════════════════════════════════════════════════════

import type { ApiClient } from '../transport.js';
import type {
  AcceptInput,
  AdjudicateInput,
  AmberQueueResponse,
  ApplicationByIdResponse,
  ApplicationDetailResponse,
  ApplicationListResponse,
  FinalDecisionInput,
  IdentityVerifyResponse,
  MedicalReviewInput,
  StatusHistoryResponse,
  TransitionResult,
  WalkInRegisterInput,
  WalkInRegisterResponse,
  WalkInVetResponse,
} from '../wire.js';

// ── Reads ───────────────────────────────────────────────────────

export function listApplications(client: ApiClient, correlationId?: string): Promise<ApplicationListResponse> {
  return client.call<ApplicationListResponse>('listApplications', correlationId === undefined ? {} : { correlationId });
}

export function listAmberQueue(client: ApiClient, correlationId?: string): Promise<AmberQueueResponse> {
  return client.call<AmberQueueResponse>('listAmberQueue', correlationId === undefined ? {} : { correlationId });
}

/** The id travels as a QUERY PARAM, never a path segment (ADR-005). */
export function findApplicationById(client: ApiClient, applicationId: string, correlationId?: string): Promise<ApplicationByIdResponse> {
  return client.call<ApplicationByIdResponse>('findApplicationById', {
    query: { applicationId },
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

export function getStatusHistory(client: ApiClient, applicationId: string, correlationId?: string): Promise<StatusHistoryResponse> {
  return client.call<StatusHistoryResponse>('getStatusHistory', {
    query: { applicationId },
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

/** One round trip for the detail screen. Degrades per panel rather than failing whole. */
export function getApplicationDetail(client: ApiClient, applicationId: string, correlationId?: string): Promise<ApplicationDetailResponse> {
  return client.call<ApplicationDetailResponse>('getApplicationDetail', {
    query: { applicationId },
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

// ── The four transitions ────────────────────────────────────────

/**
 * Medical review (ADR-013).
 *
 * The input union enforces the agency mode at compile time: RDF sends
 * `fitnessStatus`, RNP/RCS send `certVerdict`, and `CERT_VERIFIED` requires the
 * signing physician. Sending the wrong shape is a 422 `INVALID_MEDICAL_INPUT`
 * at runtime; the union makes the common half of that mistake unwriteable.
 *
 * Narrowed errors: 404, 409 NOT_APPLICABLE, 422 INVALID_MEDICAL_INPUT, 403.
 * NOT 409 CROSS_AGENCY_LOCKED — unreachable on this route.
 */
export function recordMedicalReview(client: ApiClient, input: MedicalReviewInput, correlationId?: string): Promise<TransitionResult> {
  return client.call<TransitionResult>('recordMedicalReview', { body: input, ...(correlationId === undefined ? {} : { correlationId }) });
}

/** Final decision. Narrowed errors: 404, 409 NOT_APPLICABLE, 403. */
export function recordFinalDecision(client: ApiClient, input: FinalDecisionInput, correlationId?: string): Promise<TransitionResult> {
  return client.call<TransitionResult>('recordFinalDecision', { body: input, ...(correlationId === undefined ? {} : { correlationId }) });
}

/**
 * Accept (ADR-014). The one route that can answer 409 `CROSS_AGENCY_LOCKED`.
 *
 * The 409 carries `lockedByAgency` and the UI must show it: "this candidate has
 * already been accepted by RNP" is actionable, while a bare conflict leaves an
 * officer clicking a button that will never work.
 *
 * Also triggers ADR-017 auto-withdrawal of the citizen's other applications,
 * which is why the invalidation map reaches into the citizen caches.
 */
export function acceptApplication(client: ApiClient, input: AcceptInput, correlationId?: string): Promise<TransitionResult> {
  return client.call<TransitionResult>('acceptApplication', { body: input, ...(correlationId === undefined ? {} : { correlationId }) });
}

/** Adjudicate (ADR-011). How a row leaves the amber queue. Narrowed: 404, 409, 403. */
export function adjudicateApplication(client: ApiClient, input: AdjudicateInput, correlationId?: string): Promise<TransitionResult> {
  return client.call<TransitionResult>('adjudicateApplication', { body: input, ...(correlationId === undefined ? {} : { correlationId }) });
}

// ── Walk-in: TWO steps, and no nationalIdHash ───────────────────

/**
 * Walk-in step ONE (ADR-012).
 *
 * The old `useWalkIn` was a single call taking `{ nationalIdHash, postCode }`.
 * Three defects in one signature: the flow is two steps, `postCode` exists
 * nowhere in the platform, and `nationalIdHash` is an internal cross-service key
 * a browser must never hold. The real input is the opaque `applicantId` that
 * `verifyIdentity` returns — so the officer's real sequence is three calls, and
 * that is what the API now shapes.
 */
export function registerWalkIn(client: ApiClient, input: WalkInRegisterInput, correlationId?: string): Promise<WalkInRegisterResponse> {
  return client.call<WalkInRegisterResponse>('registerWalkIn', { body: input, ...(correlationId === undefined ? {} : { correlationId }) });
}

/**
 * Walk-in step TWO.
 *
 * `409 AGE_PENDING` is expected and is the OFFICER's retry, not the client's: the
 * autonomous age verdict lands in seconds while the candidate stands at the desk.
 * A silent client retry would hide a state the officer needs to see.
 */
export function vetWalkIn(client: ApiClient, applicationId: string, correlationId?: string): Promise<WalkInVetResponse> {
  return client.call<WalkInVetResponse>('vetWalkIn', { body: { applicationId }, ...(correlationId === undefined ? {} : { correlationId }) });
}

/**
 * Officer-driven NIDA verification, step ZERO of the walk-in flow.
 *
 * Returns `applicantId` and a status. It does NOT return a name — see `wire.ts`.
 */
export function verifyIdentity(
  client: ApiClient,
  nationalId: string,
  channel: string = 'WALK_IN',
  correlationId?: string,
): Promise<IdentityVerifyResponse> {
  return client.call<IdentityVerifyResponse>('verifyIdentity', {
    body: { nationalId, channel },
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}
