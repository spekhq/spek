import { execFile } from "node:child_process";
import type { WorktreeInfo } from "./types.js";

/**
 * 從 `git diff --name-only` 或 `git status --porcelain` 的一行輸出中取出 active change 的 slug。
 * 兩者行首格式不同（status 有 2 字狀態碼前綴），故以第一個 `openspec/changes/` 出現處為錨。
 * `openspec/changes/archive/...` 為封存 change，不計入分歧；缺少 slug 段者亦忽略。
 */
function slugFromLine(line: string): string | null {
  const marker = "openspec/changes/";
  const idx = line.indexOf(marker);
  if (idx === -1) return null;
  const parts = line.slice(idx + marker.length).split("/");
  if (!parts[0] || parts[0] === "archive" || parts.length < 2) return null;
  return parts[0];
}

/** 執行單一 git 指令，錯誤時回 null（比照 git-cache.ts 錯誤即回空的作風）。 */
function runGit(args: string[], cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      resolve(error ? null : stdout);
    });
  });
}

/**
 * 回傳某個 worktree 相對於 main 的 `HEAD` 而言、在 `openspec/changes/` 下**確實分歧**的 active
 * change slug 集合。分歧來源有二，取聯集：
 *  - 已提交：`git diff --name-only <mainHead> <wtHead> -- openspec/changes/`（`wtHead === mainHead`
 *    時整段略過，因為必然無差異）。
 *  - 未提交：`git status --porcelain -- openspec/changes/`。
 * 比較對象是 main 的 `HEAD`（而非其工作區），故一個只是繼承目錄、未曾編輯的副本不會被判為分歧。
 * 任一指令失敗時該來源視為無分歧（該 worktree 傾向被判為未分歧 → 由 main 勝出）。
 */
export async function divergedSlugs(
  wtPath: string,
  wtHead: string | null,
  mainHead: string | null,
): Promise<Set<string>> {
  const jobs: Promise<string | null>[] = [];
  if (wtHead && mainHead && wtHead !== mainHead) {
    jobs.push(runGit(["diff", "--name-only", mainHead, wtHead, "--", "openspec/changes/"], wtPath));
  }
  jobs.push(runGit(["status", "--porcelain", "--", "openspec/changes/"], wtPath));

  const slugs = new Set<string>();
  for (const out of await Promise.all(jobs)) {
    if (out == null) continue;
    for (const line of out.split("\n")) {
      const slug = slugFromLine(line);
      if (slug) slugs.add(slug);
    }
  }
  return slugs;
}

/** 供 `pickActiveWinners` 注入的分歧判定；預設走真實 git，測試可替換為確定性的假物。 */
export type DivergenceProvider = (wt: WorktreeInfo, mainHead: string | null) => Promise<Set<string>>;

/** 以真實 git 指令判定分歧的預設 provider。 */
export const cliDivergence: DivergenceProvider = (wt, mainHead) =>
  divergedSlugs(wt.path, wt.head, mainHead);
