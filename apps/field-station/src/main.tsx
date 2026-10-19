import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setBooleanFeatureFlagResolver } from "@atlaskit/platform-feature-flags";
import { resolveAdsFeatureFlag } from "@usrp/design-system";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "@atlaskit/app-provider/app-provider";
import { FlagsProvider } from "@atlaskit/flag/flags-provider";
import "@atlaskit/css-reset";
// eslint-disable-next-line @atlaskit/ui-styling-standard/no-global-styles -- self-hosted @font-face declarations only (no selectors); fonts cannot be registered through compiled styles
import "@usrp/design-system/fonts.css";

import "@usrp/i18n";
import { assertNamespaceRegistered } from "@usrp/i18n";
import { AuthProvider } from "@usrp/auth";
import { RouterLink, ErrorBoundary } from "@usrp/ui";

import { registerFieldOpsLocales } from "@usrp/feature-field-ops";

import { EDGE_BASE_URL } from "./env.js";
import { FIELD_SLICE_NAMESPACES } from "./routes/slices.js";
import { App } from "./app.js";

// The one ADS flag allowlist every app shares (@usrp/design-system).
setBooleanFeatureFlagResolver(resolveAdsFeatureFlag);

registerFieldOpsLocales();
assertNamespaceRegistered(...FIELD_SLICE_NAMESPACES);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300_000,
      retry: 2,
      refetchOnWindowFocus: false,
      throwOnError: false,
    },
    mutations: {
      // A state-changing write is never retried automatically (AGENTS.md §2).
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
    <ErrorBoundary
      onError={(error, componentStack) => {
        if (import.meta.env.DEV) {
          console.error("[field-station] render failure", error, componentStack);
        }
      }}
    >
      <AppProvider routerLinkComponent={RouterLink} defaultColorMode="light">
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
