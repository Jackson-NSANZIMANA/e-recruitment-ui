import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compiledPlugin from "@compiled/babel-plugin";
import stripRuntime from "@compiled/babel-plugin-strip-runtime";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          "@atlaskit/tokens/babel-plugin",
          [compiledPlugin, { transformerBabelPlugins: ["@atlaskit/tokens/babel-plugin"], importSources: ["@compiled/react", "@atlaskit/css"] }],
          stripRuntime,
        ],
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Authenticated edge responses are never cacheable application data.
            // NetworkOnly prevents stale citizen or officer data surviving logout.
            urlPattern: /\/edge\/v1\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /\/audio\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "usrp-audio-cache", expiration: { maxEntries: 50, maxAgeSeconds: 2_592_000 } },
          },
        ],
      },
      manifest: {
        name: "USRP Applicant Portal",
        short_name: "USRP",
        description: "Rwanda unified security recruitment — applicant portal",
        theme_color: "#0052CC",
        background_color: "#FFFFFF",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
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
