// @usrp/api-client - the citizen's own verified identity (ADR-049). The subject is the session.

import type { ApiClient } from '../transport.js';
import type { MyIdentity } from '../wire.js';

export function getMyIdentity(client: ApiClient): Promise<MyIdentity> {
  return client.call<MyIdentity>('getMyIdentity');
}
