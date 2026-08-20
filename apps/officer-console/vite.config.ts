import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compiledPlugin from "@compiled/babel-plugin";
import stripRuntime from "@compiled/babel-plugin-strip-runtime";

// https://vitejs.dev/config/
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
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split ADS components into their own chunk — they're large and
        // rarely change, so they cache well across deploys.
        manualChunks(id) {
          if (id.includes("@atlaskit")) return "atlaskit";
          if (id.includes("@tanstack")) return "tanstack";
        },
      },
    },
  },
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      // Development reverse-proxy to the BFF.
      // In production the same-origin BFF path is configured at the gateway level.
      "/api": {
        target: process.env["VITE_BFF_URL"] ?? "http://localhost:4021",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
