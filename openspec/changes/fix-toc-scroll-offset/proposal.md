## Why

Clicking a TOC entry (or opening a deep-link hash) on the Change detail and Spec detail pages scrolled the target heading **behind** the sticky header, so the heading was hidden and the *next* section appeared at the top — looking like the click jumped one section too far. The scroll handlers hardcoded an 80px offset, but the Change detail sticky header (title + tab row, which grows with worktree chips, schema fallback, etc.) is taller than that.

## What Changes

- Add a shared `scrollOffset` util that measures the real sticky-header bottom at scroll time (content sticky header → fixed app header → constant fallback) instead of assuming a fixed 80px; its `anchorScrollTop` computation is pure and unit-tested.
- The Change detail and Spec detail hash-anchor effects and the scrollspy active-heading tracking all consume it, so both the scroll target and the highlighted TOC entry track the actual header height.
- Mark the Change detail sticky tab-row container with `data-spek-scroll-offset` so the util can find it.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `change-browsing`: "Change detail hash anchor navigation" — the target heading SHALL land in the visible area **below** the sticky header, not behind it.
- `spec-browsing`: "Spec detail hash anchor navigation" — same guarantee, measured against any sticky/fixed header rather than a fixed constant.

## Impact

- **Web UI**: new `packages/web/src/utils/scrollOffset.ts` (+ test); `ChangeDetail.tsx`, `SpecDetail.tsx` (hash effects), `useScrollspy.ts`, `SpecToc.tsx`, `TabView.tsx` (adds the marker attribute).
- No core/API/extension changes. No behavior change beyond scroll landing position.
