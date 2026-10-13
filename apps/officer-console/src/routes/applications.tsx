import React from 'react';
import { createApiClient } from '@usrp/api-client';
import { ApplicationsPage } from '@usrp/feature-applications';
import { useOfficerSession } from '@usrp/auth';
import { EDGE_BASE_URL } from '../env.js';

const client = createApiClient({ baseUrl: EDGE_BASE_URL });

/** Host-owned adapter: supplies the authenticated session's agency and shared edge client. */
export default function ApplicationsRoute(): React.ReactElement {
  const session = useOfficerSession();
  return <ApplicationsPage client={client} agency={session?.agency ?? 'RDF'} />;
}
