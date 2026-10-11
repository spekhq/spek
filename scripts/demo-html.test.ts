import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import {
  DemoHtmlError,
  DemoHtmlLoadError,
  assembleDemoHtml,
  findAbsolutePaths,
  verifyDemoOrigins,
  escapeHtmlText,
  serializeForInlineScript,
  verifyDemoHtml,
  type DemoHtmlPart,
  type IntendedElement,
} from "./demo-html.js";

type ParsedNode = DefaultTreeAdapterMap["node"];
type ParsedElement = DefaultTreeAdapterMap["element"];

// The oracle is parse5 read directly here, not the module's own walker, so a bug in the walker
// cannot agree with itself.
function elementsOf(html: string): ParsedElement[] {
  const out: ParsedElement[] = [];
  const visit = (node: ParsedNode) => {
    if ("tagName" in node) out.push(node);
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("content" in node) visit(node.content);
  };
  visit(parse(html));
  return out;
}

function textOf(element: ParsedElement): string {
  return element.childNodes.map((child) => ("value" in child ? child.value : "")).join("");
}

function scriptsOf(html: string): string[] {
  return elementsOf(html).filter((e) => e.tagName === "script").map(textOf);
}

function titleOf(html: string): string {
  const title = elementsOf(html).find((e) => e.tagName === "title");
  assert.ok(title, "the document has a <title>");
  return textOf(title);
}

/** What the viewer receives: the data script *evaluated*, which differs from `JSON.parse` (e.g. on a
 * `__proto__` key). Cloning brings the other realm's objects into this one, so `deepStrictEqual`
 * compares values rather than realms. */
function evaluatePayload(scriptText: string): unknown {
  const context: { window: Record<string, unknown> } = { window: {} };
  vm.runInNewContext(scriptText, context);
  return structuredClone(context.window.__DEMO_DATA__);
}

function isDemoHtmlError(part: DemoHtmlPart) {
  return (error: unknown) => {
    assert.ok(error instanceof DemoHtmlError, `expected a DemoHtmlError, got ${String(error)}`);
    assert.equal(error.part, part);
    return true;
  };
}

// The three shapes from #54 and its review. The third does not truncate the data script: it makes
// the element run on and swallow the bundle script after it.
const HOSTILE_TEXTS = {
  closingTag: "a JSON-LD block ends at </script> unless escaped",
  closingTagUpperWithSpace: "so does </SCRIPT > in any case",
  commentThenScript: "old pages hid code as <!-- and then <script> inside it",
};

function payloadWith(text: string) {
  // In a value and in a key: a record keyed by a spec topic or change slug carries its text in keys.
  return { specs: [{ topic: "sample", content: text }], details: { [text]: { total: 1 } } };
}

const SAFE_SCRIPT = "void 0;";

test("serializeForInlineScript leaves no '<' in its output", () => {
  for (const text of Object.values(HOSTILE_TEXTS)) {
    assert.ok(!serializeForInlineScript(payloadWith(text)).includes("<"));
  }
});

test("each hostile payload embeds as one intact data script that evaluates to the original", () => {
  for (const [name, text] of Object.entries(HOSTILE_TEXTS)) {
    const payload = payloadWith(text);
    const scripts = scriptsOf(assembleDemoHtml({ title: "t", payload, script: SAFE_SCRIPT }));
    assert.equal(scripts.length, 2, name);
    assert.equal(scripts[0], `window.__DEMO_DATA__ = ${serializeForInlineScript(payload)};`, name);
    assert.deepStrictEqual(evaluatePayload(scripts[0]), payload, name);
    assert.equal(scripts[1], SAFE_SCRIPT, name);
  }
});

test("control: embedding with plain JSON.stringify is broken by each hostile payload", () => {
  // Pins that the assertions above can see #54 at all: the same document with the escape undone
  // must fail them.
  for (const [name, text] of Object.entries(HOSTILE_TEXTS)) {
    const payload = payloadWith(text);
    const escaped = assembleDemoHtml({ title: "t", payload, script: SAFE_SCRIPT });
    const raw = escaped.replace(serializeForInlineScript(payload), () => JSON.stringify(payload));
    const scripts = scriptsOf(raw);
    const intact = scripts.length === 2 && scripts[0] === `window.__DEMO_DATA__ = ${JSON.stringify(payload)};`;
    assert.ok(!intact, `${name}: a raw embedding should not parse back intact`);
  }
});

