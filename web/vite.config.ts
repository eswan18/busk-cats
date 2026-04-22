import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const workerRoutes = [
  "/api",
  "/auth",
  "/admin",
  "/send",
  "/subscribe",
  "/confirm",
  "/unsubscribe",
];

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../dist", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      workerRoutes.map((p) => [p, { target: "http://localhost:8787", changeOrigin: false }]),
    ),
  },
});
