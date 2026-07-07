import fs from "node:fs";
import path from "node:path";
import { parseTasks } from "./tasks.js";
import { defaultRank } from "./artifact-order.js";
import type { ChangeArtifact } from "./types.js";

/** 由檔名（去副檔名）產生顯示標題：dash/underscore → 空格、字首大寫 */
function humanize(stem: string): string {
  return stem
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * change root 的 markdown artifact 檔名（忽略 dotfile / 非 .md），依檔名排序。
 * 「哪些 root 檔算一個 artifact」的單一事實來源：discover / count 與 web、vscode 的全文搜尋
 * 索引共用此 predicate，避免各處各自 open-code 造成「tab 顯示得出來卻搜不到」之類的漂移。
 */
export function listChangeMarkdownFiles(changePath: string): string[] {
  if (!fs.existsSync(changePath)) return [];
  return fs
    .readdirSync(changePath, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith(".") && e.name.toLowerCase().endsWith(".md"))
    .map((e) => e.name)
    .sort();
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

/**
 * specs/ 是否含至少一個 spec.md —— 只用 existsSync 判斷「有沒有」，第一個命中即回 true，
 * 不讀取任何檔案內容。供 countArtifacts 在 changes 列表熱路徑上使用：既不會為了算數量而
 * readFileSync 每個 spec.md，單一無法讀取的 spec.md 也不會 throw 而中斷整份列表列舉。
 */
function hasSpecsTree(changePath: string): boolean {
  const specsDir = path.join(changePath, "specs");
  if (!fs.existsSync(specsDir) || !fs.statSync(specsDir).isDirectory()) return false;
  for (const topic of fs.readdirSync(specsDir).filter((n) => !n.startsWith("."))) {
    if (fs.existsSync(path.join(specsDir, topic, "spec.md"))) return true;
  }
  return false;
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

/** 配置一個尚未被占用的 artifact id：base 若已被占用，以 base-2 / base-3 … 遞增直到未占用，
 *  並將結果登記進 used。用於化解 root 檔（如 specs.md）與 specs delta tree 對 "specs" id 的碰撞。 */
function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

/** 計算 artifact 數量（root *.md + specs/ 非空各算一個），供 ChangeInfo 列表使用，不讀取內容。
 *  changePath 不存在時 listChangeMarkdownFiles / hasSpecsTree 各自回空/false，自然得 0，無需另設守衛。 */
export function countArtifacts(changePath: string): number {
  let count = listChangeMarkdownFiles(changePath).length;
  if (hasSpecsTree(changePath)) count += 1;
  return count;
}

/**
 * 動態探索一個 change 目錄的 artifacts：
 * - root 每個 *.md（忽略 dotfile / 非 .md）→ markdown（tasks.md → tasks kind）
 * - 非空 specs/ → 單一 specs artifact（id 固定為 "specs"，全 app 皆以此識別 delta tree）
 * 排序：依檔案 mtime 由新到舊，讓執行中被編輯的 artifact（如 tasks）浮到最前。root 檔案取自身
 * mtime、specs 取其 delta 檔案中最新的 mtime。只有當兩個 artifact 的 mtime「完全相同」時（例如
 * 同秒寫入）才以穩定的預設順序 tiebreak（DEFAULT_ORDER 優先、其餘字母序）。注意 git clone /
 * checkout 通常寫出各異的 sub-ms mtime，故此預設（Last modified）模式並不保證剛簽出、未編輯的
 * repo 呈現 proposal→design→… 敘事序；需要 authored 順序時請改用前端的 Schema order / A–Z。
 * 不呼叫 openspec CLI、不解析任何 schema。
 */
export function discoverArtifacts(changePath: string): ChangeArtifact[] {
  // changePath 不存在時 readSpecsTree / listChangeMarkdownFiles 各自回空，built 為空 → 回 []
  const built = new Map<string, ChangeArtifact>();
  const mtimes = new Map<string, number>();
  const used = new Set<string>();

  // 保留 "specs" id 給 delta tree：先探得 specs/ 是否非空，若是則佔住 id，讓同名的 root
  // specs.md 走 uniqueId 取得不碰撞的 id（如 specs-2），避免其內容被 tree 覆蓋而遺失。
  const specs = readSpecsTree(changePath);
  const hasSpecs = specs.length > 0;
  if (hasSpecs) used.add("specs");

  // root *.md
  for (const file of listChangeMarkdownFiles(changePath)) {
    const stem = file.replace(/\.md$/i, "");
    const id = uniqueId(stem, used);
    const full = path.join(changePath, file);
    const content = fs.readFileSync(full, "utf-8");
    // mtime 一律以「配置到的 id」為 key，與最終排序讀取的 key 對齊（碰撞改 id 後仍能正確取到）
    mtimes.set(id, fs.statSync(full).mtimeMs);
    if (file.toLowerCase() === "tasks.md") {
      built.set(id, { id, title: humanize(stem), kind: "tasks", tasks: parseTasks(content) });
    } else {
      built.set(id, { id, title: humanize(stem), kind: "markdown", content });
    }
  }

  // specs tree（id 已於上方保留）
  if (hasSpecs) {
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
