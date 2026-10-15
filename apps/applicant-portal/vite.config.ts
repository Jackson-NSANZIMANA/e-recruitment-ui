import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compiled from "@compiled/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    // Must precede react(). Extracts @compiled/react and @atlaskit/css
    // calls into static CSS at build time.
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
        runtimeCaching: [
          {
            urlPattern: /\/edge\/v1\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /\/audio\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "usrp-audio-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 2_592_000 },
            },
          },
        ],
      },
      manifest: {
        name: "USRP Applicant Portal",
        short_name: "USRP",
        description: "Rwanda unified security recruitment — applicant portal",
        // hygiene-allow-hex: a web manifest is serialised JSON the OS reads
        // before any stylesheet exists, so these CANNOT be design tokens.
        theme_color: "#0052CC",
        background_color: "#FFFFFF", // hygiene-allow-hex: web manifest, read before any CSS
        display: "standalone",
        orientation: "portrait",
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
    // NOTE: no manualChunks. The forced atlaskit/tanstack vendor split
    // produced a circular chunk warning and is the leading suspect for
    // the __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED runtime
    // crash. Let Rollup's default heuristics handle vendor splitting
    // until there is a measured, specific reason to intervene again.
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      "/edge": {
        target: process.env["VITE_EDGE_URL"] ?? "http://localhost:4021",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
    proxy: {
      "/edge": {
        target: process.env["VITE_EDGE_URL"] ?? "http://localhost:4021",
        changeOrigin: true,
      },
    },
  },
});
