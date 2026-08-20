import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setBooleanFeatureFlagResolver } from "@atlaskit/platform-feature-flags";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "@atlaskit/app-provider/app-provider";
import { FlagGroup } from "@atlaskit/flag";
import "@atlaskit/css-reset";
import "@usrp/i18n";
import { AuthProvider } from "@usrp/auth";
import { RouterLink, ErrorBoundary } from "@usrp/ui";
import { BFF_BASE_URL } from "./env.js";
import { App } from "./app.js";

// Resolve all ADS feature flags to false — prevents the Statsig
// "Client must be initialized" crash inside AppProvider on first render.
setBooleanFeatureFlagResolver(() => false);

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
if (container === null) throw new Error("#root not found in index.html");

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider routerLinkComponent={RouterLink} defaultColorMode="light">
        <FlagGroup>
          <QueryClientProvider client={queryClient}>
            <AuthProvider bffBaseUrl={BFF_BASE_URL}>
              <App />
            </AuthProvider>
          </QueryClientProvider>
        </FlagGroup>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
