import { specRoute, type SpecTreeNode } from "@spekjs/core/spec-topic";
import type { Heading, SpecInfo } from "@spekjs/core";

/** One child row under a spec folder: a child topic, or one of the folder's own spec headings. */
export type SpecFolderChild =
  | { kind: "folder"; node: SpecTreeNode<SpecInfo> }
  | { kind: "heading"; topic: string; heading: Heading };

/**
 * What a folder expands to: child topics first, then its own spec's headings in document order — the
 * way a file explorer lists folders before contents. `headings` is empty for a grouping-only folder.
 */
export function specFolderChildren(node: SpecTreeNode<SpecInfo>, headings: Heading[]): SpecFolderChild[] {
  return [
    ...node.children.map((child) => ({ kind: "folder" as const, node: child })),
    ...(node.spec ? headings.map((heading) => ({ kind: "heading" as const, topic: node.path, heading })) : []),
  ];
}

export function headingRoute(topic: string, heading: Heading): string {
  return `${specRoute(topic)}#${heading.slug}`;
}
