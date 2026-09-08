import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compiledPlugin from "@compiled/babel-plugin";
import stripRuntime from "@compiled/babel-plugin-strip-runtime";

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
  ],
  build: {
    target: "es2022",
    sourcemap: "hidden",
    rollupOptions: {
      output: {
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
      "/edge": {
        target: process.env["VITE_EDGE_URL"] ?? "http://localhost:4021",
        changeOrigin: true,
      },
    },
  },
});
