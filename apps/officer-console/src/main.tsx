import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setBooleanFeatureFlagResolver } from "@atlaskit/platform-feature-flags";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "@atlaskit/app-provider/app-provider";
import { FlagsProvider } from "@atlaskit/flag/flags-provider";
import "@atlaskit/css-reset";

import "@usrp/i18n";
import { assertNamespaceRegistered } from "@usrp/i18n";
import { AuthProvider } from "@usrp/auth";
import { RouterLink, ErrorBoundary } from "@usrp/ui";

import { registerAdjudicationLocales } from "@usrp/feature-adjudication";
import { registerComplianceLocales } from "@usrp/feature-compliance";
import { registerFieldOpsLocales } from "@usrp/feature-field-ops";
import { registerSchedulingLocales } from "@usrp/feature-scheduling";

import { EDGE_BASE_URL } from "./env.js";
import { OFFICER_SLICE_NAMESPACES } from "./routes/slices.js";
import { App } from "./app.js";

setBooleanFeatureFlagResolver(() => false);

// ══════════════════════════════════════════════════════════════════
// i18n namespace registration — BEFORE render, deliberately.
//
// i18next returns THE KEY for a missing namespace. It does not throw and it does
// not warn in production, so an unregistered slice renders the literal string
// `adjudication.queue.title` as visible text to an officer. Registering here and
// then asserting turns that into a startup failure, which is the trade every
// other gate in this repository already makes.
//
// Registration is explicit rather than a side effect of importing the slice,
// because a side effect would tie bundle loading to module evaluation order and
// would pull all four bundles into any chunk that touched one.
// ══════════════════════════════════════════════════════════════════
registerAdjudicationLocales();
registerComplianceLocales();
registerFieldOpsLocales();
registerSchedulingLocales();
assertNamespaceRegistered(...OFFICER_SLICE_NAMESPACES);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300_000,
      retry: 2,
      refetchOnWindowFocus: false,
      throwOnError: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const container = document.getElementById("root");

if (container === null) {
  throw new Error("#root not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider
        routerLinkComponent={RouterLink}
        defaultColorMode="light"
      >
        <FlagsProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider edgeBaseUrl={EDGE_BASE_URL}>
              <App />
            </AuthProvider>
          </QueryClientProvider>
        </FlagsProvider>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
