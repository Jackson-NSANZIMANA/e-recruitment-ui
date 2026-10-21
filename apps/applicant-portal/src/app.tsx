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
import { NotFoundPage } from "@usrp/ui";
import { CITIZEN_SLICE_ROUTES } from "./routes/slices.js";
import { gateByReadiness } from "./routes/readiness.js";
import { EDGE_BASE_URL } from "./env.js";

const spinnerStyles = cssMap({
  fullPage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  },
});

// The citizen sign-in lives in @usrp/feature-identity since S02 (ADR-FE-007 §5).
const LoginPage = lazy(() => import("@usrp/feature-identity/citizen-login"));
const HomePage = lazy(() => import("./routes/home.js"));
const ApplicationsPage = lazy(() => import("./routes/applications.js"));
const StatusPage = lazy(() => import("./routes/status.js"));
const ApplyPage = lazy(() => import("./routes/apply/index.js"));
const ExamQrPage = lazy(() => import("./routes/exam-qr.js"));

const FullPageSpinner = (): React.ReactElement => (
  <Box xcss={spinnerStyles.fullPage}>
    <Spinner size="large" label="Loading…" />
  </Box>
);

const router = createBrowserRouter(gateByReadiness([
  { path: "/login", element: <LoginPage edgeBaseUrl={EDGE_BASE_URL} /> },
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
      // ADR-033: the downloadable exam QR for one of the citizen's applications.
      { path: "applications/:applicationId/exam-qr", element: <ExamQrPage /> },

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
      { path: "*", element: <NotFoundPage homePath="/home" /> },
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

  // Keep the HTML lang attribute in sync with the active i18n language so
  // screen readers and browser translation detect the correct language.
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </Suspense>
  );
}
