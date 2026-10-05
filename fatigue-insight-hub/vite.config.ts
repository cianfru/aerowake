import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import pkg from "./package.json";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local'),
  },
  plugins: [
    react(),
    // Offline use (in flight): the app shell is cached by a service worker. API
    // responses are never cached by it — the last roster is kept by the app
    // itself on the device (src/lib/offline-store.ts), per signed-in owner.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["favicon.png", "favicon.ico", "fonts/**/*"],
      manifest: {
        name: "Aerowake — roster fatigue",
        short_name: "Aerowake",
        description: "Predicted sleepiness for your roster, with the reasons behind it. Works offline once a roster is loaded.",
        start_url: "/roster",
        scope: "/",
        display: "standalone",
        background_color: "#edf3f6",
        theme_color: "#edf3f6",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,json}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
