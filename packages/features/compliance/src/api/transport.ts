// ═══════════════════════════════════════════════════════════════
// compliance — transport
//
// Three of five real. The two inventions are both OFFICER-side, and their absence
// is the more interesting fact: the CITIZEN can file and read an erasure request
// (ADR-015) and withdraw an application (ADR-020) today, but the DPO who has to
// ACT on those requests has no queue to work and no way to record a decision.
//
// So the citizen half of Law N° 058/2021 is reachable and the institutional half
// is not. That is worth stating in a commit rather than papering over with a
// table fed by a mock.
// ═══════════════════════════════════════════════════════════════

import type { ApiClient, CallOptions, EdgeOperationId } from '@usrp/api-client';

export type { ApiClient, CallOptions };

export const COMPLIANCE_OPERATIONS = [
  'getMyErasureRequest',
  'fileMyErasureRequest',
  'withdrawMyApplication',
] as const satisfies readonly EdgeOperationId[];

export type ComplianceOperation = (typeof COMPLIANCE_OPERATIONS)[number];

/**
 * The officer/DPO side, which has no edge operation.
 *
 * TYPED `readonly string[]` ON PURPOSE — these are not EdgeOperationIds.
 */
export const COMPLIANCE_UNSERVED_BY_EDGE: readonly string[] = [
  // No route lists erasure requests for a Data Protection Officer.
  'listErasureRequests',
  // ADR-015 requires MANDATORY written grounds on a decline. There is nowhere to
  // record them, so the dialog that collects them has nothing to submit to.
  'declineErasureRequest',
];

/**
 * Erasure is a SOFT DELETE, and the UI must never say "deleted".
 *
 * Law N° 058/2021 erasure is the `deleted_at` path: no application role holds
 * `DELETE` on any table, and the audit trail is trigger-enforced append-only.
 * Filing also answers 202 — FILED, NOT ACTIONED — so a confirmation that claims
 * the data is gone is false twice over.
 */
export const ERASURE_IS_SOFT_DELETE = true;