test("the title reads back exactly as given and adds no element", () => {
  for (const title of ["</title><b>x</b>", "R&amp;D", "spek — OpenSpec Viewer Demo"]) {
    const html = assembleDemoHtml({ title, payload: {}, script: SAFE_SCRIPT });
    assert.equal(titleOf(html), title);
    assert.ok(!elementsOf(html).some((e) => e.tagName === "b"), `${title}: no <b> element`);
  }
});

test("escapeHtmlText escapes the three characters that can end or decode RCDATA text", () => {
  assert.equal(escapeHtmlText("a & b < c > d"), "a &amp; b &lt; c &gt; d");
  assert.equal(escapeHtmlText("spek — OpenSpec Viewer Demo"), "spek — OpenSpec Viewer Demo");
});

// A hand-built page for the verifier: it must judge documents the assembler would never produce.
function page(parts: { payloadText: string; script: string; stylesheet?: string }): string {
  const style = parts.stylesheet === undefined ? "" : `<style>${parts.stylesheet}</style>`;
  return (
    `<!DOCTYPE html><html><head><title>t</title>${style}</head><body><div id="root"></div>` +
    `<script>${parts.payloadText}</script><script>${parts.script}</script></body></html>`
  );
}

function intendedFor(parts: { payloadText: string; script: string; stylesheet?: string }): IntendedElement[] {
  return [
    { part: "title", tag: "title", text: "t" },
    ...(parts.stylesheet === undefined
      ? []
      : [{ part: "stylesheet", tag: "style", text: parts.stylesheet } satisfies IntendedElement]),
    { part: "payload", tag: "script", text: parts.payloadText },
    { part: "script", tag: "script", text: parts.script },
  ];
}

test("verifier: the raw #54 documents fail naming the payload and blaming its encoding", () => {
  for (const [name, text] of Object.entries(HOSTILE_TEXTS)) {
    const parts = { payloadText: `window.__DEMO_DATA__ = ${JSON.stringify(payloadWith(text))};`, script: SAFE_SCRIPT };
    assert.throws(() => verifyDemoHtml(page(parts), intendedFor(parts)), isDemoHtmlError("payload"), name);
    assert.throws(() => verifyDemoHtml(page(parts), intendedFor(parts)), /the encoding is at fault/, name);
  }
});

test("verifier: a stylesheet that closes itself and opens a script is named, not the script it produced", () => {
  const parts = { payloadText: "window.__DEMO_DATA__ = {};", script: SAFE_SCRIPT, stylesheet: "</style><script>x</script>" };
  assert.throws(() => verifyDemoHtml(page(parts), intendedFor(parts)), isDemoHtmlError("stylesheet"));
});

test("verifier: a raw NUL in the script fails, since the parser turns it into U+FFFD", () => {
  const parts = { payloadText: "window.__DEMO_DATA__ = {};", script: `x = "a${String.fromCharCode(0)}b";` };
  assert.throws(() => verifyDemoHtml(page(parts), intendedFor(parts)), isDemoHtmlError("script"));
});

test("verifier: CRLF and lone CR in the script pass, since the browser normalises them the same way", () => {
  const parts = { payloadText: "window.__DEMO_DATA__ = {};", script: "a = 1;\r\nb = 2;\rc = 3;" };
  assert.doesNotThrow(() => verifyDemoHtml(page(parts), intendedFor(parts)));
});

test("verifier: a well-formed page passes", () => {
  const parts = { payloadText: "window.__DEMO_DATA__ = {};", script: SAFE_SCRIPT, stylesheet: "a{color:red}" };
  assert.doesNotThrow(() => verifyDemoHtml(page(parts), intendedFor(parts)));
});

test("assembly: a script holding an unescaped </script> fails naming the script", () => {
  assert.throws(
    () => assembleDemoHtml({ title: "t", payload: {}, script: 'x = "a</script>b";' }),
    isDemoHtmlError("script"),
  );
});

