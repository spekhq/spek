import { test } from "node:test";
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { rehypeSpekMermaid, MERMAID_MARKER } from "./mermaidBlocks";
import type { Root, Element } from "hast";

function tree(markdown: string): Root {
  const mdast = unified().use(remarkParse).parse(markdown);
  const hast = unified().use(remarkRehype).runSync(mdast) as Root;
  rehypeSpekMermaid()(hast);
  return hast;
}

function diagrams(root: Root): Element[] {
  const out: Element[] = [];
  const walk = (node: { type: string; children?: unknown[]; tagName?: string; properties?: Record<string, unknown> }) => {
    if (node.type === "element" && node.properties && MERMAID_MARKER in node.properties) {
      out.push(node as unknown as Element);
    }
    for (const child of (node.children ?? []) as typeof node[]) walk(child);
  };
  walk(root as unknown as Parameters<typeof walk>[0]);
  return out;
}

function tagNames(root: Root): string[] {
  const out: string[] = [];
  const walk = (node: { type: string; tagName?: string; children?: unknown[] }) => {
    if (node.type === "element" && node.tagName) out.push(node.tagName);
    for (const child of (node.children ?? []) as typeof node[]) walk(child);
  };
  walk(root as unknown as Parameters<typeof walk>[0]);
  return out;
}

test("a mermaid fence becomes a diagram element carrying its source", () => {
  const root = tree("```mermaid\ngraph TD\n  A-->B\n```\n");
  const found = diagrams(root);
  assert.equal(found.length, 1);
  assert.equal(found[0].children.length, 1);
  assert.equal((found[0].children[0] as { value: string }).value, "graph TD\n  A-->B");
});

test("the <pre> wrapper is gone, so the diagram is not drawn inside a code block", () => {
  const root = tree("```mermaid\ngraph TD\n  A-->B\n```\n");
  assert.equal(tagNames(root).includes("pre"), false);
  assert.equal(tagNames(root).includes("code"), false);
});

test("the fence's trailing newline is not part of the source", () => {
  const root = tree("```mermaid\ngraph TD\n```\n");
  assert.equal((diagrams(root)[0].children[0] as { value: string }).value, "graph TD");
});

test("the language is matched case-insensitively", () => {
  for (const spelling of ["Mermaid", "MERMAID", "mermaid"]) {
    const root = tree("```" + spelling + "\ngraph TD\n```\n");
    assert.equal(diagrams(root).length, 1, `${spelling} should be recognised`);
  }
});

test("another language is left alone", () => {
  const root = tree('```json\n{"a": 1}\n```\n');
  assert.equal(diagrams(root).length, 0);
  assert.equal(tagNames(root).includes("pre"), true);
});

test("a fence with no language is not inspected for diagram-looking text", () => {
  // Detecting by content would show the reader something the document does not say.
  const root = tree("```\ngraph TD\n  A-->B\n```\n");
  assert.equal(diagrams(root).length, 0);
  assert.equal(tagNames(root).includes("pre"), true);
});

test("inline code that says mermaid is not a diagram", () => {
  const root = tree("Use the `mermaid` package.\n");
  assert.equal(diagrams(root).length, 0);
});

test("several diagrams in one document each become their own element", () => {
  const root = tree("```mermaid\ngraph TD\n  A-->B\n```\n\ntext\n\n```mermaid\nsequenceDiagram\n```\n");
  const found = diagrams(root);
  assert.equal(found.length, 2);
  assert.equal((found[1].children[0] as { value: string }).value, "sequenceDiagram");
});

test("surrounding content is untouched", () => {
  const root = tree("## Heading\n\n```mermaid\ngraph TD\n```\n\nAfter the diagram.\n");
  const tags = tagNames(root);
  assert.ok(tags.includes("h2"));
  assert.ok(tags.includes("p"));
  assert.equal(diagrams(root).length, 1);
});
