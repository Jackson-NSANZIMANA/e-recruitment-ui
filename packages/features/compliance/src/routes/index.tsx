import React, { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { ApiClient } from '@usrp/api-client';

const Queue = lazy(() => import('./dpo-queue.tsx'));
const Withdraw = lazy(() => import('./withdraw.tsx'));

/** The DPO's erasure queue; `compliance` (the old placeholder index) lands on it. */
export function createComplianceOfficerRoutes({ client }: { readonly client: ApiClient }): readonly RouteObject[] {
  return [
    { path: 'compliance', element: <Navigate to="/compliance/erasure-queue" replace /> },
    { path: 'compliance/erasure-queue', element: <Queue client={client} /> },
  ];
}

export const ComplianceCitizenRoutes: readonly RouteObject[] = [{ path: 'my/withdraw', element: <Withdraw /> }];
