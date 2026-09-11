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
import { RouteGuard, ApplicantGuard } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { CITIZEN_SLICE_ROUTES } from "./routes/slices.js";

const spinnerStyles = cssMap({
  fullPage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  },
});

const LoginPage = lazy(() => import("./routes/login.js"));
const HomePage = lazy(() => import("./routes/home.js"));
const ApplicationsPage = lazy(() => import("./routes/applications.js"));
const StatusPage = lazy(() => import("./routes/status.js"));
const ApplyPage = lazy(() => import("./routes/apply/index.js"));

const FullPageSpinner = (): React.ReactElement => (
  <Box xcss={spinnerStyles.fullPage}>
    <Spinner size="large" label="Loading…" />
  </Box>
);

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RouteGuard redirectTo="/login" fallback={<FullPageSpinner />}>
        <Outlet />
      </RouteGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: "home", element: <HomePage /> },
      { path: "apply", element: <ApplyPage /> },
      { path: "apply/:step", element: <ApplyPage /> },
      { path: "status", element: <StatusPage /> },
      { path: "applications", element: <ApplicationsPage /> },

      // ── Feature slices (ADR-FE-006) ──────────────────────────────────────
      //
      // ApplicantGuard, not RouteGuard: an OFFICER session must not reach the
      // citizen self-withdrawal screen. The two credential kinds are not
      // interchangeable (ADR-016 vs ADR-018) and the edge answers 403, not 401,
      // for the wrong kind — authenticated and forbidden, never anonymous.
      {
        element: (
          <ApplicantGuard redirectTo="/home" fallback={<FullPageSpinner />}>
            <Outlet />
          </ApplicantGuard>
        ),
        children: [...CITIZEN_SLICE_ROUTES],
      },
    ],
  },
]);

export function App(): React.ReactElement {
  const { i18n } = useTranslation();

  // Keep the HTML lang attribute in sync with the active i18n language so
  // screen readers and browser translation detect the correct language.
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
