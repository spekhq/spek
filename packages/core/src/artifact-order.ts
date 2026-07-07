// change artifact 的預設敘事順序（spec-driven schema）：schemaOrder 不可用、或兩個 artifact
// mtime 完全相同時的穩定 tiebreak。此檔為純常數 + 純函式、無任何 node 依賴，故可被 webview
// bundle 安全 value-import；相對地 artifacts.ts 依賴 node:fs，僅能於 server 端使用，因此把這個
// 共用常數獨立出來（以 @spek/core/artifact-order subpath 匯出），避免前端排序邏輯重複定義。
export const DEFAULT_ORDER = ["proposal", "design", "specs", "tasks"];

/** DEFAULT_ORDER 中的名次（不在其中回 +Infinity），供相同權重時的 tiebreak 使用 */
export function defaultRank(id: string): number {
  const i = DEFAULT_ORDER.indexOf(id);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}
