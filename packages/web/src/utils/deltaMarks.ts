import type { DeltaMarks, RequirementMark, ScenarioMark } from "./deltaCompare";
import type { HastNode } from "./foldSections";

/** The hast property a marked heading carries; react-markdown hands it to the component as `data-spek-delta`. */
export const DELTA_MARK_PROP = "data-spek-delta";

export const DELTA_MARK_LABEL: Record<RequirementMark | ScenarioMark, string> = {
  new: "new",
  changed: "changed",
  same: "same as current spec",
  "renamed-only": "renamed only",
  "not-in-current-spec": "not in current spec",
};

// The delta-operation badge pairs (`markdown-renderer`), so the marks read in the same vocabulary: new is
// ADDED's, changed is MODIFIED's, dropped is REMOVED's. Those pairs are measured by hand in both themes
// (`contrast.test.ts`, NOT_MEASURED_HERE), on page surfaces — which is where these sit: inside a heading, a
// `summary`, or a requirement's folded body, none of which sets a background. The three "nothing to see"
// marks are deliberately quiet: muted text, which the automated table measures.
const PILL = "ml-2 px-1.5 py-0.5 rounded text-xs font-medium align-middle whitespace-nowrap";
export const DELTA_MARK_CLASS: Record<RequirementMark | ScenarioMark, string> = {
  new: `${PILL} bg-orange-500/20 text-badge-added`,
  changed: `${PILL} bg-blue-500/20 text-badge-modified`,
  same: `${PILL} border border-border text-text-muted`,
  "renamed-only": `${PILL} border border-border text-text-muted`,
  "not-in-current-spec": `${PILL} border border-border text-text-muted`,
};
const DROPPED_PILL = "mr-2 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-badge-removed";

export const isDeltaMark = (value: unknown): value is RequirementMark | ScenarioMark =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(DELTA_MARK_LABEL, value);

type Positioned = HastNode & { position?: { start?: { line?: number } } };

const text = (value: string): HastNode => ({ type: "text", value });
const code = (value: string): HastNode => ({ type: "element", tagName: "code", properties: {}, children: [text(value)] });

/**
 * The element listing a requirement's dropped scenarios. A `div`, not a `p`: the paragraph component runs BDD
 * keyword highlighting, which would paint an `ADDED` or `SHALL` inside a scenario's name. Each name is inline
 * code for the same reason, and because it is a name quoted from the source.
 */
function droppedElement(names: readonly string[]): HastNode {
  const children: HastNode[] = [
    { type: "element", tagName: "span", properties: { className: DROPPED_PILL }, children: [text("dropped")] },
  ];
  names.forEach((name, i) => {
    if (i > 0) children.push(text(", "));
    children.push(code(name));
  });
  children.push(
    text(" — in the current spec but not in this modification; OpenSpec refuses to archive a modification that drops a scenario."),
  );
  return {
    type: "element",
    tagName: "div",
    properties: { className: "mb-3 text-sm text-text-muted", dataSpekDropped: "" },
    children,
  };
}

/**
 * rehype plugin: put [marks] on the headings they belong to, by source line (`position.start.line`) — the
 * rendered text of a heading is not its source text, and a mark matched by text would vanish silently.
 *
 * Must run on the still-flat tree, after heading ids and before folding: headings are then root children, an
 * inserted dropped list becomes part of the requirement's folded body, and a marked scenario heading becomes
 * its `summary`, so its mark shows while folded.
 */
export function rehypeSpekDeltaMarks(marks?: DeltaMarks) {
  return (tree: HastNode) => {
    if (!marks || !tree.children) return;
    const out: HastNode[] = [];
    for (const node of tree.children as Positioned[]) {
      out.push(node);
      const line = node.position?.start?.line;
      if (node.type !== "element" || line === undefined) continue;
      const mark =
        node.tagName === "h3" ? marks.requirements.get(line) : node.tagName === "h4" ? marks.scenarios.get(line) : undefined;
      if (mark) node.properties = { ...node.properties, dataSpekDelta: mark };
      const dropped = node.tagName === "h3" ? marks.dropped.get(line) : undefined;
      if (dropped && dropped.length > 0) out.push(droppedElement(dropped));
    }
    tree.children = out;
  };
}
