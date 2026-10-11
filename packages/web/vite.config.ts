import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { API_HOST, API_PORT, APP_PORT } from "./server/address";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The one build that draws diagrams. It is a real ESM build, so Mermaid lands in lazy chunks that a
  // repository with no diagrams never fetches. See utils/mermaidUnavailable.ts for why the three
  // single-file builds do not.
  define: { __SPEK_DRAWS_DIAGRAMS__: "true" },
  server: {
    // Loopback only, stated rather than inherited: the proxy below rewrites Host to the API's own, so a dev
    // server reachable from the network would reopen the API to it whatever the API itself checks.
    host: "localhost",
    port: APP_PORT,
    // The API admits exactly this app origin, so moving to another port would lock the app out of it.
    strictPort: true,
    // The app is same-origin with this server; no other page needs to read anything from it.
    cors: false,
    proxy: {
      "/api": {
        target: `http://${API_HOST}:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
