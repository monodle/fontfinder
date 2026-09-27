import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { syncAppVersion } from "./scripts/sync-version.js";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

function syncVersionPlugin() {
  return {
    name: "vite-plugin-sync-version",
    configResolved() {
      syncAppVersion();
    },
  };
}

export default defineConfig({
  build: {
    emptyOutDir: false,
  },
  plugins: [syncVersionPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
});
