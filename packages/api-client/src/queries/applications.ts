import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import type {
  Application,
  ApplicationListItem,
  ApplicationStatus,
  PaginatedResult,
} from "@usrp/shared-types";
import type { ApiClient } from "../client.js";

// ─── Query-key factory ────────────────────────────────────────────────────────

export const applicationKeys = {
  all: ["applications"] as const,
  lists: () => [...applicationKeys.all, "list"] as const,
  list: (filters: ApplicationListFilters) =>
    [...applicationKeys.lists(), filters] as const,
  details: () => [...applicationKeys.all, "detail"] as const,
  detail: (id: string) => [...applicationKeys.details(), id] as const,
};

// ─── List query ───────────────────────────────────────────────────────────────

export interface ApplicationListFilters {
  readonly status?: ApplicationStatus;
  readonly requiresAction?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
}

export function useApplicationList(
  client: ApiClient,
  filters: ApplicationListFilters = {},
): UseQueryResult<PaginatedResult<ApplicationListItem>> {
  const params = new URLSearchParams();
  if (filters.status !== undefined) params.set("status", filters.status);
  if (filters.requiresAction === true) params.set("requiresAction", "true");
  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.pageSize !== undefined)
    params.set("pageSize", String(filters.pageSize));
  if (filters.search !== undefined) params.set("search", filters.search);

  const qs = params.toString();
  return useQuery({
    queryKey: applicationKeys.list(filters),
    queryFn: () =>
      client.get<PaginatedResult<ApplicationListItem>>(
        `/applications${qs ? `?${qs}` : ""}`,
      ),
    staleTime: 30_000,
  });
}

// ─── Detail query ─────────────────────────────────────────────────────────────

export function useApplication(
  client: ApiClient,
  id: string,
): UseQueryResult<Application> {
  return useQuery({
    queryKey: applicationKeys.detail(id),
    queryFn: () => client.get<Application>(`/applications/${id}`),
    staleTime: 10_000,
  });
}

// ─── Status transition mutation ───────────────────────────────────────────────

interface TransitionInput {
  readonly applicationId: string;
  readonly toStatus: ApplicationStatus;
  readonly note?: string;
}

export function useTransitionApplication(
  client: ApiClient,
): UseMutationResult<Application, Error, TransitionInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, toStatus, note }: TransitionInput) =>
      client.patch<Application>(`/applications/${applicationId}/status`, {
        toStatus,
        note,
      }),
    onSuccess: (updated) => {
      // Invalidate list queries and update the detail cache directly.
      void qc.invalidateQueries({ queryKey: applicationKeys.lists() });
      qc.setQueryData(applicationKeys.detail(updated.id), updated);
    },
  });
}

// ─── Walk-in mutation ─────────────────────────────────────────────────────────

interface WalkInInput {
  readonly nationalIdHash: string;
  readonly postCode: string;
}

export function useWalkIn(
  client: ApiClient,
): UseMutationResult<Application, Error, WalkInInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WalkInInput) =>
      client.post<Application>("/applications/walk-in", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: applicationKeys.lists() });
    },
  });
}
