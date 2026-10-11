import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

test("the webview build resolves its chunks relative to itself", () => {
  // Vite's preload helper builds a lazy chunk's dependency URLs from the base. The default "/" resolves
  // against the vscode-webview:// origin, where nothing is served, so the first diagram on a page failed
  // with "Unable to preload CSS". Only a real VS Code host shows this: a browser serving the build from an
  // origin root resolves "/assets/" either way. IntelliJ's absolute "/spek/webview/" is correct for the
  // built-in server that serves it.
  assert.match(config("vite.webview.config.ts"), /base:\s*"\.\/"/);
});

/**
 * The assertions against reality rather than configuration, one per drawing host's entry bundle.
 *
 * Outside CI a missing artifact is a skip, so a plain `npm test` on a fresh clone does not fail on a
 * build it never ran. **In CI it is a failure**: the Node gates build both webviews before testing, and a
 * guard that quietly skips there is a guard that never runs — which is what this one did when it shipped.
 */
const ENTRY_BUNDLES = [
  { name: "VS Code webview", path: "../../../vscode/webview/assets/index.webview.js", script: "build:webview" },
  {
    name: "IntelliJ webview",
    path: "../../../intellij/src/main/resources/webview/assets/index.intellij.js",
    script: "build:intellij",
  },
];

for (const bundle of ENTRY_BUNDLES) {
  test(`Mermaid is not in the ${bundle.name} entry bundle`, (t) => {
    const entry = fileURLToPath(new URL(bundle.path, import.meta.url));
    if (!existsSync(entry)) {
      const message = `${bundle.name} not built; run npm run ${bundle.script}`;
      if (process.env.CI) assert.fail(`${message} (CI must build it before testing)`);
      return t.skip(message);
    }
    const text = readFileSync(entry, "utf8");
    for (const marker of ["dagre", "cytoscape", "katex", "sequenceDiagram"]) {
      assert.equal(
        text.includes(marker),
        false,
        `"${marker}" is in the ${bundle.name} entry bundle, so Mermaid was inlined rather than split`,
      );
    }
    // A generous ceiling: the entry was ~683 KB when diagrams landed, against ~5.9 MB inlined. This
    // catches the inlining regression, not ordinary growth.
    const bytes = statSync(entry).size;
    assert.ok(bytes < 2_000_000, `${bundle.name} entry is ${bytes} B; Mermaid has probably been inlined`);
  });
}

/**
 * Every token handed to Mermaid must exist in the **built** stylesheet, in both themes. The palette is
 * read by JavaScript at draw time, so no utility class needs it, and Tailwind v4 drops an `@theme`
 * variable no class references: the categorical ramp vanished from the dark theme, and pie slices fell
 * back to Mermaid's surface-derived near-black, while every source-reading test passed. `global.css`
 * now declares `@theme static`; this reads what actually ships. Same CI rule as the entry-bundle checks.
 */
test("every token handed to Mermaid is in the built stylesheet, in both themes", async (t) => {
  const { DIAGRAM_COLORS } = await import("./diagramTheme");
  const assetsDir = fileURLToPath(new URL("../../../vscode/webview/assets/", import.meta.url));
  const cssFile = existsSync(assetsDir) ? readdirSync(assetsDir).find((f) => f.endsWith(".css")) : undefined;
  if (!cssFile) {
    const message = "VS Code webview not built; run npm run build:webview";
    if (process.env.CI) assert.fail(`${message} (CI must build it before testing)`);
    return t.skip(message);
  }
  const built = readFileSync(`${assetsDir}${cssFile}`, "utf8").toLowerCase();
  // The value each theme declares in source, read from the same two blocks contrast.test.ts measures.
  // A presence check is not enough: the ramp's light values shipped while its dark ones did not.
  const source = readFileSync(fileURLToPath(new URL("../styles/global.css", import.meta.url)), "utf8");
  const block = (selector: string) => new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(source)?.[1] ?? "";
  const valueIn = (body: string, token: string) =>
    new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(body)?.[1]?.toLowerCase();
  const dark = block("@theme(?:\\s+static)?");
  const light = block('\\[data-theme="light"\\]');
  const tokens = [...new Set(Object.values(DIAGRAM_COLORS).map((c) => c.token))];
  for (const token of tokens) {
    for (const [theme, value] of [
      ["dark", valueIn(dark, token)],
      ["light", valueIn(light, token)],
    ] as const) {
      if (!value) continue; // light inherits a token it does not override
      // The minifier writes #ffffff as #fff, so either spelling is the declared value.
      const short = /^#(.)\1(.)\2(.)\3$/.exec(value);
      const spellings = short ? [value, `#${short[1]}${short[2]}${short[3]}`] : [value];
      assert.ok(
        spellings.some((v) => built.includes(`--color-${token}:${v}`)),
        `--color-${token} (${theme}, ${value}) is handed to Mermaid but missing from the built stylesheet`,
      );
    }
  }
});
