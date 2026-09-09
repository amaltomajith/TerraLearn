import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === "development" ? "/" : process.env.VITE_BASE_PATH || "/",
  optimizeDeps: {
    entries: ["src/main.tsx", "src/tempobook/**/*"],
    // Pre-bundle maplibre-gl so its web worker initialises correctly in dev.
    include: ["maplibre-gl"],
    // Do NOT pre-bundle onnxruntime-web (leaf scanner). esbuild's dep bundle
    // rewrites the import.meta.url that ort uses to locate its .wasm runtime,
    // so in dev the fetch 404s and Vite serves index.html instead — the WASM
    // loader then fails with "expected magic word 00 61 73 6d, found 3c 21 64
    // 6f" (that's "<!do"). Excluded, Vite serves it straight from
    // node_modules/onnxruntime-web/dist/ and the .wasm path resolves.
    exclude: ["onnxruntime-web"],
  },
  plugins: [
    react(),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ["maplibre-gl"],
          recharts: ["recharts"],
        },
      },
    },
  },
  server: {
    // @ts-ignore
    allowedHosts: process.env.TEMPO === "true" ? true : undefined,
    host: process.env.TEMPO === "true" ? '0.0.0.0' : undefined,
  }
});
