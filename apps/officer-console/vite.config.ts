import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compiledPlugin from "@compiled/babel-plugin";
import stripRuntime from "@compiled/babel-plugin-strip-runtime";
import { VitePWA } from "vite-plugin-pwa";

// ══════════════════════════════════════════════════════════════════
// officer-console build.
//
// THE OFFLINE LAYER IS NOT OPTIONAL HERE. ADR-FE-005 describes two different
// offline problems and calls the FIELD TABLET the harder one: no signal for
// hours, exam-day scores for hundreds of applicants. Until 2026-09-13 every
// offline mechanism in this repository lived in apps/applicant-portal, and this
// app - the one that runs at the venue - had no service worker at all. A tablet
// that cannot load its own shell without signal is not a field application.
// ══════════════════════════════════════════════════════════════════

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          "@atlaskit/tokens/babel-plugin",
          [
            compiledPlugin,
            {
              transformerBabelPlugins: ["@atlaskit/tokens/babel-plugin"],
              importSources: ["@compiled/react", "@atlaskit/css"],
            },
          ],
          stripRuntime,
        ],
      },
    }),
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
        // hygiene-allow-hex: a web manifest is serialised JSON the OS reads before any stylesheet exists, so these CANNOT be design tokens. Values mirror the ADS light-mode brand and surface.
        theme_color: "#0052CC",
        // hygiene-allow-hex: web manifest background_color, same rationale as theme_color above.
        background_color: "#FFFFFF",
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
  build: {
    target: "es2022",
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@atlaskit")) return "atlaskit";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("workbox")) return "workbox";
        },
      },
    },
  },
  server: {
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
});
