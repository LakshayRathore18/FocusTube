import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createLogger, defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const logger = createLogger();
  const logError = logger.error.bind(logger);
  logger.error = (message, options) => {
    if (message.includes("proxy error") || message.includes("proxy socket error")) {
      logError("FastAPI proxy unavailable", { timestamp: true });
    } else {
      logError(message, options);
    }
  };
  // BACKEND_URL belongs to the Node-side proxy, never the browser bundle.
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const proxy = {
    "/api": {
      target: process.env.BACKEND_URL ?? env.BACKEND_URL ?? "http://127.0.0.1:8000",
      changeOrigin: false,
      timeout: 120_000,
      proxyTimeout: 120_000,
    },
  };
  return {
    // Vite's default proxy errors include the request URL and OAuth query.
    customLogger: logger,
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { host: "localhost", port: 3000, strictPort: true, proxy },
    preview: { host: "localhost", port: 3000, strictPort: true, proxy },
    build: { outDir: "dist" },
  };
});
