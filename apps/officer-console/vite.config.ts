import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import compiled from "@compiled/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
// ADR-FE-009 lock 2: below-floor route sources are not shipped in production.
import { readinessStubPlugin } from "../../tooling/surface-contract/src/vite-readiness.ts";

// ══════════════════════════════════════════════════════════════════
// officer-console build.
//
// THE OFFLINE LAYER IS NOT OPTIONAL HERE. ADR-FE-005 describes the field
// tablet as the harder offline problem: no signal for hours, exam-day
// scores for hundreds of applicants.
// ══════════════════════════════════════════════════════════════════
// A production bundle without VITE_EDGE_URL builds successfully and then
// throws in env.ts at startup: the user gets a blank page and the failure is
// only visible in a browser console. That shipped to CI on 2026-10-16 when the
// tracked .env was removed, so the build now refuses instead. Dev and test
// (`command === "serve"`) proxy /edge and do not need it.
function assertEdgeUrl(command: string, mode: string): void {
  if (command !== "build") return;
  const edgeUrl = (loadEnv(mode, process.cwd(), "VITE_")["VITE_EDGE_URL"] ?? "").trim();
  if (edgeUrl === "") {
    throw new Error(
      "VITE_EDGE_URL is required for a production build (the browser-facing edge origin). " +
        "Set it in the environment or copy .env.example to .env.",
    );
  }
}

export default defineConfig(({ command, mode }) => {
  assertEdgeUrl(command, mode);
  return {
    plugins: [
      readinessStubPlugin({ app: "officer-console", repoRoot: fileURLToPath(new URL("../..", import.meta.url)) }),
      compiled({
        importSources: ["@compiled/react", "@atlaskit/css"],
        transformerBabelPlugins: [["@atlaskit/tokens/babel-plugin"]],
        extract: true,
        sortShorthand: true,
      }),
      react(),
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/edge\//],
          runtimeCaching: [
            {
              urlPattern: /\/edge\/v1\/.*/i,
              handler: "NetworkOnly",
            },
          ],
        },
        manifest: {
          name: "USRP Officer Console",
          short_name: "USRP Officer",
          description:
            "Rwanda unified security recruitment — officer and field console",
          // hygiene-allow-hex: see applicant-portal config for rationale.
          theme_color: "#0052CC",
          background_color: "#FFFFFF", // hygiene-allow-hex: web manifest, read before any CSS
          display: "standalone",
          orientation: "landscape",
          start_url: "/",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
      }),
    ],
    resolve: {
      // ONE router and ONE React in the bundle. @usrp/auth pins its own
      // react-router-dom for its tests, and without this its <Navigate> (the
      // RouteGuard redirect) resolved to a second router copy and threw
      // "<Navigate> may be used only in the context of a <Router>" on every
      // unauthenticated visit to a guarded path. Found by the S02 Field
      // Station E2E; the same latent crash existed in the other two apps.
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    build: {
      target: "es2022",
      sourcemap: "hidden",
      // See applicant-portal: manualChunks removed, same rationale.
    },
    server: {
      // NOTE: `allowedHosts: true` was removed. Vite's own docs warn this
      // permits DNS-rebinding access to dev-server content. If your Arena
      // preview workflow needs a specific generated host, add it explicitly
      // here as a string/array rather than `true`.
      port: 3001,
      strictPort: true,
      proxy: {
        "/edge": {
          target: process.env["VITE_EDGE_URL"] ?? "http://localhost:4021",
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 3001,
      strictPort: true,
      proxy: {
        "/edge": {
          target: process.env["VITE_EDGE_URL"] ?? "http://localhost:4021",
          changeOrigin: true,
        },
      },
    },
  };
});
