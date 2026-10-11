/**
 * Reads the demo's web font from the installed `@fontsource-variable/plus-jakarta-sans` — the I/O half
 * of `demo-fonts.ts`, kept apart so that module stays pure. Shared by `build-demo.ts` and the test
 * that checks the embedded CSS reaches no remote URL. No side effects at import.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { FontSources } from "./demo-fonts.js";

const PACKAGE = "@fontsource-variable/plus-jakarta-sans";

export function readFontSources(): FontSources {
  const require = createRequire(import.meta.url);
  const root = path.dirname(require.resolve(`${PACKAGE}/package.json`));
  const filesDir = path.join(root, "files");
  const files: FontSources["files"] = {};
  for (const name of fs.readdirSync(filesDir).sort()) {
    if (name.endsWith("-wght-normal.woff2")) files[name] = fs.readFileSync(path.join(filesDir, name));
  }
  return {
    wghtCss: fs.readFileSync(path.join(root, "wght.css"), "utf-8"),
    license: fs.readFileSync(path.join(root, "LICENSE"), "utf-8"),
    files,
  };
}
