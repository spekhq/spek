import { test } from "node:test";
import assert from "node:assert/strict";
import { anchorScrollTop, scrollOffset } from "./scrollOffset.js";

test("anchorScrollTop: elementTop + scrollY - offset, floored at 0", () => {
  assert.equal(anchorScrollTop(553, 0, 236), 317);
  assert.equal(anchorScrollTop(100, 271, 236), 135);
  // 已在頂端附近、算出負值 → 夾到 0
  assert.equal(anchorScrollTop(10, 0, 236), 0);
});

function fakeDoc(map: Record<string, number | undefined>): { querySelector(sel: string): { getBoundingClientRect(): { bottom: number } } | null } {
  return {
    querySelector(sel: string) {
      const bottom = map[sel];
      return bottom === undefined ? null : { getBoundingClientRect: () => ({ bottom }) };
    },
  };
}

test("scrollOffset: prefers the sticky content header bottom + gap", () => {
  // sticky header bottom 224 → 224 + 12
  assert.equal(scrollOffset(fakeDoc({ "[data-spek-scroll-offset]": 224, "header.fixed": 56 })), 236);
});

test("scrollOffset: falls back to the fixed app header when no sticky header", () => {
  assert.equal(scrollOffset(fakeDoc({ "header.fixed": 56 })), 68);
});

test("scrollOffset: fallback constant when neither header is present", () => {
  assert.equal(scrollOffset(fakeDoc({})), 96);
});
