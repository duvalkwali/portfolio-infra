import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The proxy is the fallback path: with `VITE_API_URL` unset the client issues
 * same-origin requests and these rules forward them to a locally running backend, so
 * dev works without relying on CORS. Setting `VITE_API_URL` bypasses the proxy
 * entirely and points the shell at the deployed API instead.
 */
const proxyTarget = {
  target: "http://localhost:8080",
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": proxyTarget,
      "/actuator": proxyTarget,
    },
  },
});
