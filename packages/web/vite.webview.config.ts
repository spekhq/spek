import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The webview loads the bundle from an extension URI, not the document origin; a relative base makes
  // Vite resolve the font against the script's own URL, which the CSP's font-src allows.
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "../vscode/webview"),
    emptyOutDir: true,
    // 產出 IIFE 格式（非 ESM），避免 Webview CSP 問題
    rollupOptions: {
      input: path.resolve(__dirname, "index.webview.html"),
      output: {
        format: "iife",
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
        // IIFE 不支援 code splitting，全部打進單一檔案
        manualChunks: undefined,
      },
    },
  },
});
