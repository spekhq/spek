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

/** 解析一次 git 輸出為 slug 集合；輸出為 null（指令失敗）時回空集合。 */
function parseSlugs(out: string | null): Set<string> {
  const slugs = new Set<string>();
  if (out == null) return slugs;
  for (const line of out.split("\n")) {
    const slug = slugFromLine(line);
    if (slug) slugs.add(slug);
  }
  return slugs;
}

/**
 * 已提交分歧：三點 diff（`git diff --name-only <mainHead>...<wtHead>`，對照 merge-base）列出 `wtHead`
 * 自 fork 點以來**自己**更動到的 slug，不含 main 之後對某 slug 的推進——否則只是繼承、未曾編輯的副本
 * 會因 main 前進而被誤判為分歧。`wtHead === mainHead` 時必然無差異，直接回空集合。指令失敗即回空。
 */
export async function committedDivergedSlugs(
  wtPath: string,
  wtHead: string | null,
  mainHead: string | null,
): Promise<Set<string>> {
  if (!wtHead || !mainHead || wtHead === mainHead) return new Set();
  return parseSlugs(
    await runGit(["diff", "--name-only", `${mainHead}...${wtHead}`, "--", "openspec/changes/"], wtPath),
  );
}

/** 未提交分歧：`git status --porcelain` 列出工作區在 `openspec/changes/` 下未提交更動的 slug（與比較對象無關）。指令失敗即回空。 */
export async function uncommittedDivergedSlugs(wtPath: string): Promise<Set<string>> {
  return parseSlugs(await runGit(["status", "--porcelain", "--", "openspec/changes/"], wtPath));
}

/**
 * 回傳某個 worktree 相對於 main 的 `HEAD` 而言、在 `openspec/changes/` 下**確實分歧**的 active
 * change slug 集合，為已提交與未提交兩來源之聯集（見上兩函式）。比較對象是 main 的 `HEAD`（而非其
 * 工作區），故一個只是繼承目錄、未曾編輯的副本不會被判為分歧。任一來源指令失敗即視為該來源無分歧。
 */
export async function divergedSlugs(
  wtPath: string,
  wtHead: string | null,
  mainHead: string | null,
): Promise<Set<string>> {
  const [committed, uncommitted] = await Promise.all([
    committedDivergedSlugs(wtPath, wtHead, mainHead),
    uncommittedDivergedSlugs(wtPath),
  ]);
  for (const slug of uncommitted) committed.add(slug);
  return committed;
}

/** 供 `pickActiveWinners` 注入的分歧判定；預設走真實 git，測試可替換為確定性的假物。 */
export type DivergenceProvider = (wt: WorktreeInfo, mainHead: string | null) => Promise<Set<string>>;

/** 以真實 git 指令判定分歧的預設 provider。 */
export const cliDivergence: DivergenceProvider = (wt, mainHead) =>
  divergedSlugs(wt.path, wt.head, mainHead);
