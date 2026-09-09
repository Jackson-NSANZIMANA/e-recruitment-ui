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
import { AppShell } from "./components/AppShell/index.js";
import { OFFICER_SLICE_ROUTES } from "./routes/slices.js";


const spinnerStyles = cssMap({
  fullPage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },
});

// Lazy-load route modules — keeps the initial bundle small.
const LoginPage = lazy(() => import("./routes/login.js"));
const DashboardPage = lazy(() => import("./routes/dashboard.js"));
const ApplicationsPage = lazy(() => import("./routes/applications.js"));
const ApplicationDetailPage = lazy(
  () => import("./routes/application-detail.js"),
);
const WalkInPage = lazy(() => import("./routes/walk-in.js"));

const FullPageSpinner = (): React.ReactElement => (
  <Box xcss={spinnerStyles.fullPage}>
    <Spinner size="large" label="Loading…" />
  </Box>
);

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    // All routes below require authentication.
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
      { path: "dashboard", element: <DashboardPage /> },
      { path: "applications", element: <ApplicationsPage /> },
      { path: "applications/:id", element: <ApplicationDetailPage /> },
      { path: "walk-in", element: <WalkInPage /> },

      // ── Feature slices (ADR-FE-006) ──────────────────────────────────────
      //
      // Wrapped in OfficerGuard rather than relying on the RouteGuard above,
      // because RouteGuard accepts ANY authenticated session. A citizen session
      // reaching an officer screen would render controls whose every request
      // 401s at the edge, which reads as a broken product rather than a wrong
      // door.
      //
      // PRESENTATION ONLY. Cross-agency isolation is FORCE'd PostgreSQL RLS with
      // no bypass principal; an officer whose browser is tricked into rendering
      // another agency's screen sees an empty list because the database returns
      // no rows.
      {
        element: (
          <OfficerGuard redirectTo="/login" fallback={<FullPageSpinner />}>
            <Outlet />
          </OfficerGuard>
        ),
        children: [...OFFICER_SLICE_ROUTES],
      },
    ],
  },
]);

export function App(): React.ReactElement {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
