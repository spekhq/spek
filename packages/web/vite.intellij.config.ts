import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/spek/webview/",
  build: {
    outDir: path.resolve(__dirname, "../intellij/src/main/resources/webview"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.intellij.html"),
      output: {
        format: "iife",
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
        manualChunks: undefined,
      },
    },
  },
});
