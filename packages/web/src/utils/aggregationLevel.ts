// Aggregation level: collapse the two dependent flags ("aggregate" and "include jj") into a single
// tri-state control. jj only has meaning when aggregation is on (with aggregate off,
// scanOpenSpecAggregated falls back to a single-directory scan and jj has no effect), so a level
// (rather than two independent checkboxes) structurally rules out the contradictory
// "aggregate off + jj on" state.
export type AggLevel = "off" | "worktrees" | "worktrees-jj";

/** Derive the level from the two boolean preferences. aggregate off is always "off" (regardless of jj). */
export function levelFromPrefs(aggregate: boolean, includeJj: boolean): AggLevel {
  if (!aggregate) return "off";
  return includeJj ? "worktrees-jj" : "worktrees";
}

/** Expand a level back into the two boolean preferences. "off" always forces jj off (no invalid combo). */
export function prefsFromLevel(level: AggLevel): { aggregate: boolean; includeJj: boolean } {
  switch (level) {
    case "off":
      return { aggregate: false, includeJj: false };
    case "worktrees":
      return { aggregate: true, includeJj: false };
    case "worktrees-jj":
      return { aggregate: true, includeJj: true };
  }
}

/**
 * Visibility of the aggregation-scope control given the detected worktree landscape.
 * Shown only when there is something to aggregate (more than one worktree, or jj detected); the
 * jj option is offered only when a jj workspace is present.
 */
export function scopeControlView(
  worktreeCount: number,
  hasJj: boolean,
): { visible: boolean; showJjOption: boolean } {
  return { visible: worktreeCount > 1 || hasJj, showJjOption: hasJj };
}
