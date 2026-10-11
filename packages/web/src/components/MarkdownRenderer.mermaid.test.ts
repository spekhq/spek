import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ThemeProvider } from "../contexts/ThemeContext";

// A diagram reads the active theme, so rendering one needs a ThemeProvider. Every entry point (App /
// Webview / Intellij / Demo) already wraps one — that is not a new obligation, but it is a new reason
// the renderer has it, so these tests go through the provider rather than around it.
//
// ThemeProvider's initial read touches `window.matchMedia` (its localStorage read is already guarded).
// These tests run in plain node, so the one global it needs is supplied here. jsdom would be a
// heavier answer to a two-line question, and the repository has none.
(globalThis as { window?: unknown }).window ??= {
  matchMedia: () => ({ matches: false }),
};

// renderToStaticMarkup runs no effects, so what these assert is the state every diagram starts in —
// which is exactly the state a reader sees first, and the one that must not be a code block.
const render = (content: string): string =>
  renderToStaticMarkup(
    createElement(ThemeProvider, null, createElement(MarkdownRenderer, { content })),
  );

test("a mermaid fence renders as a diagram, not as a code block", () => {
  const html = render("```mermaid\ngraph TD\n  A-->B\n```\n");
  assert.match(html, /data-spek-diagram=/);
  // The `<pre>` the `pre` component would have produced is gone: delegation replaces the whole block.
  assert.equal(/class="[^"]*bg-bg-tertiary border border-border rounded-lg p-4 text-sm/.test(html), false);
  // And the highlighter never saw it.
  assert.equal(html.includes("hljs"), false);
  assert.equal(html.includes("language-mermaid"), false);
});

test("another language is still highlighted as code", () => {
  const html = render('```json\n{"name": 1}\n```\n');
  assert.match(html, /<pre/);
  assert.match(html, /hljs/);
  assert.equal(/data-spek-diagram=/.test(html), false);
});

test("a language-less fence is still a plain code block", () => {
  const html = render("```\ngraph TD\n  A-->B\n```\n");
  assert.match(html, /<pre/);
  assert.equal(/data-spek-diagram=/.test(html), false);
});

test("the source control is offered from the very first render", () => {
  // `diagram-rendering` requires the source to be reachable, and the state a reader meets first is this
  // one — before anything has drawn, and including the case where nothing ever will.
  const html = render("```mermaid\ngraph TD\n  Ingest-->Normalise\n```\n");
  assert.match(html, /aria-label="Show source"/);
});

test("an ordinary div in the document is not treated as a diagram", () => {
  const html = render("<div>plain</div>\n\ntext\n");
  assert.equal(/data-spek-diagram=/.test(html), false);
});

test("heading ids are unchanged by the presence of a diagram", () => {
  const withDiagram = render("## Requirement: Foo\n\n```mermaid\ngraph TD\n```\n\n## Requirement: Foo\n");
  const without = render("## Requirement: Foo\n\ntext\n\n## Requirement: Foo\n");
  // The dedup counter must see the same traversal either way, or every anchor after a diagram moves.
  for (const id of ['id="requirement-foo"', 'id="requirement-foo-2"']) {
    assert.ok(withDiagram.includes(id), `${id} missing with a diagram present`);
    assert.ok(without.includes(id), `${id} missing without one`);
  }
});

test("content around a diagram renders normally", () => {
  const html = render("## Before\n\n```mermaid\ngraph TD\n```\n\nAfter the diagram.\n");
  assert.match(html, /<h2[^>]*>Before<\/h2>/);
  assert.match(html, /After the diagram\./);
});

test("two diagrams in one document each get their own element", () => {
  const html = render("```mermaid\ngraph TD\n```\n\ntext\n\n```mermaid\nsequenceDiagram\n```\n");
  assert.equal(html.match(/data-spek-diagram=/g)?.length, 2);
});

test("BDD keywords inside a diagram are not highlighted", () => {
  // A diagram's labels are diagram source, not prose. The keyword rules apply to the document.
  const html = render("```mermaid\ngraph TD\n  A[WHEN the request arrives]-->B\n```\n");
  assert.equal(html.includes("bg-kw-when"), false);
  assert.equal(html.includes("--color-kw-when"), false);
});

test("an unparseable diagram does not stop the document rendering", () => {
  // Whether Mermaid can parse this is decided at draw time, in a browser. What is asserted here is the
  // half that does not need one: nothing about the source reaches the renderer's own code path, so a
  // document holding garbage renders every other thing in it.
  const html = render(
    "## Before\n\n```mermaid\nthis is not a diagram ]][[\n```\n\n### After\n\nProse that must survive.\n",
  );
  assert.match(html, /<h2[^>]*>Before<\/h2>/);
  assert.match(html, /<h3[^>]*>After<\/h3>/);
  assert.match(html, /Prose that must survive\./);
  assert.match(html, /data-spek-diagram=/);
});

test("a broken diagram and a valid one are separate elements with separate state", () => {
  // Each diagram owns its own reducer, so one failing cannot put another into the failed state. The
  // markup is where that independence is observable without a browser.
  const html = render("```mermaid\n]][[\n```\n\n```mermaid\ngraph TD\n  A-->B\n```\n");
  const containers = html.match(/data-spek-diagram="[a-z]+"/g) ?? [];
  assert.equal(containers.length, 2);
  // Both start in the same state — neither inherits anything from the other.
  assert.deepEqual([...new Set(containers)], ['data-spek-diagram="idle"']);
});

test("markup in a diagram's source does not reach the page as markup", () => {
  // Diagram source comes from a repository and is rendered by hosts with more privilege than a browser
  // tab. Before anything is drawn the source is inert text; after, Mermaid's strict security level
  // encodes it. This asserts the half that does not need a browser: nothing in the source reaches the
  // document as an element on the renderer's own path.
  const html = render(
    "```mermaid\ngraph TD\n  A[<script>alert(1)</script>]-->B\n```\n",
  );
  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("alert(1)") && !html.includes("&lt;script&gt;"), false);
});

test("an html-looking label in a source view is escaped", () => {
  const html = render("```mermaid\ngraph TD\n  A[<img onerror=x>]-->B\n```\n");
  assert.equal(html.includes("<img"), false);
});

test("the diagram container resets overflow-wrap", () => {
  // Not cosmetic, and not something any other test in this repo could catch. MarkdownRenderer sets
  // `overflow-wrap: anywhere` on `.markdown-body`, which inherits into the HTML labels Mermaid puts
  // inside `foreignObject`. Mermaid measures each label and then fixes the box around it, so an
  // inherited "break anywhere" wraps a long single word — `MermaidDiagram` breaks after
  // `MermaidDiagra` — onto a second line outside a box sized for one, and the browser paints no
  // second line. The DOM still holds the whole string, so `textContent` looks correct while the
  // reader sees a truncated label; it was found by looking at the rendered page, not by a test.
  const html = render("```mermaid\ngraph TD\n  A[MermaidDiagram] --> B\n```\n");
  assert.match(html, /\[overflow-wrap:normal\]/);
});
