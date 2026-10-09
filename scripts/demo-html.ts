/**
 * Assembles the single-file demo page and proves it parses back as written.
 *
 * The page embeds four values: the title, the OpenSpec payload, and the application's script and
 * stylesheet. Where each element ends is decided by the HTML tokenizer, not by the build — `</script`
 * ends a script, and `<!--` followed by `<script` makes a later `</script` stop ending it — so a value
 * holding the wrong sequence silently restructures the page (#54). The payload and the title come
 * from content the build does not control, so they are encoded until no spelling of them is markup.
 * The script and stylesheet are the project's own output and cannot be re-encoded without changing
 * what they mean, so the assembled document is parsed and compared with what was written, and any
 * divergence fails the build instead of producing a page that cannot boot.
 *
 * Deliberately free of `packages/core/dist` imports and of import-time side effects: its tests run
 * under the root `npm test` without a core build, and `build-demo.ts` — which runs the whole build
 * when imported — is not importable by a test.
 */
import { parse, type DefaultTreeAdapterMap } from "parse5";

type ParsedNode = DefaultTreeAdapterMap["node"];

export type DemoHtmlPart = "title" | "stylesheet" | "payload" | "script";

export interface DemoHtmlParts {
  title: string;
  payload: unknown;
  script: string;
  /** Omitted or empty when the build emitted no CSS file (the demo's IIFE bundle injects its own). */
  stylesheet?: string;
}

/** An element the assembler wrote and the text it wrote into it, listed in document order. */
export interface IntendedElement {
  part: DemoHtmlPart;
  tag: "title" | "style" | "script";
  text: string;
}

const PART_LABEL: Record<DemoHtmlPart, string> = {
  title: "the page title",
  stylesheet: "the application stylesheet",
  payload: "the OpenSpec payload",
  script: "the application script",
};

export class DemoHtmlError extends Error {
  readonly part: DemoHtmlPart;

  constructor(part: DemoHtmlPart, detail: string) {
    const cause =
      part === "payload" || part === "title"
        ? "Its value is encoded before embedding so that nothing it says can do this — the encoding is at fault, not the content."
        : "The build cannot re-encode its own bundle without changing what it means — find the sequence in the source that emitted it.";
    super(`${PART_LABEL[part]} does not parse back as written: ${detail}. ${cause}`);
    this.name = "DemoHtmlError";
    this.part = part;
  }
}

/**
 * JSON for an inline `<script>`, with every `<` written as a `\u003c` escape. JSON's structural
 * tokens contain no `<`, so each one sits inside a string literal, where the escape denotes the same
 * character and the evaluated value is unchanged. With no `<` left there is no `</script`, `<!--` or
 * `<script` — the only sequences that move the script-data tokenizer out of its plain state. The one
 * other character it treats specially, U+0000, is already escaped by `JSON.stringify`.
 */
export function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Text for character-data content (`<title>` is RCDATA): markup and character references read literally. */
export function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The HTML input stream's own newline normalisation. The browser applies it too, so it is not a
 * divergence the build introduced. */
function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

const TRACKED_TAGS = new Set(["title", "style", "script"]);

function collectTracked(node: ParsedNode, out: { tag: string; text: string }[]): void {
  if ("tagName" in node && TRACKED_TAGS.has(node.tagName)) {
    out.push({
      tag: node.tagName,
      text: node.childNodes.map((child) => ("value" in child ? child.value : "")).join(""),
    });
  }
  if ("childNodes" in node) for (const child of node.childNodes) collectTracked(child, out);
  if ("content" in node) collectTracked(node.content, out);
}

function describeDivergence(tag: string, written: string, parsed: string): string {
  let i = 0;
  while (i < written.length && i < parsed.length && written[i] === parsed[i]) i++;
  const excerpt = (text: string) => JSON.stringify(text.slice(i, i + 48));
  if (i === parsed.length) {
    return `its <${tag}> element ends early, at offset ${i} of ${written.length}, where the written text reads ${excerpt(written)}`;
  }
  if (i === written.length) {
    const hint = tag === "script" ? " — look inside it for `<!--` followed by `<script`" : "";
    return `its <${tag}> element runs on past its end, taking in ${excerpt(parsed)}${hint}`;
  }
  return `its <${tag}> text differs at offset ${i}: written ${excerpt(written)}, parsed ${excerpt(parsed)}`;
}

/**
 * Throws a {@link DemoHtmlError} unless `html` parses into exactly the `<title>`, `<style>` and
 * `<script>` elements listed, in that order, each holding exactly its text. The error names the
 * **first** divergence in document order: a break adds or truncates elements *after* its cause, so
 * reporting a count, or the extra element, would blame the wrong part.
 */
export function verifyDemoHtml(html: string, intended: readonly IntendedElement[]): void {
  const parsed: { tag: string; text: string }[] = [];
  collectTracked(parse(html), parsed);

  for (let i = 0; i < Math.max(intended.length, parsed.length); i++) {
    const want = intended[i];
    const got = parsed[i];
    if (!want) {
      throw new DemoHtmlError(
        intended.at(-1)?.part ?? "script",
        `a <${got.tag}> element the build did not write follows it`,
      );
    }
    if (!got) throw new DemoHtmlError(want.part, `its <${want.tag}> element is missing`);
    if (got.tag !== want.tag) {
      throw new DemoHtmlError(want.part, `a <${got.tag}> element stands where its <${want.tag}> element should be`);
    }
    const written = normalizeNewlines(want.text);
    if (got.text !== written) throw new DemoHtmlError(want.part, describeDivergence(want.tag, written, got.text));
  }
}

/** The demo page, returned only once it is known to parse back as written; throws {@link DemoHtmlError} otherwise. */
export function assembleDemoHtml(parts: DemoHtmlParts): string {
  const payloadScript = `window.__DEMO_DATA__ = ${serializeForInlineScript(parts.payload)};`;
  const styleBlock = parts.stylesheet ? `\n    <style>${parts.stylesheet}</style>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtmlText(parts.title)}</title>${styleBlock}
  </head>
  <body>
    <div id="root"></div>
    <script>${payloadScript}</script>
    <script>${parts.script}</script>
  </body>
</html>`;

  const intended: IntendedElement[] = [{ part: "title", tag: "title", text: parts.title }];
  if (parts.stylesheet) intended.push({ part: "stylesheet", tag: "style", text: parts.stylesheet });
  intended.push({ part: "payload", tag: "script", text: payloadScript }, { part: "script", tag: "script", text: parts.script });
  verifyDemoHtml(html, intended);
  return html;
}
