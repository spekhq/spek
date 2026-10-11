import type { GraphNode } from "@spekjs/core";
import { specTopicLabel } from "@spekjs/core/spec-topic";

/**
 * The text a node shows. A spec shows its label's final segment, because a nested topic does not fit
 * under a node; its full topic is the node's tooltip and, through `specNodeTopic`, its identity. The
 * label, not the id, so a consumer's own label still shows.
 */
export function nodeDisplayLabel(node: GraphNode): string {
  return node.type === "spec" ? specTopicLabel(node.label) : node.label;
}
