import fs from "node:fs";
import path from "node:path";
import { parseTasks } from "./tasks.js";
import type { ChangeArtifact } from "./types.js";

// 相同 mtime 時的穩定 tiebreak：這些 artifact 依此順序在前，其餘接在後面依檔名排序
const DEFAULT_ORDER = ["proposal", "design", "specs", "tasks"];

/** 由檔名（去副檔名）產生顯示標題：dash/underscore → 空格、字首大寫 */
function humanize(stem: string): string {
  return stem
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 讀取 specs/ delta tree，回傳依 topic 排序的 { topic, content } 清單（空則為空陣列） */
function readSpecsTree(changePath: string): { topic: string; content: string }[] {
  const specsDir = path.join(changePath, "specs");
  if (!fs.existsSync(specsDir) || !fs.statSync(specsDir).isDirectory()) return [];
  const out: { topic: string; content: string }[] = [];
  for (const topic of fs.readdirSync(specsDir).filter((n) => !n.startsWith("."))) {
    const specPath = path.join(specsDir, topic, "spec.md");
    if (fs.existsSync(specPath)) out.push({ topic, content: fs.readFileSync(specPath, "utf-8") });
  }
  return out.sort((a, b) => a.topic.localeCompare(b.topic));
}

/** specs artifact 的排序時間：所有 specs/**\/spec.md 中最新的 mtime（無檔案回 0） */
function specsMtime(changePath: string): number {
  const specsDir = path.join(changePath, "specs");
  if (!fs.existsSync(specsDir) || !fs.statSync(specsDir).isDirectory()) return 0;
  let newest = 0;
  for (const topic of fs.readdirSync(specsDir).filter((n) => !n.startsWith("."))) {
    const specPath = path.join(specsDir, topic, "spec.md");
    if (fs.existsSync(specPath)) {
      const m = fs.statSync(specPath).mtimeMs;
      if (m > newest) newest = m;
    }
  }
  return newest;
}

/** DEFAULT_ORDER 中的名次（不在其中回 +Infinity），供相同 mtime 時的 tiebreak 使用 */
function defaultRank(id: string): number {
  const i = DEFAULT_ORDER.indexOf(id);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

/** 計算 artifact 數量（root *.md + specs/ 非空各算一個），供 ChangeInfo 列表使用，不讀取內容 */
export function countArtifacts(changePath: string): number {
  if (!fs.existsSync(changePath)) return 0;
  const entries = fs.readdirSync(changePath, { withFileTypes: true });
  let count = entries.filter(
    (e) => e.isFile() && !e.name.startsWith(".") && e.name.toLowerCase().endsWith(".md"),
  ).length;
  if (readSpecsTree(changePath).length > 0) count += 1;
  return count;
}

/**
 * 動態探索一個 change 目錄的 artifacts：
 * - root 每個 *.md（忽略 dotfile / 非 .md）→ markdown（tasks.md → tasks kind）
 * - 非空 specs/ → 單一 specs artifact
 * 排序：依檔案 mtime 由新到舊，讓執行中被編輯的 artifact（如 tasks）浮到最前。root 檔案取
 * 自身 mtime、specs 取其 delta 檔案中最新的 mtime。mtime 相同時（例如剛 clone/checkout，全部
 * 檔案共用簽出時間）以穩定的預設順序 tiebreak（DEFAULT_ORDER 優先、其餘字母序），使未編輯的
 * repo 仍呈現熟悉的敘事順序。不呼叫 openspec CLI、不解析任何 schema。
 */
export function discoverArtifacts(changePath: string): ChangeArtifact[] {
  if (!fs.existsSync(changePath)) return [];

  const built = new Map<string, ChangeArtifact>();
  const mtimes = new Map<string, number>();

  // root *.md
  const mdFiles = fs
    .readdirSync(changePath, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith(".") && e.name.toLowerCase().endsWith(".md"))
    .map((e) => e.name)
    .sort();
  for (const file of mdFiles) {
    const stem = file.replace(/\.md$/i, "");
    const full = path.join(changePath, file);
    const content = fs.readFileSync(full, "utf-8");
    mtimes.set(stem, fs.statSync(full).mtimeMs);
    if (file.toLowerCase() === "tasks.md") {
      built.set(stem, { id: stem, title: humanize(stem), kind: "tasks", tasks: parseTasks(content) });
    } else {
      built.set(stem, { id: stem, title: humanize(stem), kind: "markdown", content });
    }
  }

  // specs tree
  const specs = readSpecsTree(changePath);
  if (specs.length > 0) {
    built.set("specs", { id: "specs", title: "Specs", kind: "specs", specs });
    mtimes.set("specs", specsMtime(changePath));
  }

  // mtime 由新到舊；相同 mtime 以 DEFAULT_ORDER 優先、其餘字母序作穩定 tiebreak
  const ids = [...built.keys()];
  ids.sort((a, b) => {
    const ma = mtimes.get(a) ?? 0;
    const mb = mtimes.get(b) ?? 0;
    if (mb !== ma) return mb - ma;
    const ra = defaultRank(a);
    const rb = defaultRank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });

  return ids.map((id) => built.get(id)!);
}
