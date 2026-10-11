/**
 * The demo page's web font, as CSS that embeds it — so the page requests nothing to render in it
 * (demo-page "Self-contained single-file demo").
 *
 * The page used to link Google Fonts' `Plus Jakarta Sans:wght@400..800`, which resolves to four
 * `@font-face` rules over the normal-style variable font, one per subset. The same four woff2 files
 * ship in `@fontsource-variable/plus-jakarta-sans`, byte for byte; this module turns them into those
 * four rules under the family name `global.css` asks for, with Google's weight range, so nothing about
 * how the page renders changes except where the bytes come from. Only the normal style: the link
 * requested no italic axis, so emphasis was — and stays — synthesised by the browser.
 *
 * Pure, like `demo-html.ts`, so it is tested without running a build; `build-demo.ts` does the I/O.
 */

/** The family the application's stylesheet names (`packages/web/src/styles/global.css`). */
export const FONT_FAMILY = "Plus Jakarta Sans";

/** What Google Fonts declared for these files. */
const FONT_WEIGHT = "400 800";

export interface FontSources {
  /** The package's `wght.css`: one `@font-face` per subset and style, naming its file and range. */
  wghtCss: string;
  /** The package's `LICENSE` — the copyright notice and the OFL, which must travel with the font. */
  license: string;
  /** The `*-wght-normal.woff2` files, by file name. */
  files: Record<string, Uint8Array>;
}

const FONT_FACE_RE = /@font-face\s*\{([^}]*)\}/g;
const NORMAL_FILE_RE = /url\(\s*['"]?(?:\.\/)?files\/([^'")]+-wght-normal\.woff2)['"]?\s*\)/;
const UNICODE_RANGE_RE = /unicode-range\s*:\s*([^;]+);/;

/**
 * `@font-face` rules embedding each normal-style subset as a `data:` URL, preceded by the licence as a
 * comment. Throws when the package's CSS yields no normal rule, when its rules and the files given do
 * not match one for one, or when the licence would end the comment early — each would otherwise
 * produce a page without its font, silently.
 */
export function buildFontFaceCss({ wghtCss, license, files }: FontSources): string {
  if (license.includes("*/")) {
    throw new Error("the font licence contains */, which would end the CSS comment carrying it");
  }

  const rules: string[] = [];
  const used = new Set<string>();
  for (const match of wghtCss.matchAll(FONT_FACE_RE)) {
    const body = match[1];
    const file = NORMAL_FILE_RE.exec(body)?.[1];
    if (!file) continue;
    const range = UNICODE_RANGE_RE.exec(body)?.[1].trim();
    if (!range) throw new Error(`the font rule for ${file} declares no unicode-range`);
    const bytes = files[file];
    if (!bytes) throw new Error(`the font package's CSS names ${file}, which was not provided`);
    used.add(file);
    rules.push(
      "@font-face {\n" +
        `  font-family: "${FONT_FAMILY}";\n` +
        "  font-style: normal;\n" +
        `  font-weight: ${FONT_WEIGHT};\n` +
        "  font-display: swap;\n" +
        `  src: url(data:font/woff2;base64,${Buffer.from(bytes).toString("base64")}) format("woff2");\n` +
        `  unicode-range: ${range};\n` +
        "}",
    );
  }

  if (rules.length === 0) throw new Error("the font package's CSS has no rule for a *-wght-normal.woff2 file");
  const unused = Object.keys(files).filter((f) => !used.has(f));
  if (unused.length > 0) throw new Error(`no font rule uses ${unused.join(", ")}`);

  return `/*\n${license.trim()}\n*/\n${rules.join("\n")}\n`;
}
