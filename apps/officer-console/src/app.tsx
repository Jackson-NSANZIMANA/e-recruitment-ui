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
import { RouteGuard } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { AppShell } from "./components/AppShell/index.js";


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