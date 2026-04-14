import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["highland-logo.jpeg", "mask-icon.svg"],
      manifest: {
        name: "Highland",
        short_name: "Highland",
        description: "Business Management System for meat processing and selling",
        theme_color: "#18181b",
        background_color: "#fafafa",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "highland-logo.jpeg", sizes: "192x192", type: "image/jpeg" },
          { src: "highland-logo.jpeg", sizes: "512x512", type: "image/jpeg" },
          {
            src: "highland-logo.jpeg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpeg,jpg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 10 },
            },
          },
        ],
      },
      // Avoid stale cached dev bundles causing old API URL/CORS behavior.
      // Keep PWA enabled only for production builds.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: env.VITE_PROXY_TARGET || "https://bmsapi.codesangraha.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/v1"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
    /** Avoid "Invalid hook call" / null dispatcher when a transitive dep bundles another React copy. */
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist",
  },
  };
});
