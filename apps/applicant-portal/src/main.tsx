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

import { registerComplianceLocales } from "@usrp/feature-compliance";

import { EDGE_BASE_URL } from "./env.js";
import { CITIZEN_SLICE_NAMESPACES } from "./routes/slices.js";
import { App } from "./app.js";

setBooleanFeatureFlagResolver(() => false);

// See the officer-console entrypoint for why this happens before render and why
// it is asserted. A citizen portal that renders `compliance.withdraw.title` as
// visible text is worse than one that refuses to boot.
registerComplianceLocales();
assertNamespaceRegistered(...CITIZEN_SLICE_NAMESPACES);

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
