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
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/edge\//],
        runtimeCaching: [
          {
            urlPattern: /\/edge\/v1\/.*/i,
            handler: "NetworkOnly"
          }
        ]
      },
      manifest: {
        name: "USRP Officer Console",
        short_name: "USRP Officer",
        description: "Rwanda unified security recruitment \u2014 officer and field console",
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
    port: 3001,
    strictPort: true,
    proxy: {
      "/edge": {
        target: process.env["VITE_EDGE_URL"] ?? "http://localhost:4021",
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 3001,
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS91cnV0aS9Eb2N1bWVudHMvcHJvamVjdHMvZS1yZWNydWl0bWVudC1zb2Z0d2FyZS9lLXJlY3J1aXRtZW50LXVpL2FwcHMvb2ZmaWNlci1jb25zb2xlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS91cnV0aS9Eb2N1bWVudHMvcHJvamVjdHMvZS1yZWNydWl0bWVudC1zb2Z0d2FyZS9lLXJlY3J1aXRtZW50LXVpL2FwcHMvb2ZmaWNlci1jb25zb2xlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3VydXRpL0RvY3VtZW50cy9wcm9qZWN0cy9lLXJlY3J1aXRtZW50LXNvZnR3YXJlL2UtcmVjcnVpdG1lbnQtdWkvYXBwcy9vZmZpY2VyLWNvbnNvbGUvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IGNvbXBpbGVkUGx1Z2luIGZyb20gXCJAY29tcGlsZWQvYmFiZWwtcGx1Z2luXCI7XG5pbXBvcnQgc3RyaXBSdW50aW1lIGZyb20gXCJAY29tcGlsZWQvYmFiZWwtcGx1Z2luLXN0cmlwLXJ1bnRpbWVcIjtcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCI7XG5cbi8vIFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFxuLy8gb2ZmaWNlci1jb25zb2xlIGJ1aWxkLlxuLy9cbi8vIFRIRSBPRkZMSU5FIExBWUVSIElTIE5PVCBPUFRJT05BTCBIRVJFLiBBRFItRkUtMDA1IGRlc2NyaWJlcyB0d28gZGlmZmVyZW50XG4vLyBvZmZsaW5lIHByb2JsZW1zIGFuZCBjYWxscyB0aGUgRklFTEQgVEFCTEVUIHRoZSBoYXJkZXIgb25lOiBubyBzaWduYWwgZm9yXG4vLyBob3VycywgZXhhbS1kYXkgc2NvcmVzIGZvciBodW5kcmVkcyBvZiBhcHBsaWNhbnRzLiBVbnRpbCAyMDI2LTA5LTEzIGV2ZXJ5XG4vLyBvZmZsaW5lIG1lY2hhbmlzbSBpbiB0aGlzIHJlcG9zaXRvcnkgbGl2ZWQgaW4gYXBwcy9hcHBsaWNhbnQtcG9ydGFsLCBhbmQgdGhpc1xuLy8gYXBwIC0gdGhlIG9uZSB0aGF0IHJ1bnMgYXQgdGhlIHZlbnVlIC0gaGFkIG5vIHNlcnZpY2Ugd29ya2VyIGF0IGFsbC4gQSB0YWJsZXRcbi8vIHRoYXQgY2Fubm90IGxvYWQgaXRzIG93biBzaGVsbCB3aXRob3V0IHNpZ25hbCBpcyBub3QgYSBmaWVsZCBhcHBsaWNhdGlvbi5cbi8vIFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3Qoe1xuICAgICAgYmFiZWw6IHtcbiAgICAgICAgcGx1Z2luczogW1xuICAgICAgICAgIFwiQGF0bGFza2l0L3Rva2Vucy9iYWJlbC1wbHVnaW5cIixcbiAgICAgICAgICBbXG4gICAgICAgICAgICBjb21waWxlZFBsdWdpbixcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdHJhbnNmb3JtZXJCYWJlbFBsdWdpbnM6IFtcIkBhdGxhc2tpdC90b2tlbnMvYmFiZWwtcGx1Z2luXCJdLFxuICAgICAgICAgICAgICBpbXBvcnRTb3VyY2VzOiBbXCJAY29tcGlsZWQvcmVhY3RcIiwgXCJAYXRsYXNraXQvY3NzXCJdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHN0cmlwUnVudGltZSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSksXG4gICAgVml0ZVBXQSh7XG4gICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxuICAgICAgd29ya2JveDoge1xuICAgICAgICBnbG9iUGF0dGVybnM6IFtcIioqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYyfVwiXSxcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFjazogXCJpbmRleC5odG1sXCIsXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2tEZW55bGlzdDogWy9eXFwvZWRnZVxcLy9dLFxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9cXC9lZGdlXFwvdjFcXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJOZXR3b3JrT25seVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogXCJVU1JQIE9mZmljZXIgQ29uc29sZVwiLFxuICAgICAgICBzaG9ydF9uYW1lOiBcIlVTUlAgT2ZmaWNlclwiLFxuICAgICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgICBcIlJ3YW5kYSB1bmlmaWVkIHNlY3VyaXR5IHJlY3J1aXRtZW50IFx1MjAxNCBvZmZpY2VyIGFuZCBmaWVsZCBjb25zb2xlXCIsXG4gICAgICAgIC8vIGh5Z2llbmUtYWxsb3ctaGV4OiBhIHdlYiBtYW5pZmVzdCBpcyBzZXJpYWxpc2VkIEpTT04gdGhlIE9TIHJlYWRzIGJlZm9yZSBhbnkgc3R5bGVzaGVldCBleGlzdHMsIHNvIHRoZXNlIENBTk5PVCBiZSBkZXNpZ24gdG9rZW5zLiBWYWx1ZXMgbWlycm9yIHRoZSBBRFMgbGlnaHQtbW9kZSBicmFuZCBhbmQgc3VyZmFjZS5cbiAgICAgICAgdGhlbWVfY29sb3I6IFwiIzAwNTJDQ1wiLFxuICAgICAgICAvLyBoeWdpZW5lLWFsbG93LWhleDogd2ViIG1hbmlmZXN0IGJhY2tncm91bmRfY29sb3IsIHNhbWUgcmF0aW9uYWxlIGFzIHRoZW1lX2NvbG9yIGFib3ZlLlxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBcIiNGRkZGRkZcIixcbiAgICAgICAgZGlzcGxheTogXCJzdGFuZGFsb25lXCIsXG4gICAgICAgIG9yaWVudGF0aW9uOiBcImxhbmRzY2FwZVwiLFxuICAgICAgICBzdGFydF91cmw6IFwiL1wiLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHsgc3JjOiBcIi9pY29ucy9pY29uLTE5Mi5wbmdcIiwgc2l6ZXM6IFwiMTkyeDE5MlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiBcIi9pY29ucy9pY29uLTUxMi5wbmdcIixcbiAgICAgICAgICAgIHNpemVzOiBcIjUxMng1MTJcIixcbiAgICAgICAgICAgIHR5cGU6IFwiaW1hZ2UvcG5nXCIsXG4gICAgICAgICAgICBwdXJwb3NlOiBcImFueSBtYXNrYWJsZVwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pLFxuICBdLFxuICBidWlsZDoge1xuICAgIHRhcmdldDogXCJlczIwMjJcIixcbiAgICBzb3VyY2VtYXA6IFwiaGlkZGVuXCIsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIkBhdGxhc2tpdFwiKSkgcmV0dXJuIFwiYXRsYXNraXRcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJAdGFuc3RhY2tcIikpIHJldHVybiBcInRhbnN0YWNrXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwid29ya2JveFwiKSkgcmV0dXJuIFwid29ya2JveFwiO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiAzMDAxLFxuICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgcHJveHk6IHtcbiAgICAgIFwiL2VkZ2VcIjoge1xuICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52W1wiVklURV9FREdFX1VSTFwiXSA/PyBcImh0dHA6Ly9sb2NhbGhvc3Q6NDAyMVwiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHByZXZpZXc6IHtcbiAgICBwb3J0OiAzMDAxLFxuICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgcHJveHk6IHtcbiAgICAgIFwiL2VkZ2VcIjoge1xuICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52W1wiVklURV9FREdFX1VSTFwiXSA/PyBcImh0dHA6Ly9sb2NhbGhvc3Q6NDAyMVwiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbWMsU0FBUyxvQkFBb0I7QUFDaGUsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sb0JBQW9CO0FBQzNCLE9BQU8sa0JBQWtCO0FBQ3pCLFNBQVMsZUFBZTtBQWF4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsTUFDSixPQUFPO0FBQUEsUUFDTCxTQUFTO0FBQUEsVUFDUDtBQUFBLFVBQ0E7QUFBQSxZQUNFO0FBQUEsWUFDQTtBQUFBLGNBQ0UseUJBQXlCLENBQUMsK0JBQStCO0FBQUEsY0FDekQsZUFBZSxDQUFDLG1CQUFtQixlQUFlO0FBQUEsWUFDcEQ7QUFBQSxVQUNGO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsSUFDRCxRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxTQUFTO0FBQUEsUUFDUCxjQUFjLENBQUMsc0NBQXNDO0FBQUEsUUFDckQsa0JBQWtCO0FBQUEsUUFDbEIsMEJBQTBCLENBQUMsV0FBVztBQUFBLFFBQ3RDLGdCQUFnQjtBQUFBLFVBQ2Q7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxVQUNYO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQ0U7QUFBQTtBQUFBLFFBRUYsYUFBYTtBQUFBO0FBQUEsUUFFYixrQkFBa0I7QUFBQSxRQUNsQixTQUFTO0FBQUEsUUFDVCxhQUFhO0FBQUEsUUFDYixXQUFXO0FBQUEsUUFDWCxPQUFPO0FBQUEsVUFDTCxFQUFFLEtBQUssdUJBQXVCLE9BQU8sV0FBVyxNQUFNLFlBQVk7QUFBQSxVQUNsRTtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGFBQWEsSUFBSTtBQUNmLGNBQUksR0FBRyxTQUFTLFdBQVcsRUFBRyxRQUFPO0FBQ3JDLGNBQUksR0FBRyxTQUFTLFdBQVcsRUFBRyxRQUFPO0FBQ3JDLGNBQUksR0FBRyxTQUFTLFNBQVMsRUFBRyxRQUFPO0FBQUEsUUFDckM7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxJQUNaLE9BQU87QUFBQSxNQUNMLFNBQVM7QUFBQSxRQUNQLFFBQVEsUUFBUSxJQUFJLGVBQWUsS0FBSztBQUFBLFFBQ3hDLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsTUFDTCxTQUFTO0FBQUEsUUFDUCxRQUFRLFFBQVEsSUFBSSxlQUFlLEtBQUs7QUFBQSxRQUN4QyxjQUFjO0FBQUEsTUFDaEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
