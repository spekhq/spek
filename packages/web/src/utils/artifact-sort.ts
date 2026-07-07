import type { ChangeArtifact } from "@spek/core";
// 從無 node 依賴的 subpath 匯入（非主 entry），避免把 server-only 的 @spek/core 模組拉進
// webview bundle；DEFAULT_ORDER 為 core / 前端共用的單一事實來源，不再於此重複定義。
import { defaultRank } from "@spek/core/artifact-order";

export type ArtifactSortMode = "modified" | "schema" | "alpha";

function byDefaultOrder(a: ChangeArtifact, b: ChangeArtifact): number {
  const ra = defaultRank(a.id);
  const rb = defaultRank(b.id);
  if (ra !== rb) return ra - rb;
  return a.id.localeCompare(b.id);
}

/**
 * 依使用者選擇的模式排序 change artifacts（純函式）：
 * - modified：維持 core 交付的順序（已依 mtime 由新到舊，即 last-modified）
 * - alpha：依顯示標題 A–Z
 * - schema：依 schemaOrder（schema 權威順序）排序，未列入者接在後面依預設敘事序；
 *   schemaOrder 不可用（null/空）時整體退回預設敘事序
 * 只改變順序，不改變 artifact 集合。
 */
export function sortArtifacts(
  artifacts: ChangeArtifact[],
  mode: ArtifactSortMode,
  schemaOrder?: string[],
): ChangeArtifact[] {
  if (mode === "modified") return artifacts;

  if (mode === "alpha") {
    // id tiebreak keeps order deterministic when two artifacts humanize to the same title
    return [...artifacts].sort(
      (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
    );
  }

  // mode === "schema"
  if (schemaOrder && schemaOrder.length > 0) {
    const rank = new Map(schemaOrder.map((id, i) => [id, i] as const));
    return [...artifacts].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.POSITIVE_INFINITY;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      // schemaOrder 未列入者接在後面，依預設敘事序
      return byDefaultOrder(a, b);
    });
  }

  // schemaOrder 不可用 → 退回預設 spec-driven 敘事序
  return [...artifacts].sort(byDefaultOrder);
}
