import fs from "node:fs";

/**
 * 判定檔案監看是否需要改用 polling（輪詢）。
 *
 * 背景：Web / VS Code（chokidar）與 IntelliJ（Java NIO WatchService）在 Linux 都依賴
 * inotify 等原生事件，但這類事件在 9p / drvfs / NFS / CIFS / FUSE 等網路型或虛擬掛載上
 * 不會傳遞——正是 devcontainer / WSL 把 host 目錄掛進容器的情況。此時 watcher 永遠收不到
 * 事件、live-reload 靜默失效，需改用 polling。
 *
 * 真正的判別依據是「被監看路徑所在掛載的檔案系統型別」，而非「是否在容器」：純容器
 * overlayfs 的 inotify 正常，就不該輪詢；掛 9p 就該輪詢，無論是否在容器內。
 *
 * 此模組為 server-only（用到 node:fs / process），由 web server 與 extension host 共用；
 * 純函式（fsTypeNeedsPolling / parseMountFsType / parsePollingOverride /
 * hasRemoteEnvIndicator / decidePolling）與 I/O 薄層（detectMountFsType /
 * shouldUsePolling）分離，方便單元測試。
 */

/** 不傳遞原生事件、需改用 polling 的 fstype（小寫比對；`fuse.*` 另以前綴判定） */
const NON_EVENT_FS_TYPES = new Set([
  "9p",
  "v9fs",
  "drvfs",
  "cifs",
  "smb3",
  "smbfs",
  "nfs",
  "nfs4",
  "vboxsf",
  "vmhgfs",
  "prl_fs",
  "lustre",
  "glusterfs",
]);

/** 給定 fstype 是否屬於「不傳遞原生事件」集合。null（無法判定）回 false。 */
export function fsTypeNeedsPolling(fsType: string | null): boolean {
  if (!fsType) return false;
  const t = fsType.toLowerCase();
  if (t === "fuse" || t === "fuseblk" || t.startsWith("fuse.")) return true;
  return NON_EVENT_FS_TYPES.has(t);
}

/** 還原 /proc/mounts 掛載點中的八進位跳脫（空白 \040、tab \011 等） */
function unescapeMountField(s: string): string {
  return s.replace(/\\(\d{3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)));
}

/** 掛載點 mountPoint 是否涵蓋 targetPath（root `/` 涵蓋一切；否則需為路徑前綴） */
function pathCoveredBy(targetPath: string, mountPoint: string): boolean {
  if (mountPoint === "/") return true;
  const mp = mountPoint.endsWith("/") ? mountPoint.slice(0, -1) : mountPoint;
  return targetPath === mp || targetPath.startsWith(mp + "/");
}

/**
 * 純函式：從 `/proc/mounts` 內容解析出涵蓋 targetPath 的掛載 fstype。
 * 取「掛載點為 targetPath 前綴且最長」者的 fstype；對不到回 null。
 * /proc/mounts 每行格式：`<source> <mountpoint> <fstype> <opts> <dump> <pass>`。
 */
export function parseMountFsType(mountsContent: string, targetPath: string): string | null {
  let bestLen = -1;
  let bestType: string | null = null;
  for (const line of mountsContent.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split(" ");
    if (parts.length < 3) continue;
    const mountPoint = unescapeMountField(parts[1]);
    const fsType = parts[2];
    // >= 讓相同掛載點的後者覆蓋前者（mount shadowing），符合實際掛載語意
    if (pathCoveredBy(targetPath, mountPoint) && mountPoint.length >= bestLen) {
      bestLen = mountPoint.length;
      bestType = fsType;
    }
  }
  return bestType;
}

/**
 * I/O 薄層：偵測 path 所在掛載的 fstype。
 * 僅 Linux 有意義（win32 / darwin 原生事件正常，一律回 null）；/proc 不可讀時回 null。
 */
function detectMountFsType(path: string): string | null {
  if (process.platform !== "linux") return null;
  let resolved = path;
  try {
    resolved = fs.realpathSync(path);
  } catch {
    // 路徑尚不存在或無法解析時，沿用原 path 比對掛載點
  }
  try {
    const content = fs.readFileSync("/proc/mounts", "utf8");
    return parseMountFsType(content, resolved);
  } catch {
    return null;
  }
}

/**
 * 純函式：解析明確覆寫。`SPEK_WATCH_POLLING`（跨變體別名）優先，其次 `CHOKIDAR_USEPOLLING`。
 * 回 true/false 表示使用者明確要求；回 null 表示無意見（交由偵測決定）。
 */
export function parsePollingOverride(env: NodeJS.ProcessEnv): boolean | null {
  const raw = env.SPEK_WATCH_POLLING ?? env.CHOKIDAR_USEPOLLING;
  if (raw === undefined) return null;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return null;
}

