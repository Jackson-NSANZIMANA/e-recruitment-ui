// ═══════════════════════════════════════════════════════════════
// applications — reads over the real edge operations
//
// One correction that mattered: `getApplicationStatusHistory` is the upstream id.
// The edge answers to `getStatusHistory`. Fixed, and now unfixable-again because
// APPLICATIONS_OPERATIONS is checked against EdgeOperationId.
// ═══════════════════════════════════════════════════════════════

import type { Agency, ApplicationStatus } from '@usrp/contracts';
import type { ApiClient, CallOptions } from './transport.ts';

export interface ApplicationSummary {
  readonly applicationId: string;
  readonly processingCode: string;
  readonly category: string;
  readonly status: ApplicationStatus;
  readonly submittedAt: string | null;
}

export interface ListApplicationsOk {
  readonly agency: Agency;
  readonly applications: readonly ApplicationSummary[];
}

/**
 * One append-only transition (rls/0007), oldest first.
 *
 * `actor` is nullable because a SYSTEM transition has no officer. Collapsing
 * "the system did it" into "an unknown officer did it" is precisely the
 * Procedural Justice failure this trail exists to prevent.
 */
export interface StatusHistoryEntry {
  readonly entryId: string;
  readonly fromStatus: ApplicationStatus | null;
  readonly toStatus: ApplicationStatus;
  readonly note: string | null;
  readonly actor: string | null;
  readonly actorKind: 'SYSTEM' | 'OFFICER';
  readonly at: string;
  readonly correlationId: string | null;
}

export interface StatusHistoryOk {
  readonly agency: Agency;
  readonly applicationId: string;
  readonly history: readonly StatusHistoryEntry[];
}

/** Officer list. No arguments: the server scopes by RLS under the officer's role. */
export const listApplications = (client: ApiClient, options?: CallOptions): Promise<ListApplicationsOk> =>
  client.call<ListApplicationsOk>('listApplications', options);

/** Single-record read by QUERY parameter — the exact-path matcher has no path params. */
export const findApplicationById = (client: ApiClient, applicationId: string): Promise<unknown> =>
  client.call<unknown>('findApplicationById', { query: { applicationId } });

/**
 * OFFICER-ONLY, and that is this platform's own Procedural Justice surface being
 * closed to the one person with an interest in it.
 *
 * There is no citizen-readable transition trail today. A portal screen must not
 * imply one exists, and must not promise an SMS explaining a rejection that we
 * cannot confirm was sent.
 */
export const getStatusHistory = (client: ApiClient, applicationId: string): Promise<StatusHistoryOk> =>
  client.call<StatusHistoryOk>('getStatusHistory', { query: { applicationId } });

/**
 * The citizen's own rows, across all three agencies.
 *
 * No agency argument: a citizen is cross-agency by construction, because
 * ADR-014's accept lock spans all three ops schemas.
 */
export const listMyApplications = (client: ApiClient): Promise<unknown> =>
  client.call<unknown>('listMyApplications');
