// 錨點捲動 / scrollspy 共用的置頂偏移。ChangeDetail 的 sticky header（change 標題 + tab 列，
// 高度會隨 worktree chips、Follow 控制、schema fallback 而變）遠高於過去寫死的 80px，導致點
// TOC 時目標 heading 捲到 header 底下被遮住、看起來跳到下一節。故此處以實際 DOM 動態量測遮蔽高度。

const GAP = 12; // heading 落在遮蔽底邊下方留一點呼吸空間
const FALLBACK = 96; // 量不到任何 header 時的保底（約 fixed app header + gap）

/** 純計算：把目標元素捲到遮蔽下方所需的 window.scrollY（不為負）。 */
export function anchorScrollTop(elementViewportTop: number, scrollY: number, offset: number): number {
  return Math.max(0, elementViewportTop + scrollY - offset);
}

type Measurable = { getBoundingClientRect(): { bottom: number } };
type MinimalDoc = { querySelector(selector: string): Measurable | null };

/**
 * 目前置頂遮蔽的底邊（viewport px）+ 一點 gap：
 * 優先取內容區的 sticky header（`[data-spek-scroll-offset]`，即 ChangeDetail 的 tab 列容器），
 * 否則退回全域 fixed app header，皆無則用保底常數。
 */
export function scrollOffset(doc: MinimalDoc = document): number {
  const sticky = doc.querySelector("[data-spek-scroll-offset]");
  if (sticky) return sticky.getBoundingClientRect().bottom + GAP;
  const appHeader = doc.querySelector("header.fixed");
  if (appHeader) return appHeader.getBoundingClientRect().bottom + GAP;
  return FALLBACK;
}

/** 平滑捲到指定 id 的元素（存在才捲）；回傳是否找到，供 retry 迴圈判斷。 */
export function scrollToAnchorId(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = anchorScrollTop(el.getBoundingClientRect().top, window.scrollY, scrollOffset());
  window.scrollTo({ top, behavior: "smooth" });
  return true;
}
