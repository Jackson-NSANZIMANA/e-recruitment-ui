// ══════════════════════════════════════════════════════════════════
// identity — officer routes beyond sign-in (S06)
//
//   staff     the agency administrator's staff administration (officer branch)
//   activate  the PUBLIC officer activation screen: the one-time code is the credential
//
// Factories, like the other slices: the host passes the edge client.
// ══════════════════════════════════════════════════════════════════

import React, { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { ApiClient } from '@usrp/api-client';

const Staff = lazy(() => import('./staff.tsx'));
const Activate = lazy(() => import('./activate.tsx'));

export function createStaffRoutes({ client }: { readonly client: ApiClient }): readonly RouteObject[] {
  return [{ path: 'staff', element: <Staff client={client} /> }];
}

export function createActivationRoutes({ client }: { readonly client: ApiClient }): readonly RouteObject[] {
  return [{ path: 'activate', element: <Activate client={client} /> }];
}
