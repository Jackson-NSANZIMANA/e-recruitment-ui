import React, { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { ApiClient } from '@usrp/api-client';

const Queues = lazy(() => import('./queues.tsx'));

/**
 * The officer queues. `adjudication` is the hub; `adjudication/amber-queue`
 * (the path the old placeholder held) opens it on the amber tab.
 */
export function createAdjudicationRoutes({ client }: { readonly client: ApiClient }): readonly RouteObject[] {
  return [
    { path: 'adjudication', element: <Queues client={client} initial="amber" /> },
    { path: 'adjudication/amber-queue', element: <Queues client={client} initial="amber" /> },
  ];
}
