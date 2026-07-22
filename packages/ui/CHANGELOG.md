# Changelog

## 1.1.0

### Fixed

- **Topic grouping under worktree aggregation.** `changeTopicsMap()` keyed its result by the raw node
  id, so on an aggregated graph — where change nodes are `change:<worktreeKey>:<slug>` — the keys
  carried the worktree key while `buildLanes()` looked them up by plain slug. Nothing ever matched and
  every change fell into the no-topic lane. The timeline rendered normally either way, so it read as
  "this repo has no spec relationships" rather than as a bug. Reported from a downstream host
  ([#25](https://github.com/spekhq/spek/issues/25)); graphs from a single worktree were unaffected.

### Added

- **`changeNodeSlug(node)`** — resolves a graph change node to its slug, with the aggregation worktree
  key removed if present. `SpecGraph` and `changeTopicsMap` now share it, so they cannot drift apart
  again. If you normalise aggregated node ids yourself before calling `buildLanes()`, you no longer
  need to: keep the workaround or drop it, both work — stripping an already-stripped id is a no-op.

## 1.0.0

First release.

Extracted from `@spekjs/web`, where both visualizations were tangled with the web app's router, data
layer and theme context — and therefore unusable anywhere else.

### Added

- **`<SpecGraph>`** — the force-directed spec ↔ change graph (d3-force, with zoom, pan, node
  dragging, neighbour highlighting and fit-to-viewport).
- **`<ChangeTimeline>`** — the Gantt-style change lifecycle timeline (date axis with adaptive tick
  density, active bars running to today, dashed today line, hover tooltip, optional grouping by
  topic).
- **`buildLanes()` / `changeTopicsMap()`** and the timeline's scale helpers, exported as pure
  functions so a host can filter changes before laying them out.
- **A colour contract** — eight CSS custom properties with dark defaults, shipped in
  `@spekjs/ui/styles.css`. Overriding them is the whole of re-theming.

### Notes for hosts

- The components take data through props and report choices through callbacks. They have **no
  router**, **no data layer** and **no CSS framework**.
- `react`, `react-dom` and `@spekjs/core` are **peer** dependencies. Two React instances in one
  application break hooks, and the host and the package must agree on one definition of the types.
- Starts at `1.0.0` rather than `0.x` so that additive changes land as minors and `^1.0.0` picks
  them up — the same reasoning as `@spekjs/core`.
