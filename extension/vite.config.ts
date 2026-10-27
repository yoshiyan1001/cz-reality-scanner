import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  server: {
    port: 5174,
    strictPort: true,
    // The content script's HMR client connects from https://www.sreality.cz.
    cors: { origin: [/chrome-extension:\/\//, "https://www.sreality.cz"] },
  },
});
