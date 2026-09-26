import { visit } from "unist-util-visit";
import type { Root, Element, ElementContent, Parent } from "hast";

/**
 * Rewrites a ` ```mermaid ` fenced block into the element the renderer draws as a diagram.
 *
 * **Why a rehype plugin rather than the `code` component.** `MarkdownRenderer`'s component map cannot do
 * this cleanly: whatever `code` returns is still wrapped by the `pre` component, so a diagram would be
 * drawn inside a bordered, monospaced code block. Replacing the whole `<pre>` is only possible from the
 * tree. A remark (mdast) plugin is no better — the block is a `code` node there and the `<pre>` is added
 * afterwards by `mdast-util-to-hast`, so the same problem arrives one stage later.
 *
 * **Why it runs first.** Placed ahead of `rehypeHighlightNarrow`, the highlighter never sees a mermaid
 * block, so there is no tokenised markup to undo and no wasted work. It touches no headings and removes
 * none, so `rehypeSpekHeadingIds`' dedup counter sees the same traversal either way.
 *
 * **Matching.** The language is compared case-insensitively: fence info strings are written
 * inconsistently, and a diagram that draws on the host a reader came from must not render as source
 * here. Detection is by the declared language only — a block that declares nothing is never inspected
 * for diagram-looking text, because a viewer that guesses shows the reader something the document does
 * not say.
 */

export const MERMAID_LANGUAGE = "mermaid";

/** The data attribute the renderer's `div` override keys on. */
export const MERMAID_MARKER = "data-spek-mermaid";

interface HastNodeLike {
  type: string;
  value?: string;
  children?: HastNodeLike[];
}

/** The concatenated text of a node, which for a fenced block is its source verbatim. */
function textOf(node: HastNodeLike): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

/** The declared language of a `<code>` element, lowercased, or null if it declares none. */
function languageOf(node: Element): string | null {
  const className = node.properties?.className;
  const list = Array.isArray(className)
    ? className
    : typeof className === "string"
      ? className.split(/\s+/)
      : [];
  for (const entry of list) {
    if (typeof entry === "string" && entry.toLowerCase().startsWith("language-")) {
      return entry.slice("language-".length).toLowerCase();
    }
  }
  return null;
}

/** True if this `<pre>` holds exactly one `<code>` declaring the mermaid language. */
function mermaidCodeOf(node: Element): Element | null {
  if (node.tagName !== "pre") return null;
  const elements = node.children.filter((child): child is Element => child.type === "element");
  if (elements.length !== 1) return null;
  const code = elements[0];
  if (code.tagName !== "code") return null;
  return languageOf(code) === MERMAID_LANGUAGE ? code : null;
}

export function rehypeSpekMermaid() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;
      const code = mermaidCodeOf(node);
      if (!code) return;
      // mdast-util-to-hast appends a trailing newline to every code block's text. It is the fence's
      // terminator, not part of the diagram, and Mermaid is whitespace-sensitive enough that leaving it
      // is not worth finding out about later.
      const source = textOf(code).replace(/\n$/, "");
      const replacement: ElementContent = {
        type: "element",
        tagName: "div",
        properties: { [MERMAID_MARKER]: "" },
        children: [{ type: "text", value: source }],
      };
      parent.children[index] = replacement;
    });
  };
}
