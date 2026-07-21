import type { ChangeInfo } from "@spekjs/core";

// 聚合視圖中標示 change 來自哪個 worktree / jj workspace 的小標籤。
// 來自主工作目錄的 change 不顯示，避免大量重複的標籤淹沒畫面。
// jj workspace 來源以 `jj:` 前綴標示，與 git branch 區分。
export function WorktreeBadge({ source }: { source: NonNullable<ChangeInfo["source"]> }) {
  if (source.isMain) return null;
  const isJj = source.vcs === "jj";
  const label = isJj ? `jj:${source.branch ?? ""}` : (source.branch ?? "detached");
  return (
    <span
      className="shrink-0 text-[11px] text-text-muted border border-border rounded px-1.5 py-0.5"
      title={`${source.path}${isJj ? " (jj workspace)" : ""}`}
    >
      {label}
    </span>
  );
}
