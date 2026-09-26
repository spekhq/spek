import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The one build that draws diagrams. It is a real ESM build, so Mermaid lands in lazy chunks that a
  // repository with no diagrams never fetches. See utils/mermaidUnavailable.ts for why the three
  // single-file builds do not.
  define: { __SPEK_DRAWS_DIAGRAMS__: "true" },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
