import { test } from "node:test";
import assert from "node:assert/strict";
import { FONT_FAMILY, buildFontFaceCss } from "./demo-fonts.js";

const face = (file: string, range: string) =>
  `@font-face {\n  font-family: 'Plus Jakarta Sans Variable';\n  font-style: normal;\n  font-display: swap;\n` +
  `  font-weight: 200 800;\n  src: url(./files/${file}) format('woff2-variations');\n  unicode-range: ${range};\n}\n`;

const WGHT_CSS =
  "/* plus-jakarta-sans-latin-ext-wght-normal */\n" +
  face("plus-jakarta-sans-latin-ext-wght-normal.woff2", "U+0100-02BA,U+1E00-1E9F") +
  "/* plus-jakarta-sans-latin-wght-normal */\n" +
  face("plus-jakarta-sans-latin-wght-normal.woff2", "U+0000-00FF,U+2000-206F");

const FILES = {
  "plus-jakarta-sans-latin-ext-wght-normal.woff2": new Uint8Array([1, 2, 3]),
  "plus-jakarta-sans-latin-wght-normal.woff2": new Uint8Array([4, 5, 6]),
};

const LICENSE = "Copyright 2020 The Plus Jakarta Sans Project Authors\n\nSIL OPEN FONT LICENSE Version 1.1\n";

const rulesOf = (css: string) => [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);

test("one rule per normal subset, under the application's family name and Google's weight range", () => {
  const rules = rulesOf(buildFontFaceCss({ wghtCss: WGHT_CSS, license: LICENSE, files: FILES }));
  assert.equal(rules.length, 2);
  for (const rule of rules) {
    assert.match(rule, new RegExp(`font-family: "${FONT_FAMILY}";`));
    assert.match(rule, /font-style: normal;/);
    assert.match(rule, /font-weight: 400 800;/);
    assert.match(rule, /font-display: swap;/);
  }
  assert.equal(FONT_FAMILY, "Plus Jakarta Sans");
});

test("each rule embeds its own file as a data: URL with the range the package declares for it", () => {
  const rules = rulesOf(buildFontFaceCss({ wghtCss: WGHT_CSS, license: LICENSE, files: FILES }));
  assert.match(rules[0], /src: url\(data:font\/woff2;base64,AQID\) format\("woff2"\);/);
  assert.match(rules[0], /unicode-range: U\+0100-02BA,U\+1E00-1E9F;/);
  assert.match(rules[1], /src: url\(data:font\/woff2;base64,BAUG\) format\("woff2"\);/);
  assert.match(rules[1], /unicode-range: U\+0000-00FF,U\+2000-206F;/);
});

test("the licence leads the CSS as a comment", () => {
  const css = buildFontFaceCss({ wghtCss: WGHT_CSS, license: LICENSE, files: FILES });
  assert.ok(css.startsWith(`/*\n${LICENSE.trim()}\n*/\n@font-face`));
});

test("italic rules in the package's CSS are not embedded", () => {
  const withItalic = WGHT_CSS + face("plus-jakarta-sans-latin-wght-italic.woff2", "U+0000-00FF");
  assert.equal(rulesOf(buildFontFaceCss({ wghtCss: withItalic, license: LICENSE, files: FILES })).length, 2);
});

test("a package CSS with no normal rule stops the build rather than embedding no font", () => {
  assert.throws(() => buildFontFaceCss({ wghtCss: "/* moved */", license: LICENSE, files: {} }), /no rule/);
});

test("rules and files must match one for one", () => {
  const { ["plus-jakarta-sans-latin-wght-normal.woff2"]: _latin, ...missing } = FILES;
  assert.throws(() => buildFontFaceCss({ wghtCss: WGHT_CSS, license: LICENSE, files: missing }), /not provided/);
  const extra = { ...FILES, "plus-jakarta-sans-greek-wght-normal.woff2": new Uint8Array([7]) };
  assert.throws(() => buildFontFaceCss({ wghtCss: WGHT_CSS, license: LICENSE, files: extra }), /no font rule uses/);
});

test("a licence that would close the comment carrying it stops the build", () => {
  assert.throws(() => buildFontFaceCss({ wghtCss: WGHT_CSS, license: "a */ b", files: FILES }), /\*\//);
});
