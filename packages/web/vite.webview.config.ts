import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // This build draws. The webview loads its entry as a module and its CSP admits webview.cspSource
  // alongside the nonce, so a dynamic import resolves to a chunk that ships inside the vsix and is
  // fetched only when a document actually holds a diagram. See packages/vscode/src/panel.ts.
  define: { __SPEK_DRAWS_DIAGRAMS__: "true" },
  build: {
    outDir: path.resolve(__dirname, "../vscode/webview"),
    emptyOutDir: true,
    // 產出 IIFE 格式（非 ESM），避免 Webview CSP 問題
    rollupOptions: {
      input: path.resolve(__dirname, "index.webview.html"),
      output: {
        // ESM, not IIFE: IIFE cannot code-split, so `import("mermaid")` would be inlined into the entry
        // (+5.23 MB measured). Chunk names are hashed because there are now many of them and the host
        // reads the generated HTML rather than hard-coding a filename.
        format: "es",
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
