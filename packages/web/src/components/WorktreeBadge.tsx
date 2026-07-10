import type { ChangeInfo } from "@spekjs/core";

// 聚合視圖中標示 change 來自哪個 worktree / branch 的小標籤。
// 來自主 worktree 的 change 不顯示，避免大量重複的標籤淹沒畫面。
export function WorktreeBadge({ source }: { source: NonNullable<ChangeInfo["source"]> }) {
  if (source.isMain) return null;
  return (
    <span
      className="shrink-0 text-[11px] text-text-muted border border-border rounded px-1.5 py-0.5"
      title={source.path}
    >
      {source.branch ?? "detached"}
    </span>
  );
}
