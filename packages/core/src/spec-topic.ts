// A spec topic is the slash-separated directory path of a `spec.md` relative to its `specs/` root:
// `auth`, `contracts/pagination`, `contracts/pagination/streaming-search`. This module holds the rules
// about that string that every surface shares — which strings are topics at all, how they order, how one
// is shown and linked, and how a flat list becomes a folder tree.
//
// Pure logic with no runtime import, so it ships as the `@spekjs/core/spec-topic` subpath and can be
// value-imported from a browser bundle, the same arrangement as headings.ts. The Kotlin mirror of the
// validators is SpecTopic.kt.

// A segment never begins with `.` (which also rules out `.` and `..`): discovery skips dot-entries, so a
// dotted segment names nothing the list shows. No separator of either kind, no NUL, no control character
// — the last is what refuses `auth\n`.
const SEGMENT = "[^./\\\\\\x00-\\x1f\\x7f][^/\\\\\\x00-\\x1f\\x7f]*";
const TOPIC_RE = new RegExp(`^${SEGMENT}(?:/${SEGMENT})*$`);
const SLUG_RE = new RegExp(`^${SEGMENT}$`);

/**
 * True when `topic` is a well-formed spec topic: one or more non-empty relative segments joined by `/`.
 *
 * Syntax only. A well-formed topic can still name a path through a symlinked directory, which is why a
 * read also goes through `resolveSpecFile`; this function is the part of the rule a host can check
 * before it touches the filesystem, and the reason an HTTP host can tell 400 from 404.
 */
export function isSafeSpecTopic(topic: string): boolean {
  return TOPIC_RE.test(topic);
}

/**
 * True when `slug` can name a change directory: one segment, by the same rule as a topic segment.
 * `archive` is the archived changes' parent directory, not a change.
 */
export function isSafeChangeSlug(slug: string): boolean {
  return slug !== "archive" && SLUG_RE.test(slug);
}

/** UTF-16 code-unit order — OpenSpec's own spec ordering, and the one Kotlin's `sortedBy` reproduces. */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The final path segment: what a one-line label shows. The full topic stays the identity. */
export function specTopicLabel(topic: string): string {
  return topic.slice(topic.lastIndexOf("/") + 1);
}

/** The app route of a spec, each segment encoded on its own so the `/` between them stays a separator. */
export function specRoute(topic: string): string {
  return `/specs/${topic.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * One folder of the spec tree. `spec` is set when this path has its own `spec.md`; a node with only
 * `children` is a grouping folder that opens nothing.
 */
export interface SpecTreeNode<T> {
  /** This node's own segment — its label. */
  name: string;
  /** The full topic of this node, whether or not it holds a spec. */
  path: string;
  spec: T | null;
  children: SpecTreeNode<T>[];
}

/**
 * Group a flat list of specs into a folder tree.
 *
 * Siblings order per segment by code unit, not by full topic: by full topic `a-b` sorts between `a` and
 * its child `a/c` (`-` is 0x2D, `/` is 0x2F), which would split a folder from its own contents.
 */
export function buildSpecTree<T extends { topic: string }>(specs: readonly T[]): SpecTreeNode<T>[] {
  const roots: SpecTreeNode<T>[] = [];
  const byPath = new Map<string, SpecTreeNode<T>>();
  for (const spec of specs) {
    let siblings = roots;
    let prefix = "";
    let node: SpecTreeNode<T> | undefined;
    for (const segment of spec.topic.split("/")) {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      node = byPath.get(prefix);
      if (!node) {
        node = { name: segment, path: prefix, spec: null, children: [] };
        byPath.set(prefix, node);
        siblings.push(node);
      }
      siblings = node.children;
    }
    if (node) node.spec = spec;
  }
  const sort = (nodes: SpecTreeNode<T>[]) => {
    nodes.sort((a, b) => compareCodeUnits(a.name, b.name));
    for (const n of nodes) sort(n.children);
  };
  sort(roots);
  return roots;
}

/**
 * The tree restricted to specs passing `keep`, with every ancestor needed to reach them. An ancestor
 * that holds a spec of its own keeps it, so it stays openable even when only a child matched.
 */
export function pruneSpecTree<T>(
  nodes: readonly SpecTreeNode<T>[],
  keep: (spec: T) => boolean,
): SpecTreeNode<T>[] {
  const out: SpecTreeNode<T>[] = [];
  for (const node of nodes) {
    const children = pruneSpecTree(node.children, keep);
    if ((node.spec !== null && keep(node.spec)) || children.length > 0) {
      out.push({ ...node, children });
    }
  }
  return out;
}
