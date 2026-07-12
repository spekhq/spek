## 1. Shared scroll-offset util

- [x] 1.1 Add `packages/web/src/utils/scrollOffset.ts`: pure `anchorScrollTop(elementViewportTop, scrollY, offset)`, a `scrollOffset(doc?)` that measures the sticky header (`[data-spek-scroll-offset]`) → fixed app header (`[data-spek-app-header]`) → constant fallback, and `scrollToAnchorId(id)`.
- [x] 1.2 Add `scrollOffset.test.ts` unit-testing `anchorScrollTop` and the `scrollOffset` fallback chain.
- [x] 1.3 Add pure `pinnedBottom(rect, cssTop)` and have `scrollOffset` measure the obstruction **as if pinned** (CSS `top` + height, capped by `rect.bottom`): a sticky header sits below its pinned position while the page is at the very top, so `rect.bottom` alone makes the offset drift with the current scroll position and the anchor landing line stops matching the scrollspy threshold.

## 2. Wire consumers

- [x] 2.1 `ChangeDetail.tsx` hash effect: replace the hardcoded `HEADER_OFFSET = 80` scroll with `scrollToAnchorId(hash)`.
- [x] 2.2 `SpecDetail.tsx` hash effect: same replacement.
- [x] 2.3 `useScrollspy.ts`: use `scrollOffset()` for the active-heading threshold so the highlight tracks the header.
- [x] 2.4 `SpecToc.tsx`: consume the shared util for TOC click scrolling.
- [x] 2.5 `TabView.tsx`: mark the sticky tab-row container with `data-spek-scroll-offset`.
- [x] 2.6 `Layout.tsx`: mark the fixed app header with `data-spek-app-header` instead of selecting it by its Tailwind utility class (`header.fixed`), which would silently fall through to the constant if the class ever changed.

## 3. Scrollspy threshold

- [x] 3.1 Extract the active-entry pick into a pure `activeHeadingId(headings, threshold)` (`packages/web/src/utils/scrollspy.ts`) and unit-test it, including the case where the just-clicked heading sits exactly on the threshold line.
- [x] 3.2 Allow a few px of tolerance in the comparison: an anchor scroll parks the target heading *on* the threshold, so sub-pixel rounding of `getBoundingClientRect()` / the scroll position would otherwise leave the previous entry highlighted.

## 4. Verify

- [x] 4.1 `npm run type-check` clean.
- [x] 4.2 `npm test -w @spekjs/web` green.
- [x] 4.3 `npm run build` succeeds.
- [x] 4.4 Drive the running app: click a deep TOC heading on a Change detail with a tall sticky header; confirm the heading lands below the header (not the next section) **and** that the clicked TOC entry is the highlighted one, both from the top of the page and mid-scroll.
