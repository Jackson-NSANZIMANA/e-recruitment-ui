// ══════════════════════════════════════════════════════════════════
// CONTRACT-PENDING: S06 — operations whose backend contract has not merged.
//
// `releaseOfficerActivation` is served by backend PR #45 (fix/s06-four-eyes-
// activation, ADR-036 Addendum A). Until that merges and EDGE_BACKEND_SHA is
// re-pinned past it, the contract-drift gate cannot know it, so it lives here
// and NOT in EDGE_OPERATIONS. `operation()` resolves it from here so the same
// transport rules (CSRF, no retry, one origin) apply.
//
// WHEN #45 MERGES: move the row into EDGE_OPERATIONS (paths.ts), add the
// `officerReleaseActivation` upstream to openapi/iam-service.yaml, re-pin, run
// contract drift, delete this file. test/pending.test.ts fails if a pending id
// is also in EDGE_OPERATIONS, so the move cannot be half-done.
// ══════════════════════════════════════════════════════════════════

import type { EdgeOperation } from './paths.js';

export const PENDING_EDGE_OPERATIONS = [
  { id: 'releaseOfficerActivation', method: 'POST', edgePath: '/edge/v1/officers/activation/release', upstreamOperationId: null, session: 'officer', retryOnG2G: false, composition: 'single' },
] as const satisfies readonly EdgeOperation[];

export type PendingEdgeOperationId = (typeof PENDING_EDGE_OPERATIONS)[number]['id'];
