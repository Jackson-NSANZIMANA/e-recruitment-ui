// ═══════════════════════════════════════════════════════════════
// applications — transport
//
// The phantom `SliceTransport` is gone. It also carried
// `getApplicationStatusHistory`, which is the UPSTREAM operation id; the edge
// serves it as `getStatusHistory`. One character of difference between a working
// screen and a thrown `Unknown edge operation`, and `operationId: string` made
// them identical to the compiler.
// ═══════════════════════════════════════════════════════════════

import type { ApiClient, CallOptions, EdgeOperationId } from '@usrp/api-client';

export type { ApiClient, CallOptions };

export const APPLICATIONS_OPERATIONS = [
  'listApplications',
  'findApplicationById',
  'getApplicationDetail',
  'getStatusHistory',
  'listMyApplications',
  'withdrawMyApplication',
] as const satisfies readonly EdgeOperationId[];

export type ApplicationsOperation = (typeof APPLICATIONS_OPERATIONS)[number];

/**
 * NOTHING IN THIS PLATFORM PAGINATES.
 *
 * `GET /v1/applications` takes no query parameters and returns the officer's
 * whole RLS-scoped set; the contract's negative fixtures reject a pagination
 * envelope outright. Recorded as a constant because "add page and pageSize" is
 * the first thing every reviewer asks for, and the old client shipped both as
 * furniture that silently did nothing.
 */
export const SUPPORTS_PAGINATION = false;
