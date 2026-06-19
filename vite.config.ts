import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    vue(),
    // cad-viewer/cad-simple-viewer resuelven los Web Workers (parser DWG/DXF,
    // renderer MTEXT) por URL relativa "./assets/*-worker.js". Se copian como
    // assets estáticos para que estén disponibles en dev y en build.
    viteStaticCopy({
      targets: [
        {
          src: "./node_modules/@mlightcad/cad-simple-viewer/dist/*-worker.js",
          dest: "assets",
        },
      ],
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "blindCAD",
        short_name: "blindCAD",
        description:
          "CAD 2D estructural web/PWA offline-first con línea de comandos tipo AutoCAD.",
        theme_color: "#1e1e1e",
        background_color: "#1e1e1e",
        display: "standalone",
        start_url: "/",
        scope: "/",
        // TODO(PWA): añadir pwa-192.png / pwa-512.png reales en un paso posterior.
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm}"],
        navigateFallback: "index.html",
        // El worker de LibreDWG (parser DWG) pesa ~8.7MB; subimos el límite
        // para que el service worker lo precachee y la app sea offline-first.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
