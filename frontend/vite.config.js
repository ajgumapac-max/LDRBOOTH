import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // so it's reachable from a phone on the same LAN during dev
    port: 5173,
  },
});
