// Graph node id → change slug. The single place that reverses the id format scanner.ts writes.
//
// `buildGraphData` emits `change:<slug>`; `buildGraphDataAggregated` namespaces the id by the winning
// worktree — `change:<worktreeKey>:<slug>` — and attaches `source` to exactly those nodes. The id alone
// is therefore ambiguous (nothing distinguishes a worktree key from the head of a slug), so the node,
// not a bare string, is the input: `source` is what says whether a key is present.
//
// Pure logic with no runtime import — the type import erases — so it ships as the
// `@spekjs/core/graph-node-id` subpath and can be value-imported from a browser bundle or a host's main
// process, the same arrangement as artifact-order.ts. It lives beside scanner.ts on purpose: producer
// and parser in different packages is what allowed issue #25.

import type { GraphNode } from "./types.js";

const CHANGE_PREFIX = "change:";

/**
 * Resolve a change node's slug, with the aggregation worktree key removed if there is one.
 *
 * Returns the id unchanged for anything that isn't a change node id.
 */
export function changeNodeSlug(node: GraphNode): string {
  const rest = node.id.startsWith(CHANGE_PREFIX)
    ? node.id.slice(CHANGE_PREFIX.length)
    : node.id;

  const key = node.source?.key;
  // `startsWith` is load-bearing, not defensive noise: a host that already normalised its ids while
  // keeping `source` would otherwise lose the first `key.length + 1` characters of every slug.
  if (key && rest.startsWith(`${key}:`)) {
    return rest.slice(key.length + 1);
  }
  return rest;
}
