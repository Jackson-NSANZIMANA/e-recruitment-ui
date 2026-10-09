import React from 'react';
import { createApiClient } from '@usrp/api-client';
import { ApplicationDetailPage } from '@usrp/feature-applications';
import { useOfficerSession } from '@usrp/auth';
import { EDGE_BASE_URL } from '../env.js';

const client = createApiClient({ baseUrl: EDGE_BASE_URL });

/** Host-owned adapter: keeps session/transport concerns outside the feature package. */
export default function ApplicationDetailRoute(): React.ReactElement {
  const session = useOfficerSession();
  return <ApplicationDetailPage client={client} agency={session?.agency ?? 'RDF'} />;
}
