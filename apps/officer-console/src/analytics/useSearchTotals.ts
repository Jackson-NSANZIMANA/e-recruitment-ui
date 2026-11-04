import { useQueries } from "@tanstack/react-query";
import { searchApplications, searchKeys, type ApiClient, type ApplicationSearchQuery } from "@usrp/api-client";

export interface SearchTotals {
  /** The exact `total` of each query, in query order; 0 until it has answered (see `ready`). */
  readonly totals: readonly number[];
  /** Every query has answered. A widget draws its chart only when this is true: a half-loaded matrix is a lie. */
  readonly ready: boolean;
  readonly failed: boolean;
  readonly refetch: () => void;
  /** The newest answer's time (ms), 0 when none yet. */
  readonly updatedAt: number;
}

/**
 * The exact counts for a list of searches, one `limit: 1` request each.
 *
 * Counts, not rows: an agency's register can hold hundreds of thousands of
 * applications and no screen should download them to count them. The cache key is
 * the shared `searchKeys.query`, so two widgets that ask the same question (the
 * dashboard's stage bars and the analytics matrix) are one request.
 */
export function useSearchTotals(client: ApiClient, queries: readonly ApplicationSearchQuery[], enabled: boolean): SearchTotals {
  const results = useQueries({
    queries: queries.map((q) => ({
      queryKey: searchKeys.query(q),
      queryFn: () => searchApplications(client, q),
      enabled,
      retry: false,
      staleTime: 60_000,
    })),
  });
  return {
    totals: results.map((r) => r.data?.total ?? 0),
    ready: enabled && results.length > 0 && results.every((r) => r.isSuccess),
    failed: results.some((r) => r.isError),
    refetch: () => { for (const r of results) void r.refetch(); },
    updatedAt: Math.max(0, ...results.map((r) => r.dataUpdatedAt)),
  };
}
