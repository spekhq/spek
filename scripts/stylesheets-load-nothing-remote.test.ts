/**
 * demo-page "Self-contained single-file demo": no stylesheet the page carries reaches a remote URL.
 *
 * The build's origin check sees elements only. The application's CSS travels inside the script bundle
 * and is injected at run time, so an `@import url("https://fonts…")` added to `global.css` — the
 * likeliest way the demo would start asking a third party for something again — would pass it. This
 * reads the project's own stylesheets, by glob so one added later is covered, and the font CSS the
 * build embeds.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFontFaceCss } from "./demo-fonts.js";
import { readFontSources } from "./demo-font-sources.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STYLE_ROOTS = ["packages/web/src", "packages/ui/src"];

/** The targets of every `url(…)` and `@import` in `css`, comments removed. */
function cssTargets(css: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const targets: string[] = [];
  for (const m of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g)) targets.push(m[1] ?? m[2] ?? m[3]);
  for (const m of source.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/g)) targets.push(m[1] ?? m[2]);
  return targets;
}

function isRemote(url: string): boolean {
  const value = url.trim();
  if (value.startsWith("//")) return true;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  return scheme !== null && scheme[1].toLowerCase() !== "data";
}

function remoteTargets(label: string, css: string): string[] {
  return cssTargets(css).filter(isRemote).map((url) => `${label}: ${url}`);
}

function stylesheets(dir: string): string[] {
  return fs
    .readdirSync(path.join(ROOT, dir), { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".css"))
    .map((f) => path.join(dir, f));
}

test("the check catches each way a stylesheet reaches a remote URL", () => {
  const cases = [
    '@import url("https://fonts.example.com/f.css");',
    "@import 'https://fonts.example.com/f.css';",
    "a { background: url(//cdn.example.com/bg.png) }",
    "@font-face { src: url('http://example.com/f.woff2') }",
  ];
  for (const css of cases) assert.equal(remoteTargets("fixture", css).length, 1, css);
  const fine = '@import "tailwindcss"; @import "@spekjs/ui/styles.css"; a{background:url(data:image/png;base64,AA)} b{mask:url(#arrow)} /* url(https://x) */';
  assert.deepEqual(remoteTargets("fixture", fine), []);
});

test("the project's own stylesheets reach no remote URL", () => {
  const files = STYLE_ROOTS.flatMap(stylesheets);
  assert.ok(files.length >= 2, `found the stylesheets (${files.join(", ")})`);
  const found = files.flatMap((f) => remoteTargets(f, fs.readFileSync(path.join(ROOT, f), "utf-8")));
  assert.deepEqual(found, []);
});

test("the font CSS the build embeds reaches no remote URL", () => {
  assert.deepEqual(remoteTargets("font CSS", buildFontFaceCss(readFontSources())), []);
});
