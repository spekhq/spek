// 錨點捲動 / scrollspy 共用的置頂偏移。ChangeDetail 的 sticky header（change 標題 + tab 列，
// 高度會隨 worktree chips、Follow 控制、schema fallback 而變）遠高於過去寫死的 80px，導致點
// TOC 時目標 heading 捲到 header 底下被遮住、看起來跳到下一節。故此處以實際 DOM 動態量測遮蔽高度。

const GAP = 12; // heading 落在遮蔽底邊下方留一點呼吸空間
const APP_HEADER_HEIGHT = 56; // Layout 的 fixed app header（h-14）
const FALLBACK = APP_HEADER_HEIGHT + GAP; // 量不到任何 header 時的保底

/** 純計算：把目標元素捲到遮蔽下方所需的 window.scrollY（不為負）。 */
export function anchorScrollTop(elementViewportTop: number, scrollY: number, offset: number): number {
  return Math.max(0, elementViewportTop + scrollY - offset);
}

/**
 * 純計算：遮蔽元素「貼齊置頂後」的底邊。sticky 元素在頁面捲到最上緣時尚未貼齊（自然位置比 CSS
 * `top` 低一截，這裡是 main 的 padding-top 與 sticky top 的差），此時直接取 rect.bottom 會比捲動
 * 後的實際遮蔽多算一段，offset 就會隨當下捲動位置漂移 —— 錨點落點與 scrollspy 判定線因而對不齊。
 * 改以 CSS `top` + 自身高度換算貼齊後的底邊；元素隨父容器捲出畫面時 rect.bottom 才是真正的底邊，
 * 故取兩者較小值。fixed app header（top: 0）兩式同值。
 */
export function pinnedBottom(rect: { bottom: number; height: number }, cssTop: number | null): number {
  if (cssTop === null) return rect.bottom;
  return Math.min(rect.bottom, cssTop + rect.height);
}

type Measurable = { getBoundingClientRect(): { bottom: number; height: number } };
type MinimalDoc = { querySelector(selector: string): Measurable | null };
type CssTopReader = (el: Measurable) => number | null;

/** 讀 sticky / fixed 元素的 CSS `top`；`auto`（如 static 元素）或非瀏覽器環境回 null。 */
const domCssTop: CssTopReader = (el) => {
  if (typeof Element === "undefined" || !(el instanceof Element)) return null;
  const top = parseFloat(window.getComputedStyle(el).top);
  return Number.isNaN(top) ? null : top;
};

/**
 * 目前置頂遮蔽的底邊（viewport px）+ 一點 gap：
 * 優先取內容區的 sticky header（`[data-spek-scroll-offset]`，即 ChangeDetail 的 tab 列容器），
 * 否則退回全域 fixed app header（`[data-spek-app-header]`），皆無則用保底常數。
 */
export function scrollOffset(doc: MinimalDoc = document, cssTop: CssTopReader = domCssTop): number {
  const obstruction =
    doc.querySelector("[data-spek-scroll-offset]") ?? doc.querySelector("[data-spek-app-header]");
  if (!obstruction) return FALLBACK;
  return pinnedBottom(obstruction.getBoundingClientRect(), cssTop(obstruction)) + GAP;
}

/** 平滑捲到指定 id 的元素（存在才捲）；回傳是否找到，供 retry 迴圈判斷。 */
export function scrollToAnchorId(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = anchorScrollTop(el.getBoundingClientRect().top, window.scrollY, scrollOffset());
  window.scrollTo({ top, behavior: "smooth" });
  return true;
}
