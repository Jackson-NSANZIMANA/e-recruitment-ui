// ══════════════════════════════════════════════════════════════════
// campaigns — the officer Campaign Studio routes (S05, ADR-FE-015)
//
//   /campaigns            the agency's campaigns, every state
//   /campaigns/new        step 1: the draft
//   /campaigns/:publicCode  steps 2–5 and the lifecycle
//
// A factory, like the other slices: the host passes the edge client. Each path has
// a surface manifest (docs/ui-surfaces/officer.campaign-studio.json).
// ══════════════════════════════════════════════════════════════════

import React, { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { ApiClient } from '@usrp/api-client';

const List = lazy(() => import('../ui/CampaignListPage.tsx').then((m) => ({ default: m.CampaignListPage })));
const New = lazy(() => import('../ui/NewCampaignPage.tsx').then((m) => ({ default: m.NewCampaignPage })));
const Studio = lazy(() => import('../ui/CampaignStudioPage.tsx').then((m) => ({ default: m.CampaignStudioPage })));

export function createCampaignsOfficerRoutes({ client }: { readonly client: ApiClient }): readonly RouteObject[] {
  return [
    { path: 'campaigns', element: <List client={client} /> },
    { path: 'campaigns/new', element: <New client={client} /> },
    { path: 'campaigns/:publicCode', element: <Studio client={client} /> },
  ];
}