/** 純函式：環境是否顯示 remote / container（無法判定 fstype 時的保底訊號） */
export function hasRemoteEnvIndicator(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.REMOTE_CONTAINERS ||
      env.REMOTE_CONTAINERS_IPC ||
      env.CODESPACES ||
      env.WSL_DISTRO_NAME ||
      env.WSL_INTEROP,
  );
}

/** decidePolling 的輸入訊號 */
export interface PollingSignals {
  /** 明確覆寫：true/false 直接決定，null 代表交給偵測 */
  override: boolean | null;
  /** process.platform */
  platform: NodeJS.Platform;
  /** 被監看路徑的 fstype（僅 Linux；無法判定為 null） */
  fsType: string | null;
  /** 環境 / .dockerenv / 編輯器 remote 等保底訊號 */
  remoteIndicator: boolean;
}

/**
 * 純函式：依優先序決定是否 polling。
 * 1) 明確覆寫最優先 2) 非 Linux 一律原生（false）3) fstype 屬非事件集合 → true
 * 4) fstype 已判定為原生 → false 5) fstype 無法判定 → 用 remoteIndicator 保底。
 */
export function decidePolling(s: PollingSignals): boolean {
  if (s.override !== null) return s.override;
  if (s.platform !== "linux") return false;
  if (fsTypeNeedsPolling(s.fsType)) return true;
  if (s.fsType !== null) return false;
  return s.remoteIndicator;
}

function dockerEnvExists(): boolean {
  try {
    return fs.existsSync("/.dockerenv");
  } catch {
    return false;
  }
}

/**
 * 是否應對 path 使用 polling。整合覆寫、fstype 偵測與環境保底訊號。
 * `extraRemoteIndicator` 供呼叫端補強（如 VS Code 傳入 `vscode.env.remoteName` 非 undefined）。
 */
export function shouldUsePolling(
  path: string,
  opts: { extraRemoteIndicator?: boolean; env?: NodeJS.ProcessEnv } = {},
): boolean {
  const env = opts.env ?? process.env;
  // 明確覆寫最優先，直接回傳，免去 realpathSync + 讀 /proc/mounts 的 I/O
  //（聚合時同一 watcher 會對多個 worktree 路徑各呼叫一次，覆寫短路可省去重複讀取）
  const override = parsePollingOverride(env);
  if (override !== null) return override;
  return decidePolling({
    override: null,
    platform: process.platform,
    fsType: detectMountFsType(path),
    remoteIndicator:
      hasRemoteEnvIndicator(env) || dockerEnvExists() || Boolean(opts.extraRemoteIndicator),
  });
}

/** polling 間隔（ms）。取 `CHOKIDAR_INTERVAL`，否則預設 1000ms。 */
export function pollingInterval(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.CHOKIDAR_INTERVAL;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

function restoreEnvVar(env: NodeJS.ProcessEnv, key: string, prev: string | undefined): void {
  if (prev === undefined) delete env[key];
  else env[key] = prev;
}

/**
 * 讓 @spek/core 算出的 polling 決定成為 chokidar 的權威值。
 *
 * chokidar 5.x 在建構 watcher 時會「事後」重讀 `process.env.CHOKIDAR_USEPOLLING` 與
 * `CHOKIDAR_INTERVAL`，覆寫我們透過 options 傳入的 `usePolling` / `interval`
 *（見 node_modules/chokidar/index.js: envPoll / envInterval 區塊）。因此當使用者
 * 於 shell rc 匯出 `CHOKIDAR_USEPOLLING=true`（WSL/Docker 常見 workaround）再依 README
 * 設 `SPEK_WATCH_POLLING=off` 時，Web / VS Code 仍會輪詢——牴觸 spec「off → SHALL NOT poll」；
 * 同理 `CHOKIDAR_INTERVAL=0` 會繞過 `pollingInterval()` 的 >0 防呆而 busy poll。
 *
 * 此 helper 在 `createWatcher()` 期間把兩個 env 對齊到權威決定（chokidar 於建構時同步讀取），
 * 建立後立即還原原值，避免污染其它 chokidar 實例或整個 process。
 *
 * 前提：`createWatcher()` 必須是同步的（僅呼叫 `chokidar.watch(...)`，不得 `await`）。env 對齊
 * 只在 set→restore 這段同步窗口內有效；若 callback 內有非同步等待，還原會早於 chokidar 讀取而失效。
 */
export function withAuthoritativeChokidarEnv<T>(
  usePolling: boolean,
  interval: number,
  createWatcher: () => T,
  env: NodeJS.ProcessEnv = process.env,
): T {
  const prevUsePolling = env.CHOKIDAR_USEPOLLING;
  const prevInterval = env.CHOKIDAR_INTERVAL;
  env.CHOKIDAR_USEPOLLING = usePolling ? "true" : "false";
  env.CHOKIDAR_INTERVAL = String(interval);
  try {
    return createWatcher();
  } finally {
    restoreEnvVar(env, "CHOKIDAR_USEPOLLING", prevUsePolling);
    restoreEnvVar(env, "CHOKIDAR_INTERVAL", prevInterval);
  }
}
