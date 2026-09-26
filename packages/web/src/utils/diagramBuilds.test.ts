import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Which builds draw diagrams, and what that must not cost.
 *
 * Mermaid is about 5.2 MB. The risk it creates does not change with the delivery mechanism, but the
 * thing worth guarding does: the builds no longer avoid Mermaid, they *split* it. So what this asserts
 * is that it stays out of the **entry** bundle — the bytes every reader downloads before anything is
 * on screen — and arrives only as chunks fetched when a document actually holds a diagram.
 *
 * It is worth a test because nothing else fails when this regresses. An entry bundle eight times too
 * big passes type-check, lint and every behavioural test; it just makes the editor panel slow to open
 * and, for the demo, lands in a file committed to the repository.
 */

const webRoot = new URL("../../", import.meta.url);
const config = (name: string): string => readFileSync(fileURLToPath(new URL(name, webRoot)), "utf8");

/** Builds that draw: they split code, so Mermaid is a lazy chunk. */
const DRAWING_BUILDS = ["vite.config.ts", "vite.webview.config.ts", "vite.intellij.config.ts"];

/** The demo is a single self-contained file, committed on every release — it cannot split. */
const SOURCE_ONLY_BUILDS = ["vite.demo.config.ts"];

test("every build that can split code draws diagrams", () => {
  for (const name of DRAWING_BUILDS) {
    assert.match(
      config(name),
      /__SPEK_DRAWS_DIAGRAMS__:\s*"true"/,
      `${name} should draw: it emits ES modules and its host can load chunks`,
    );
  }
});

test("a drawing build must not be IIFE", () => {
  // IIFE cannot code-split, so `import("mermaid")` would be inlined into the entry — the 5.2 MB this
  // guard exists to keep out. The webview and IntelliJ builds were IIFE until diagrams landed.
  for (const name of DRAWING_BUILDS.filter((n) => n !== "vite.config.ts")) {
    assert.match(config(name), /format:\s*"es"/, `${name} must emit ES modules to split Mermaid out`);
    assert.equal(
      /format:\s*"iife"/.test(config(name)),
      false,
      `${name} is IIFE, so Mermaid would be inlined into the entry`,
    );
  }
});

test("the demo does not draw, and excludes Mermaid outright", () => {
  for (const name of SOURCE_ONLY_BUILDS) {
    assert.match(config(name), /__SPEK_DRAWS_DIAGRAMS__:\s*"false"/, `${name} cannot split code`);
    assert.match(
      config(name),
      /alias:\s*\{\s*mermaid:/,
      `${name} must alias Mermaid to the stand-in, or 5.2 MB ships in one committed file`,
    );
  }
});

test("the stand-in resolves to nothing", () => {
  const stub = readFileSync(fileURLToPath(new URL("mermaidUnavailable.ts", import.meta.url)), "utf8");
  assert.match(stub, /export default null;/);
  // Anchored to a statement, not the word: the module's comment explains what an inlined import costs.
  assert.equal(/^import\s/m.test(stub), false, "the stand-in must import nothing");
});

/**
 * The one assertion against reality rather than configuration. Skipped when the build output is not
 * present, so a plain `npm test` on a fresh clone does not fail on a missing artifact — CI and anyone
 * who has run a build get the check.
 */
test("Mermaid is not in the webview entry bundle", (t) => {
  const entry = fileURLToPath(new URL("../../../vscode/webview/assets/index.webview.js", import.meta.url));
  if (!existsSync(entry)) return t.skip("webview not built; run npm run build:webview");
  const text = readFileSync(entry, "utf8");
  for (const marker of ["dagre", "cytoscape", "katex", "sequenceDiagram"]) {
    assert.equal(
      text.includes(marker),
      false,
      `"${marker}" is in the entry bundle, so Mermaid was inlined rather than split`,
    );
  }
  // A generous ceiling: the entry was ~683 KB when diagrams landed, against ~5.9 MB inlined. This
  // catches the inlining regression, not ordinary growth.
  const bytes = statSync(entry).size;
  assert.ok(bytes < 2_000_000, `webview entry is ${bytes} B; Mermaid has probably been inlined`);
});
