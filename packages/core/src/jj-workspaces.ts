import { execFile } from "node:child_process";
import path from "node:path";
import type { WorktreeInfo } from "./types.js";
import { worktreeKey } from "./worktrees.js";

/**
 * `jj workspace list` 的 render template（jj 0.42）：name、root、`@` 的 short change id，
 * 以 tab 分隔、每行一個 workspace。name / root / target 為 WorkspaceRef keyword（無括號）。
 */
const JJ_TEMPLATE =
  'name ++ "\\t" ++ root ++ "\\t" ++ target.change_id().short() ++ "\\n"';

/**
 * 解析 `jj workspace list -T <JJ_TEMPLATE>` 的輸出（純函式）。
 * 每行格式：`<name>\t<absolute root>\t<change id>`。jj 依 name 字母排序輸出，
 * 因此最後把 `default`（isMain）排到最前，與 git main worktree 一致。
 */
export function parseJjWorkspaceList(stdout: string): WorktreeInfo[] {
  const result: WorktreeInfo[] = [];

  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 2) continue; // 至少要有 name 與 root

    const name = parts[0];
    const absPath = path.resolve(parts[1]);
    const changeId = (parts[2] ?? "").trim();

    result.push({
      path: absPath,
      branch: name, // jj 無 git branch，以 workspace name 當徽章
      head: changeId || null,
      isMain: name === "default",
      isBare: false,
      key: worktreeKey(absPath),
      vcs: "jj",
    });
  }

  // default 置頂（穩定排序）
  result.sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
  return result;
}

/**
 * 列出 dir 所屬 jj repo 的所有 workspace。非 jj repo、無 `jj`、或指令失敗時回 `[]`，
 * 與 `listWorktrees` 對 git 的優雅退場一致（毋需先檢查 `.jj` 目錄）。
 */
export function listJjWorkspaces(dir: string): Promise<WorktreeInfo[]> {
  return new Promise((resolve) => {
    execFile(
      "jj",
      ["workspace", "list", "-T", JJ_TEMPLATE],
      { cwd: dir, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve([]); // 非 jj repo、無 jj、或失敗 → []
          return;
        }
        resolve(parseJjWorkspaceList(stdout));
      },
    );
  });
}

/**
 * 找出 dir 這個 jj workspace 的 working-copy commit `@` 此刻正在改動的 OpenSpec change slug。
 * 以 `jj diff --ignore-working-copy --name-only -r @` 取得改動檔案，從
 * `openspec/changes/<slug>/...`（含 `archive/<slug>`）擷取 slug。
 * 用 `--ignore-working-copy` 維持唯讀、不觸發 jj 快照。無 jj / 失敗時回空集合。
 */
export function jjCurrentChangeSlugs(dir: string): Promise<Set<string>> {
  return new Promise((resolve) => {
    execFile(
      "jj",
      ["diff", "--ignore-working-copy", "--name-only", "-r", "@"],
      { cwd: dir, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve(new Set());
          return;
        }

        const slugs = new Set<string>();
        const prefix = "openspec/changes/";
        for (const rawLine of stdout.split("\n")) {
          const line = rawLine.trim();
          if (!line.startsWith(prefix)) continue;
          const parts = line.slice(prefix.length).split("/");
          // openspec/changes/<slug>/... 或 openspec/changes/archive/<slug>/...
          let slug: string | null = null;
          if (parts[0] === "archive" && parts.length >= 2) {
            slug = parts[1];
          } else if (parts[0] !== "archive" && parts.length >= 1) {
            slug = parts[0];
          }
          if (slug) slugs.add(slug);
        }
        resolve(slugs);
      },
    );
  });
}