test("assembly: a script holding <!-- then <script> with no --> between fails naming the script", () => {
  assert.throws(
    () => assembleDemoHtml({ title: "t", payload: {}, script: 'x = "<!-- <script>";' }),
    isDemoHtmlError("script"),
  );
});

test("assembly: inert placements of <!--, --> and <script are accepted", () => {
  // Today's bundle holds all three, each where the parser does not act on it — so the check must
  // follow the parser's rules, not ban the strings.
  const inert = [
    'a = "<script>"; b = "<!--";', // <script before any <!--
    'a = /<!--/; b = /-->/; c = "<script>";', // the comment is closed before <script
    'a = /<!--/; b = /<script(?=\\s|>)/;', // <script followed by "(" cannot enter the double-escaped state
  ];
  for (const script of inert) {
    const html = assembleDemoHtml({ title: "t", payload: {}, script });
    assert.equal(scriptsOf(html)[1], script);
  }
});

test("assembly: a stylesheet holding </style> fails naming the stylesheet", () => {
  assert.throws(
    () => assembleDemoHtml({ title: "t", payload: {}, script: SAFE_SCRIPT, stylesheet: "a{} </style> b{}" }),
    isDemoHtmlError("stylesheet"),
  );
});

test("assembly: a <style> element appears only when a stylesheet is given", () => {
  const without = assembleDemoHtml({ title: "t", payload: {}, script: SAFE_SCRIPT });
  assert.ok(!elementsOf(without).some((e) => e.tagName === "style"));
  const withCss = assembleDemoHtml({ title: "t", payload: {}, script: SAFE_SCRIPT, stylesheet: "a{color:red}" });
  const styles = elementsOf(withCss).filter((e) => e.tagName === "style");
  assert.deepEqual(styles.map(textOf), ["a{color:red}"]);
});

// Origins (demo-page "Self-contained single-file demo"). The verifier judges hand-written pages:
// through the assembler only a part breaking out can produce an element, and that is the structural
// check's to report.

function headWith(markup: string): string {
  return `<!DOCTYPE html><html><head><title>t</title>${markup}</head><body><div id="root"></div></body></html>`;
}

function isLoadError(fragment: string) {
  return (error: unknown) => {
    assert.ok(error instanceof DemoHtmlLoadError, `expected a DemoHtmlLoadError, got ${String(error)}`);
    assert.ok(error.message.includes(fragment), `"${error.message}" names ${fragment}`);
    return true;
  };
}

test("origins: an element loading from another origin fails, naming the element and the URL", () => {
  const cases: [string, string][] = [
    ['<link rel="preconnect" href="https://fonts.googleapis.com">', "https://fonts.googleapis.com"],
    ['<link rel="stylesheet" href="//cdn.example.com/a.css">', "//cdn.example.com/a.css"],
    ['<script src="https://cdn.example.com/a.js"></script>', "https://cdn.example.com/a.js"],
    ['<img src="data:image/png;base64,AAAA" srcset="data:image/png;base64,AAAA 1x, https://img.example.com/a.png 2x">', "https://img.example.com/a.png"],
    ['<video poster="https://img.example.com/p.png"></video>', "https://img.example.com/p.png"],
    ['<object data="http://example.com/o.swf"></object>', "http://example.com/o.swf"],
  ];
  for (const [markup, url] of cases) {
    assert.throws(() => verifyDemoOrigins(headWith(markup)), isLoadError(url), markup);
    const tag = markup.slice(1, markup.search(/[\s>]/));
    assert.throws(() => verifyDemoOrigins(headWith(markup)), isLoadError(`<${tag}`), markup);
  }
});

test("origins: data: URLs, same-page references and hyperlinks pass", () => {
  const ok = [
    '<link rel="icon" href="data:image/svg+xml,%3Csvg%3E%3C/svg%3E">',
    '<img src="data:image/png;base64,AAAA">',
    '<a href="https://github.com/spekhq/spek">source</a>',
    '<a href="#/specs">specs</a>',
  ];
  for (const markup of ok) assert.doesNotThrow(() => verifyDemoOrigins(headWith(markup)), markup);
});

test("origins: the assembled page loads nothing from another origin", () => {
  const html = assembleDemoHtml({ title: "t", payload: {}, script: SAFE_SCRIPT, fonts: "@font-face{}" });
  assert.doesNotThrow(() => verifyDemoOrigins(html));
  assert.ok(!html.includes("fonts.googleapis.com"));
});

