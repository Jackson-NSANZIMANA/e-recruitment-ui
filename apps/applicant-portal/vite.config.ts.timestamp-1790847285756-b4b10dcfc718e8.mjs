// vite.config.ts
import { defineConfig } from "file:///home/uruti/Documents/projects/e-recruitment-software/e-recruitment-ui/node_modules/.pnpm/vite@5.4.21_@types+node@26.5.0_terser@5.49.2/node_modules/vite/dist/node/index.js";
import react from "file:///home/uruti/Documents/projects/e-recruitment-software/e-recruitment-ui/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@26.5.0_terser@5.49.2_/node_modules/@vitejs/plugin-react/dist/index.js";
import compiledPlugin from "file:///home/uruti/Documents/projects/e-recruitment-software/e-recruitment-ui/node_modules/.pnpm/@compiled+babel-plugin@2.0.0_@compiled+react@1.0.2_react@18.3.1_/node_modules/@compiled/babel-plugin/dist/index.js";
import stripRuntime from "file:///home/uruti/Documents/projects/e-recruitment-software/e-recruitment-ui/node_modules/.pnpm/@compiled+babel-plugin-strip-runtime@2.0.0_@compiled+react@1.0.2_react@18.3.1_/node_modules/@compiled/babel-plugin-strip-runtime/dist/index.js";
import { VitePWA } from "file:///home/uruti/Documents/projects/e-recruitment-software/e-recruitment-ui/node_modules/.pnpm/vite-plugin-pwa@0.20.5_vite@5.4.21_@types+node@26.5.0_terser@5.49.2__workbox-build@7.3.0_@typ_yjcagulvapmdfd2rcgqfk2dija/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          "@atlaskit/tokens/babel-plugin",
          [
            compiledPlugin,
            {
              transformerBabelPlugins: ["@atlaskit/tokens/babel-plugin"],
              importSources: ["@compiled/react", "@atlaskit/css"]
            }
          ],
          stripRuntime
        ]
      }
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /\/edge\/v1\/.*/i,
            handler: "NetworkOnly"
          },
          {
            urlPattern: /\/audio\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "usrp-audio-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 2592e3 }
            }
          }
        ]
      },
      manifest: {
        name: "USRP Applicant Portal",
        short_name: "USRP",
        description: "Rwanda unified security recruitment \u2014 applicant portal",
        // hygiene-allow-hex: a web manifest is serialised JSON the OS reads before any stylesheet exists, so these CANNOT be design tokens. Values mirror the ADS light-mode brand and surface.
        theme_color: "#0052CC",
        // hygiene-allow-hex: web manifest background_color, same rationale as theme_color above.
        background_color: "#FFFFFF",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      }
    })
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
        }
      }
    }
  },
  server: {
    port: 3e3,
    strictPort: true,
    proxy: {
      "/edge": {
        target: process.env["VITE_EDGE_URL"] ?? "http://localhost:4021",
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 3e3,
    strictPort: true,
    proxy: {
      "/edge": {
        target: process.env["VITE_EDGE_URL"] ?? "http://localhost:4021",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS91cnV0aS9Eb2N1bWVudHMvcHJvamVjdHMvZS1yZWNydWl0bWVudC1zb2Z0d2FyZS9lLXJlY3J1aXRtZW50LXVpL2FwcHMvYXBwbGljYW50LXBvcnRhbFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvdXJ1dGkvRG9jdW1lbnRzL3Byb2plY3RzL2UtcmVjcnVpdG1lbnQtc29mdHdhcmUvZS1yZWNydWl0bWVudC11aS9hcHBzL2FwcGxpY2FudC1wb3J0YWwvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvdXJ1dGkvRG9jdW1lbnRzL3Byb2plY3RzL2UtcmVjcnVpdG1lbnQtc29mdHdhcmUvZS1yZWNydWl0bWVudC11aS9hcHBzL2FwcGxpY2FudC1wb3J0YWwvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IGNvbXBpbGVkUGx1Z2luIGZyb20gXCJAY29tcGlsZWQvYmFiZWwtcGx1Z2luXCI7XG5pbXBvcnQgc3RyaXBSdW50aW1lIGZyb20gXCJAY29tcGlsZWQvYmFiZWwtcGx1Z2luLXN0cmlwLXJ1bnRpbWVcIjtcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCh7XG4gICAgICBiYWJlbDoge1xuICAgICAgICBwbHVnaW5zOiBbXG4gICAgICAgICAgXCJAYXRsYXNraXQvdG9rZW5zL2JhYmVsLXBsdWdpblwiLFxuICAgICAgICAgIFtcbiAgICAgICAgICAgIGNvbXBpbGVkUGx1Z2luLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB0cmFuc2Zvcm1lckJhYmVsUGx1Z2luczogW1wiQGF0bGFza2l0L3Rva2Vucy9iYWJlbC1wbHVnaW5cIl0sXG4gICAgICAgICAgICAgIGltcG9ydFNvdXJjZXM6IFtcIkBjb21waWxlZC9yZWFjdFwiLCBcIkBhdGxhc2tpdC9jc3NcIl0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgc3RyaXBSdW50aW1lLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXG4gICAgICB3b3JrYm94OiB7XG4gICAgICAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9XCJdLFxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC9lZGdlXFwvdjFcXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJOZXR3b3JrT25seVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL1xcL2F1ZGlvXFwvLiovaSxcbiAgICAgICAgICAgIGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6IFwidXNycC1hdWRpby1jYWNoZVwiLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDUwLCBtYXhBZ2VTZWNvbmRzOiAyXzU5Ml8wMDAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiBcIlVTUlAgQXBwbGljYW50IFBvcnRhbFwiLFxuICAgICAgICBzaG9ydF9uYW1lOiBcIlVTUlBcIixcbiAgICAgICAgZGVzY3JpcHRpb246IFwiUndhbmRhIHVuaWZpZWQgc2VjdXJpdHkgcmVjcnVpdG1lbnQgXHUyMDE0IGFwcGxpY2FudCBwb3J0YWxcIixcbiAgICAgICAgLy8gaHlnaWVuZS1hbGxvdy1oZXg6IGEgd2ViIG1hbmlmZXN0IGlzIHNlcmlhbGlzZWQgSlNPTiB0aGUgT1MgcmVhZHMgYmVmb3JlIGFueSBzdHlsZXNoZWV0IGV4aXN0cywgc28gdGhlc2UgQ0FOTk9UIGJlIGRlc2lnbiB0b2tlbnMuIFZhbHVlcyBtaXJyb3IgdGhlIEFEUyBsaWdodC1tb2RlIGJyYW5kIGFuZCBzdXJmYWNlLlxuICAgICAgICB0aGVtZV9jb2xvcjogXCIjMDA1MkNDXCIsXG4gICAgICAgIC8vIGh5Z2llbmUtYWxsb3ctaGV4OiB3ZWIgbWFuaWZlc3QgYmFja2dyb3VuZF9jb2xvciwgc2FtZSByYXRpb25hbGUgYXMgdGhlbWVfY29sb3IgYWJvdmUuXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiI0ZGRkZGRlwiLFxuICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcbiAgICAgICAgb3JpZW50YXRpb246IFwicG9ydHJhaXRcIixcbiAgICAgICAgc3RhcnRfdXJsOiBcIi9cIixcbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7IHNyYzogXCIvaWNvbnMvaWNvbi0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogXCIvaWNvbnMvaWNvbi01MTIucG5nXCIsXG4gICAgICAgICAgICBzaXplczogXCI1MTJ4NTEyXCIsXG4gICAgICAgICAgICB0eXBlOiBcImltYWdlL3BuZ1wiLFxuICAgICAgICAgICAgcHVycG9zZTogXCJhbnkgbWFza2FibGVcIixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6IFwiZXMyMDIyXCIsXG4gICAgc291cmNlbWFwOiBcImhpZGRlblwiLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJAYXRsYXNraXRcIikpIHJldHVybiBcImF0bGFza2l0XCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiQHRhbnN0YWNrXCIpKSByZXR1cm4gXCJ0YW5zdGFja1wiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIndvcmtib3hcIikpIHJldHVybiBcIndvcmtib3hcIjtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMCxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIHByb3h5OiB7XG4gICAgICBcIi9lZGdlXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBwcm9jZXNzLmVudltcIlZJVEVfRURHRV9VUkxcIl0gPz8gXCJodHRwOi8vbG9jYWxob3N0OjQwMjFcIixcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBwcmV2aWV3OiB7XG4gICAgcG9ydDogMzAwMCxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIHByb3h5OiB7XG4gICAgICBcIi9lZGdlXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBwcm9jZXNzLmVudltcIlZJVEVfRURHRV9VUkxcIl0gPz8gXCJodHRwOi8vbG9jYWxob3N0OjQwMjFcIixcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNjLFNBQVMsb0JBQW9CO0FBQ25lLE9BQU8s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
