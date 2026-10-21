import React, { Suspense, useEffect } from "react";
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
import { NotFoundPage } from "@usrp/ui";
// Login is deliberately EAGER, as in officer-console: it is the recovery path
// when the network is degraded, a service worker has just updated, or a lazy
// chunk is unavailable. On a venue tablet that is not an edge case.
import OfficerLoginPage from "@usrp/feature-identity/officer-login";
import { StationShell } from "./components/StationShell/index.js";
import { FIELD_SLICE_ROUTES } from "./routes/slices.js";
import { gateByReadiness } from "./routes/readiness.js";

const spinnerStyles = cssMap({
  fullPage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },
});

const FullPageSpinner = (): React.ReactElement => (
  <Box xcss={spinnerStyles.fullPage}>
    <Spinner size="large" label="Loading…" />
  </Box>
);

function FieldStationLogin(): React.ReactElement | null {
  const { t } = useTranslation();
  return <OfficerLoginPage homePath="/stations" productName={t("field_station.app_title")} />;
}

const router = createBrowserRouter(
  gateByReadiness([
    { path: "/login", element: <FieldStationLogin /> },
    {
      path: "/",
      element: (
        <RouteGuard redirectTo="/login" fallback={<FullPageSpinner />}>
          <StationShell>
            <Suspense fallback={<FullPageSpinner />}>
              <Outlet />
            </Suspense>
          </StationShell>
        </RouteGuard>
      ),
      children: [
        { index: true, element: <Navigate to="/stations" replace /> },
        {
          element: (
            <OfficerGuard redirectTo="/login" fallback={<FullPageSpinner />}>
              <Outlet />
            </OfficerGuard>
          ),
          children: [
            ...FIELD_SLICE_ROUTES,
            { path: "*", element: <NotFoundPage homePath="/stations" /> },
          ],
        },
      ],
    },
  ]),
  {
    // React Router v7 behaviour, opted into now (same flags as officer-console).
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);

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
