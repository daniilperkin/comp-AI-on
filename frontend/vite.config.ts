import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import process from "node:process";

// Build-time data-source selection. Instead of a runtime switch (which would
// bundle every transport plus the firebase SDK), the @/lib/api import is
// aliased to a variant module — so each build contains exactly one transport.
const DATA_SOURCE = process.env.VITE_DATA_SOURCE;
const apiModule =
  DATA_SOURCE === "demo"
    ? "./src/lib/api.demo.ts"
    : DATA_SOURCE === "firestore"
      ? "./src/lib/api.mirror.ts"
      : "./src/lib/api.ts";

export default defineConfig({
  // GitHub Pages serves the project under /<repo>/, so the demo build passes
  // PAGES_BASE=/comp-AI-on/. Local dev/build keeps "/".
  base: process.env.PAGES_BASE || "/",
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/lib\/api$/, replacement: path.resolve(__dirname, apiModule) },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  server: {
    port: 6769,
    proxy: {
      "/api": {
        target: "http://localhost:8765",
        changeOrigin: true,
      },
    },
  },
});
