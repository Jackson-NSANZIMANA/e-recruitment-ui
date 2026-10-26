import React, { Suspense, lazy, useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import Spinner from "@atlaskit/spinner";
import { Box } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { RouteGuard, OfficerGuard } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { NationalFrame, NotFoundPage } from "@usrp/ui";
import { AppShell } from "./components/AppShell/index.js";
import { OFFICER_SLICE_ROUTES } from "./routes/slices.js";
import { gateByReadiness } from "./routes/readiness.js";

const spinnerStyles = cssMap({
  fullPage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },
});

// Login is deliberately eager. It is the recovery path when the network is
// degraded, a service worker has just updated, or a lazy chunk is unavailable.
// The first actionable screen must not depend on a secondary JS fetch.
// One implementation for every app since S02 (ADR-FE-007 §5).
import OfficerLoginPage from "@usrp/feature-identity/officer-login";

const DashboardPage = lazy(() => import("./routes/dashboard.js"));
const ActivatePage = lazy(() => import("./routes/activate.js"));
// The gate and the walk-in desk moved to the Field Station (ADR-FE-007): the
// old paths redirect to a notice that says where they went.
const FieldStationNotice = lazy(() => import("./routes/field-station-notice.js"));

const FullPageSpinner = (): React.ReactElement => (
  <Box xcss={spinnerStyles.fullPage}>
    <Spinner size="large" label="Loading…" />
  </Box>
);

// Sign-in and activation sit outside the shell, so they get the staff frame
// (ADR-FE-020): handling marking, national lockup, language switch. No route in
// the console opens without the state and the restriction identifying it.
const StaffEntryLayout = (): React.ReactElement => {
  const { t } = useTranslation();
  return (
    <NationalFrame audience="staff" serviceName={t("dashboard.title")}>
      <Outlet />
    </NationalFrame>
  );
};

const router = createBrowserRouter(gateByReadiness([
  { element: <StaffEntryLayout />, children: [
    { path: "/login", element: <OfficerLoginPage homePath="/dashboard" /> },
    // Public: the one-time code released by a second administrator is the credential (ADR-036 Addendum A).
    { path: "/activate", element: <ActivatePage /> },
  ] },
  {
    path: "/",
    element: (
      <RouteGuard redirectTo="/login" fallback={<FullPageSpinner />}>
        <AppShell>
          <Outlet />
        </AppShell>
      </RouteGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        element: (
          <OfficerGuard redirectTo="/login" fallback={<FullPageSpinner />}>
            <Outlet />
          </OfficerGuard>
        ),
        children: [
          { path: "dashboard", element: <DashboardPage /> },
          { path: "walk-in", element: <Navigate to="/field-station" replace /> },
          { path: "gate", element: <Navigate to="/field-station" replace /> },
          { path: "field-station", element: <FieldStationNotice /> },
          ...OFFICER_SLICE_ROUTES,
          { path: "*", element: <NotFoundPage homePath="/dashboard" /> },
        ],
      },
    ],
  },
]), {
  // React Router v7 behaviour, opted into now so v6 stops warning and the
  // upgrade is a no-op. No route here uses actions, fetchers or splats, so
  // only v7_startTransition (on RouterProvider) changes anything at runtime.
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});

export function App(): React.ReactElement {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </Suspense>
  );
}
