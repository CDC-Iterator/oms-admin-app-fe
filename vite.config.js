import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Allow ngrok's tunnel subdomains through Vite's dev-server host check
    // (blocks unrecognized Host headers by default since Vite 5).
    allowedHosts: [".ngrok-free.app", ".ngrok.io", ".ngrok.app"],
  },
});
