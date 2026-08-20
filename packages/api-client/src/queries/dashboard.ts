import {
  useQuery,
  useMutation,
  type QueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { OfficerDashboardMetrics } from "@usrp/shared-types";
import type { ApiClient } from "../client.js";

// ─── Dashboard metrics ────────────────────────────────────────────────────────

export const dashboardKeys = {
  metrics: () => ["dashboard", "metrics"] as const,
};

export function useDashboardMetrics(
  client: ApiClient,
): UseQueryResult<OfficerDashboardMetrics> {
  return useQuery({
    queryKey: dashboardKeys.metrics(),
    queryFn: () => client.get<OfficerDashboardMetrics>("/dashboard/metrics"),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

// ─── Identity / NIDA lookup ───────────────────────────────────────────────────

interface NidaLookupResult {
  readonly verified: boolean;
  readonly displayName: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: "MALE" | "FEMALE" | "OTHER" | null;
}

export function useNidaVerification(
  client: ApiClient,
): UseMutationResult<NidaLookupResult, Error, { nationalId: string }> {
  return useMutation({
    mutationFn: ({ nationalId }: { nationalId: string }) =>
      client.post<NidaLookupResult>("/identity/verify-nida", { nationalId }),
  });
}

// ─── Auth (me endpoint — used by AuthProvider via raw fetch, not here) ────────
// The /auth/me and /auth/login calls live in @usrp/auth because they bootstrap
// the auth state before any QueryClient is mounted.  Queries that depend on the
// authenticated user's identity live here.

interface SessionInfo {
  readonly expiresAt: string;
}

export const sessionKeys = {
  session: () => ["session"] as const,
};

export function useSession(
  client: ApiClient,
): UseQueryResult<SessionInfo> {
  return useQuery({
    queryKey: sessionKeys.session(),
    queryFn: () => client.get<SessionInfo>("/auth/session"),
    staleTime: 300_000,
  });
}

// ─── Officer dashboard refresh ────────────────────────────────────────────────
// Plain function — not a hook. Cache invalidation is not a server mutation;
// wrapping it in useMutation was architecturally incorrect.

export function refreshDashboard(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: dashboardKeys.metrics() });
}
