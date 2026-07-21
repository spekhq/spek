// 聚合層級：把「是否聚合」與「是否納入 jj」這兩個相依的旗標收斂成單一 tri-state 控制項。
// jj 只有在聚合開啟時才有意義（aggregate 關 → scanOpenSpecAggregated 退回單目錄掃描，jj 無效），
// 故用層級（而非兩個獨立勾選框）從結構上杜絕「aggregate off + jj on」這種矛盾狀態。
export type AggLevel = "off" | "worktrees" | "worktrees-jj";

/** 由現有的兩個布林偏好推導出層級。aggregate 關即為 off（不論 jj）。 */
export function levelFromPrefs(aggregate: boolean, includeJj: boolean): AggLevel {
  if (!aggregate) return "off";
  return includeJj ? "worktrees-jj" : "worktrees";
}

/** 由層級展開回兩個布林偏好。off 一律 jj=false，杜絕無效組合。 */
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
