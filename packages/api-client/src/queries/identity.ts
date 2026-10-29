// @usrp/api-client - TanStack Query hook for the citizen's own identity (ADR-049).

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../transport.js';
import { identityKeys } from '../keys.js';
import { getMyIdentity } from '../operations/identity.js';
import type { MyIdentity } from '../wire.js';

export function useMyIdentity(client: ApiClient): UseQueryResult<MyIdentity> {
  return useQuery({ queryKey: identityKeys.mine, queryFn: () => getMyIdentity(client), staleTime: 5 * 60_000, retry: false });
}
