import spawn from "cross-spawn";

/** schema 中單一 artifact 的權威參照（由 openspec CLI 提供） */
export interface SchemaArtifactRef {
  /** openspec artifact id（如 brainstorm / proposal / specs） */
  id: string;
  /** 該 artifact 的產出路徑：字面檔名（proposal.md）或 glob（specs/**\/*.md） */
  outputPath: string;
}

/**
 * 提供某個 change 的權威 artifact 順序。回 null 代表無法取得（CLI 不存在、change 為
 * archived、或任何錯誤），此時 schemaOrder 為 null（前端退回預設 spec-driven 順序）。
 * 可為同步（測試常注入同步 fake）或非同步（預設 CLI provider 以子行程非阻塞取得）。
 */
export type SchemaOrderProvider = (
  repoRoot: string,
  slug: string,
) => SchemaArtifactRef[] | null | Promise<SchemaArtifactRef[] | null>;

/**
 * 由 `openspec status --change <slug> --json` 的輸出萃取權威 artifact 順序：
 * actionContext.planningArtifacts 提供順序，artifactPaths[id].outputPath 提供產出路徑。
 * 純函式，方便單元測試；解析不出任何 artifact 時回 null。
 */
export function parseOrderFromStatus(json: unknown): SchemaArtifactRef[] | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const actionContext = obj.actionContext as Record<string, unknown> | undefined;
  const order = actionContext?.planningArtifacts;
  const paths = obj.artifactPaths as Record<string, { outputPath?: unknown }> | undefined;
  if (!Array.isArray(order) || !paths) return null;

  const refs: SchemaArtifactRef[] = [];
  for (const id of order) {
    if (typeof id !== "string") continue;
    const outputPath = paths[id]?.outputPath;
    if (typeof outputPath === "string") refs.push({ id, outputPath });
  }
  return refs.length > 0 ? refs : null;
}

/** 將 openspec artifact 的 outputPath 對應到已知 artifact id；對不到回 null（glob 僅支援 specs tree） */
function idForOutputPath(outputPath: string, knownIds: Set<string>): string | null {
  const g = outputPath.trim();
  if (g.includes("*")) {
    if (/(^|\/)specs(\/|$)/.test(g) && knownIds.has("specs")) return "specs";
    return null;
  }
  const base = g.split(/[\\/]/).pop() || g;
  const stem = base.replace(/\.md$/i, "");
  if (knownIds.has(stem)) return stem;
  // 指向 specs/<topic>/spec.md 之類的字面路徑也對應到 specs artifact
  if (/^spec\.md$/i.test(base) && /specs/i.test(g) && knownIds.has("specs")) return "specs";
  return null;
}

/**
 * 由 refs（schema 權威順序）與已探索的 artifact id 集合，產生排序後的 artifact-id 清單。
 * 每個 ref 依 outputPath 對應到一個已知 id、去重；對不到的 ref 略過。
 * refs 為 null 或無任何有效對應時回 null（代表 schemaOrder 不可用）。純函式，方便測試。
 */
export function resolveSchemaOrder(
  refs: SchemaArtifactRef[] | null,
  knownIds: string[],
): string[] | null {
  if (!refs) return null;
  const known = new Set(knownIds);
  const ordered: string[] = [];
  const used = new Set<string>();
  for (const ref of refs) {
    const id = idForOutputPath(ref.outputPath, known);
    if (id && !used.has(id)) {
      ordered.push(id);
      used.add(id);
    }
  }
  return ordered.length > 0 ? ordered : null;
}

// Stryker disable all: 對 openspec CLI 的薄整合層（非阻塞 spawn 子行程）；以整合而非單元測試覆蓋。
// 萃取邏輯在 parseOrderFromStatus（已單元測試）；此處只負責呼叫、快取與容錯。

// 以 (repoRoot, slug) 記憶結果並附建立時間戳（存 Promise，順帶去重同時併發的呼叫）。
// 過去的版本永久快取（含 null），導致：openspec 之後才安裝也永遠拿不到順序、artifact 順序
// 變更後仍供舊值、且條目無上限累積。改為短 TTL：
//   - TTL 必須 ≥ CLI timeout（10s），使進行中的 spawn 永遠不會被判為過期而觸發第二次 spawn；
//   - 過期後自動重查，讓 null / 舊順序在數十秒內自我修復；
//   - 另設 size cap，長時間執行的 server 不致無限成長。
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 256;
interface CacheEntry {
  at: number;
  promise: Promise<SchemaArtifactRef[] | null>;
}
const cache = new Map<string, CacheEntry>();
/**
 * 預設 SchemaOrderProvider：非阻塞地呼叫 openspec CLI 取得權威順序（回 Promise）。
 * 以 async spawn 取代同步呼叫，避免在 change detail 讀取時卡住 Node event loop。
 * openspec 未安裝 / 非 0 結束 / archived change / 逾時 / 解析失敗時一律 resolve 為 null。
 */
export const cliSchemaOrderProvider: SchemaOrderProvider = (repoRoot, slug) => {
  const cacheKey = `${repoRoot}::${slug}`;
  const hit = cache.get(cacheKey);
  // TTL ≥ CLI timeout，故 hit 若仍在 TTL 內必尚未過期即安全復用（含仍進行中的 Promise，不重複 spawn）
  if (hit && Date.now() - hit.at <= CACHE_TTL_MS) return hit.promise;
  if (hit) cache.delete(cacheKey);

  // 以 argv 陣列（非 shell 字串）呼叫：slug 自成一個引數，結構上即無 shell injection 之虞，
  // 毋須對 slug 另做過濾。cross-spawn 一併處理 Windows 上 openspec.cmd 的解析（無需 shell，
  // 避免 DEP0190 / CVE-2024-27980）。
  const promise = new Promise<SchemaArtifactRef[] | null>((resolve) => {
    let out = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (r: SchemaArtifactRef[] | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    let child;
    try {
      child = spawn("openspec", ["status", "--change", slug, "--json"], {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
    } catch {
      finish(null);
      return;
    }
    timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, 10000);
    child.stdout?.setEncoding("utf-8");
    child.stdout?.on("data", (d: string) => {
      out += d;
    });
    child.on("error", () => finish(null)); // openspec 未安裝 → ENOENT
    child.on("close", (code: number | null) => {
      if (code === 0) {
        try {
          finish(parseOrderFromStatus(JSON.parse(out)));
        } catch {
          finish(null);
        }
      } else {
        finish(null);
      }
    });
  });

  // size cap：滿了先淘汰最舊插入的條目（Map 保留插入序）
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, { at: Date.now(), promise });
  return promise;
};
// Stryker restore all
