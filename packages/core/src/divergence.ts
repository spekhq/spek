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
 * 已提交分歧：三點 diff（`git diff --name-only <baseHead>...<aheadHead>`，對照 merge-base）列出
 * `aheadHead` 自 merge-base 以來**自己**推進到的 slug，不含 `baseHead` 那側的推進——否則只是繼承、
 * 未曾編輯的副本會因對方前進而被誤判為分歧。`aheadHead === baseHead` 時必然無差異，直接回空集合。
 * 指令失敗即回空。
 *
 * 參數刻意取方向中性的名字：同一個函式要服務兩個相反方向——worktree 對 main（ahead = worktree），
 * 以及 main 對某個 contender 的反向（ahead = main，見 pickActiveWinners）。若以 wt/main 命名，
 * 反向那個呼叫點會讀成完全相反的意思。
 */
export async function committedDivergedSlugs(
  repoPath: string,
  aheadHead: string | null,
  baseHead: string | null,
): Promise<Set<string>> {
  if (!aheadHead || !baseHead || aheadHead === baseHead) return new Set();
  return parseSlugs(
    await runGit(["diff", "--name-only", `${baseHead}...${aheadHead}`, "--", "openspec/changes/"], repoPath),
  );
}

/**
 * 未提交分歧：`git status --porcelain` 列出 `repoPath` 工作區在 `openspec/changes/` 下未提交更動的
 * slug（與比較對象無關，故不吃 head 參數）。worktree 與 main 兩側都會呼叫，故參數名同樣取中性。
 * 指令失敗即回空。
 */
export async function uncommittedDivergedSlugs(repoPath: string): Promise<Set<string>> {
  return parseSlugs(await runGit(["status", "--porcelain", "--", "openspec/changes/"], repoPath));
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
