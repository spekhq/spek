## 1. Shared scroll-offset util

- [x] 1.1 Add `packages/web/src/utils/scrollOffset.ts`: pure `anchorScrollTop(elementViewportTop, scrollY, offset)`, a `scrollOffset(doc?)` that measures the sticky header (`[data-spek-scroll-offset]`) → fixed app header (`header.fixed`) → constant fallback, and `scrollToAnchorId(id)`.
- [x] 1.2 Add `scrollOffset.test.ts` unit-testing `anchorScrollTop` and the `scrollOffset` fallback chain.

## 2. Wire consumers

- [x] 2.1 `ChangeDetail.tsx` hash effect: replace the hardcoded `HEADER_OFFSET = 80` scroll with `scrollToAnchorId(hash)`.
- [x] 2.2 `SpecDetail.tsx` hash effect: same replacement.
- [x] 2.3 `useScrollspy.ts`: use `scrollOffset()` for the active-heading threshold so the highlight tracks the header.
- [x] 2.4 `SpecToc.tsx`: consume the shared util for TOC click scrolling.
- [x] 2.5 `TabView.tsx`: mark the sticky tab-row container with `data-spek-scroll-offset`.

## 3. Verify

- [x] 3.1 `npm run type-check` clean.
- [x] 3.2 `node --import tsx --test packages/web/src/utils/scrollOffset.test.ts` green.
- [x] 3.3 `npm run build` succeeds.
- [ ] 3.4 Drive the running app: click a deep TOC heading on a Change detail with a tall sticky header; confirm the heading lands below the header (not the next section). Capture before/after for the PR.
