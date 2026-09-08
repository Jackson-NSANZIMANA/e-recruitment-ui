// ══════════════════════════════════════════════════════════════════
// @usrp/api-client — TanStack Query hooks for the applicant portal
//
// WHAT IS DELETED AND WHY IT MATTERS MORE THAN WHAT IS HERE:
//
//   useDashboardMetrics  — `GET /dashboard/metrics`. No service serves it, and
//                          `OfficerDashboardMetrics` describes a projection
//                          nothing computes. The console's headline
//                          exception-based dashboard has NO data source.
//   useNidaVerification  — `POST /identity/verify-nida` returning
//                          `{verified, displayName, dateOfBirth, gender}`. The
//                          real route is `POST /v1/identities/verify`, it is
//                          system/officer-authenticated so a citizen cannot call
//                          it at all, and it returns ONLY `{status, applicantId}`.
//                          No name, no DOB, no gender — the raw NID is
//                          request-only and NIDA PII is rejected by the
//                          contract's negative fixtures. So the "ask only for the
//                          NID and pre-fill the applicant's name" requirement is
//                          UNIMPLEMENTABLE against today's backend.
//   useSession           — `GET /auth/session`. Replaced by the edge's
//                          `GET /edge/v1/session`, which lives in `@usrp/auth`
//                          because it bootstraps before any QueryClient mounts.
//   refreshDashboard     — invalidated a cache with no endpoint behind it.
//
// They are removed rather than left pointing at nothing, because a hook that
// type-checks and 404s is worse than no hook: it looks finished.
// ══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { applicantKeys, INVALIDATION_MAP, resolveInvalidation } from '../keys.js';
import {
  fileMyErasureRequest,
  getMyErasureRequest,
  listMyApplications,
  withdrawMyApplication,
} from '../operations/applicant.js';
import type { MyApplicationsResponse, WithdrawResponse } from '../wire.js';

/**
 * The citizen's own applications, across all three agencies.
 *
 * No agency key: a citizen is cross-agency by construction (ADR-014's accept lock
 * spans all three; this read unions all three ops schemas).
 */
export function useMyApplications(client: ApiClient): UseQueryResult<MyApplicationsResponse> {
  return useQuery({
    queryKey: applicantKeys.myApplications(),
    queryFn: () => listMyApplications(client),
    staleTime: 30_000,
  });
}

export function useWithdrawMyApplication(client: ApiClient): UseMutationResult<WithdrawResponse, Error, { applicationId: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId }: { applicationId: string }) => withdrawMyApplication(client, applicationId),
    onSuccess: () => {
      for (const key of resolveInvalidation(INVALIDATION_MAP['withdrawMyApplication'] ?? [], {})) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** A 404 is a NORMAL state here: "no erasure request on file". Not an error UI. */
export function useMyErasureRequest(client: ApiClient): UseQueryResult<Readonly<Record<string, unknown>>> {
  return useQuery({
    queryKey: applicantKeys.myErasureRequest(),
    queryFn: () => getMyErasureRequest(client),
    retry: false,
    staleTime: 60_000,
  });
}

export function useFileErasureRequest(client: ApiClient): UseMutationResult<Readonly<Record<string, unknown>>, Error, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fileMyErasureRequest(client),
    onSuccess: () => {
      for (const key of resolveInvalidation(INVALIDATION_MAP['fileMyErasureRequest'] ?? [], {})) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