test("assembly: a stylesheet that breaks out into a remote <link> is named as the stylesheet", () => {
  assert.throws(
    () => assembleDemoHtml({ title: "t", payload: {}, script: SAFE_SCRIPT, stylesheet: '</style><link rel="stylesheet" href="https://x.example/a.css">' }),
    isDemoHtmlError("stylesheet"),
  );
});

// The fonts part: a fifth embedded value, its own <style>, ahead of the application stylesheet.

test("assembly: the font CSS is its own <style>, before the application stylesheet, read back exactly", () => {
  const fonts = "/* licence */ @font-face{font-family:\"Plus Jakarta Sans\";src:url(data:font/woff2;base64,AAAA)}";
  const html = assembleDemoHtml({ title: "t", payload: {}, script: SAFE_SCRIPT, fonts, stylesheet: "a{color:red}" });
  const styles = elementsOf(html).filter((e) => e.tagName === "style");
  assert.deepEqual(styles.map(textOf), [fonts, "a{color:red}"]);
});

test("assembly: font CSS holding </style> fails naming the font CSS", () => {
  assert.throws(
    () => assembleDemoHtml({ title: "t", payload: {}, script: SAFE_SCRIPT, fonts: "a{} </style> b{}" }),
    (error: unknown) => isDemoHtmlError("fonts")(error) && /font CSS/.test((error as Error).message) && /font package/.test((error as Error).message),
  );
});

// Record paths (demo-page "The demo payload does not depend on the machine that built it").

test("findAbsolutePaths reports absolute record paths in POSIX, drive and UNC form, with their location", () => {
  const payload = {
    specs: [
      { topic: "a", path: "openspec/specs/a/spec.md" },
      { topic: "b", path: "/home/someone/repo/openspec/specs/b/spec.md" },
    ],
    schemaDetails: {
      "spec-driven": { path: "C:\\repo\\openspec\\schemas\\x", shadows: [{ source: "user", path: "\\\\server\\share\\x" }] },
      kept: { path: "@fission-ai/openspec/schemas/spec-driven", shadows: [] },
    },
  };
  assert.deepEqual(findAbsolutePaths(payload), [
    "specs[1].path",
    "schemaDetails.spec-driven.path",
    "schemaDetails.spec-driven.shadows[0].path",
  ]);
});

test("findAbsolutePaths leaves content alone: artifact text and change metadata are the author's", () => {
  const payload = {
    specs: [{ topic: "a", path: "openspec/specs/a/spec.md" }],
    specDetails: { a: { content: "run it against /home/someone/repo" } },
    changeDetails: { c: { metadata: { path: "/home/someone/repo" }, artifacts: [{ content: "C:\\repo" }] } },
  };
  assert.deepEqual(findAbsolutePaths(payload), []);
});

test("findAbsolutePaths tolerates a payload without the record lists", () => {
  assert.deepEqual(findAbsolutePaths({}), []);
});

// The notices part: plain text in a script element that never runs.

test("assembly: the notices are a text/plain script in <head>, read back exactly", () => {
  const notices = "Third-party software in this page\n\nreact@19.1.0 (MIT)\n\nMIT License <https://opensource.org/licenses/MIT>";
  const html = assembleDemoHtml({ title: "t", payload: {}, script: SAFE_SCRIPT, fonts: "a{}", notices });
  const element = elementsOf(html).find((e) => e.attrs.some((a) => a.name === "id" && a.value === "third-party-notices"));
  assert.ok(element, "the notices element exists");
  assert.equal(element.tagName, "script");
  assert.deepEqual(element.attrs.find((a) => a.name === "type")?.value, "text/plain");
  assert.equal(textOf(element), notices);
  assert.equal(scriptsOf(html).length, 3, "notices, payload, application");
});

test("assembly: notices holding </script> fail naming the notices", () => {
  assert.throws(
    () => assembleDemoHtml({ title: "t", payload: {}, script: SAFE_SCRIPT, notices: "a </script> b" }),
    (error: unknown) => isDemoHtmlError("notices")(error) && /licence files/.test((error as Error).message),
  );
});
