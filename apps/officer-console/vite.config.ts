import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compiled from "@compiled/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

// ══════════════════════════════════════════════════════════════════
// officer-console build.
//
// THE OFFLINE LAYER IS NOT OPTIONAL HERE. ADR-FE-005 describes the field
// tablet as the harder offline problem: no signal for hours, exam-day
// scores for hundreds of applicants.
// ══════════════════════════════════════════════════════════════════
export default defineConfig({
  plugins: [
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
});
