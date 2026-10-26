import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import compiled from "@compiled/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
// ADR-FE-009 lock 2: below-floor route sources are not shipped in production.
import { readinessStubPlugin } from "../../tooling/surface-contract/src/vite-readiness.ts";

// ══════════════════════════════════════════════════════════════════
// field-station build (ADR-FE-007).
//
// The managed exam-day tablet: installed once per device on managed Chrome
// (ADR-FE-005, frontend-revamp-plan D3), landscape, station-centric. Served
// from field.<domain> in a deployment and on port 3002 locally.
//
// The service worker precaches the shell and NEVER caches /edge/v1/**
// (NetworkOnly): an exam-day answer read from a cache would be a stale answer
// presented as a live one. Durable offline capture is @usrp/field-ledger's job
// (ADR-FE-010), not the HTTP cache's.
// ══════════════════════════════════════════════════════════════════

// Same guard as officer-console: a production bundle without its edge origin
// builds and then throws at startup, so the build refuses instead. Dev and
// preview proxy /edge and do not need it.
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

const EDGE_TARGET = process.env["VITE_EDGE_URL"] ?? "http://localhost:4021";

export default defineConfig(({ command, mode }) => {
  assertEdgeUrl(command, mode);
  return {
    plugins: [
      readinessStubPlugin({ app: "field-station", repoRoot: fileURLToPath(new URL("../..", import.meta.url)) }),
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
          name: "USRP Field Station",
          short_name: "USRP Field",
          description: "Republic of Rwanda — Unified Security Recruitment Portal, exam-day field station (restricted)",
          // hygiene-allow-hex: see applicant-portal config for rationale.
          theme_color: "#003F82", // GoR Primary Blue (RISA brand sheet) - ADR-FE-020
          background_color: "#FFFFFF", // hygiene-allow-hex: web manifest, read before any CSS
          display: "standalone",
          orientation: "landscape",
          start_url: "/",
          icons: [
            // The coat of arms of the Republic of Rwanda, whole and unaltered on
            // white (ADR-FE-020). Separate maskable art keeps the emblem inside
            // the 80% safe zone so a launcher mask never crops it.
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
      // See applicant-portal: no manualChunks, same rationale.
    },
    server: {
      port: 3002,
      strictPort: true,
      proxy: {
        "/edge": { target: EDGE_TARGET, changeOrigin: true },
      },
    },
    preview: {
      port: 3002,
      strictPort: true,
      proxy: {
        "/edge": { target: EDGE_TARGET, changeOrigin: true },
      },
    },
  };
});
