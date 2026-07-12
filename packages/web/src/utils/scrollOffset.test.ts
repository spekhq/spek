import { test } from "node:test";
import assert from "node:assert/strict";
import { anchorScrollTop, pinnedBottom, scrollOffset } from "./scrollOffset.js";

test("anchorScrollTop: elementTop + scrollY - offset, floored at 0", () => {
  assert.equal(anchorScrollTop(553, 0, 236), 317);
  assert.equal(anchorScrollTop(100, 271, 236), 135);
  // 已在頂端附近、算出負值 → 夾到 0
  assert.equal(anchorScrollTop(10, 0, 236), 0);
});

test("pinnedBottom: sticky 尚未貼齊時換算成貼齊後的底邊", () => {
  // 頁面在最上緣：tab 列還在自然位置（bottom 240），貼齊後應是 top(56) + height(168) = 224
  assert.equal(pinnedBottom({ bottom: 240, height: 168 }, 56), 224);
  // 已貼齊：兩式同值
  assert.equal(pinnedBottom({ bottom: 224, height: 168 }, 56), 224);
  // 隨父容器捲出畫面：rect.bottom 才是真正的遮蔽底邊
  assert.equal(pinnedBottom({ bottom: 100, height: 168 }, 56), 100);
  // 讀不到 CSS top（例如 static 元素）→ 退回 rect.bottom
  assert.equal(pinnedBottom({ bottom: 240, height: 168 }, null), 240);
});

type FakeEl = { bottom: number; height: number; cssTop: number | null };
type Measurable = { getBoundingClientRect(): { bottom: number; height: number } };

/** 依 selector 對照表產生假的 document，以及對應的 CSS top 讀取器 */
function fake(map: Record<string, FakeEl>) {
  const cssTops = new Map<Measurable, number | null>();
  const doc = {
    querySelector(selector: string): Measurable | null {
      const spec = map[selector];
      if (spec === undefined) return null;
      const el: Measurable = {
        getBoundingClientRect: () => ({ bottom: spec.bottom, height: spec.height }),
      };
      cssTops.set(el, spec.cssTop);
      return el;
    },
  };
  const cssTop = (el: Measurable) => cssTops.get(el) ?? null;
  return { doc, cssTop };
}

test("scrollOffset: prefers the sticky content header, measured as if pinned", () => {
  // 頁面在最上緣、sticky 尚未貼齊（bottom 240）→ 仍算出貼齊後的 224 + gap
  const { doc, cssTop } = fake({
    "[data-spek-scroll-offset]": { bottom: 240, height: 168, cssTop: 56 },
    "[data-spek-app-header]": { bottom: 56, height: 56, cssTop: 0 },
  });
  assert.equal(scrollOffset(doc, cssTop), 236);
});

test("scrollOffset: falls back to the fixed app header when no sticky header", () => {
  const { doc, cssTop } = fake({ "[data-spek-app-header]": { bottom: 56, height: 56, cssTop: 0 } });
  assert.equal(scrollOffset(doc, cssTop), 68);
});

test("scrollOffset: fallback constant when neither header is present", () => {
  const { doc, cssTop } = fake({});
  assert.equal(scrollOffset(doc, cssTop), 68);
});
