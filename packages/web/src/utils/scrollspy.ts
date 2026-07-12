// scrollspy 的判定線與錨點捲動共用同一條偏移線（sticky header 底邊，見 scrollOffset.ts）。因為
// 剛用 TOC 捲到的 heading 恰好停在那條線上，比較時留一點容差吸收次像素誤差（getBoundingClientRect
// 回浮點、捲動位置又會被裝置像素捨入），否則 highlight 會漏掉使用者剛點的那一項、停在前一項。
const TOLERANCE = 4;

export interface HeadingTop {
  id: string;
  /** heading 目前的 viewport top；該 heading 尚未 render 時為 null */
  top: number | null;
}

/** 純計算：挑出最後一個已越過判定線的 heading id；都還沒越線時回第一個。 */
export function activeHeadingId(headings: readonly HeadingTop[], threshold: number): string | null {
  let lastAbove: string | null = null;
  for (const { id, top } of headings) {
    if (top === null) continue;
    if (top <= threshold + TOLERANCE) {
      lastAbove = id;
    } else {
      break;
    }
  }
  return lastAbove ?? headings[0]?.id ?? null;
}
