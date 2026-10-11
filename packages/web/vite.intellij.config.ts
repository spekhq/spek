import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/spek/webview/",
  // This build draws. The built-in server already serves everything under /spek/webview/, so the
  // chunks a dynamic import produces need no new route.
  define: { __SPEK_DRAWS_DIAGRAMS__: "true" },
  build: {
    outDir: path.resolve(__dirname, "../intellij/src/main/resources/webview"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.intellij.html"),
      output: {
        // ESM for the same reason as the webview build: IIFE cannot code-split.
        format: "es",
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
