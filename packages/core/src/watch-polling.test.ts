import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fsTypeNeedsPolling,
  parseMountFsType,
  parsePollingOverride,
  hasRemoteEnvIndicator,
  decidePolling,
  pollingInterval,
  shouldUsePolling,
  withAuthoritativeChokidarEnv,
} from "./watch-polling.js";

// --- fsTypeNeedsPolling ---

test("fsTypeNeedsPolling: 網路 / 虛擬掛載需要 polling", () => {
  for (const t of ["9p", "v9fs", "drvfs", "cifs", "smb3", "nfs", "nfs4", "vboxsf", "prl_fs"]) {
    assert.equal(fsTypeNeedsPolling(t), true, t);
  }
});

test("fsTypeNeedsPolling: fuse.* 一律需要 polling（含 bare fuse / fuseblk）", () => {
  assert.equal(fsTypeNeedsPolling("fuse.sshfs"), true);
  assert.equal(fsTypeNeedsPolling("fuse"), true);
  assert.equal(fsTypeNeedsPolling("fuseblk"), true);
});

test("fsTypeNeedsPolling: 原生檔案系統不需要 polling", () => {
  for (const t of ["ext4", "overlay", "btrfs", "xfs", "tmpfs"]) {
    assert.equal(fsTypeNeedsPolling(t), false, t);
  }
});

test("fsTypeNeedsPolling: 大小寫不敏感、null 回 false", () => {
  assert.equal(fsTypeNeedsPolling("9P"), true);
  assert.equal(fsTypeNeedsPolling("NFS4"), true);
  assert.equal(fsTypeNeedsPolling(null), false);
});

// --- parseMountFsType ---

const MOUNTS = [
  "rootfs / rootfs rw 0 0",
  "/dev/sda1 / ext4 rw,relatime 0 0",
  "overlay /var/lib/docker overlay rw 0 0",
  "host_mnt /workspaces 9p rw,trans=virtio 0 0",
  "//server/share /mnt/smb cifs rw 0 0",
].join("\n");

test("parseMountFsType: 取最長前綴掛載點的 fstype", () => {
  assert.equal(parseMountFsType(MOUNTS, "/workspaces/janitarr/openspec"), "9p");
  assert.equal(parseMountFsType(MOUNTS, "/mnt/smb/x"), "cifs");
  assert.equal(parseMountFsType(MOUNTS, "/home/user/proj/openspec"), "ext4");
});

test("parseMountFsType: 掛載點完全相等也算涵蓋", () => {
  assert.equal(parseMountFsType(MOUNTS, "/workspaces"), "9p");
});

test("parseMountFsType: 處理掛載點中的八進位跳脫空白", () => {
  const mounts = "/dev/sda1 / ext4 rw 0 0\nhost /mnt/My\\040Files 9p rw 0 0";
  assert.equal(parseMountFsType(mounts, "/mnt/My Files/openspec"), "9p");
});

test("parseMountFsType: 無匹配（不應發生，root 通常涵蓋）回 null", () => {
  assert.equal(parseMountFsType("garbage line\n", "/x"), null);
});

// --- parsePollingOverride ---

test("parsePollingOverride: SPEK_WATCH_POLLING 真值/假值", () => {
  assert.equal(parsePollingOverride({ SPEK_WATCH_POLLING: "on" }), true);
  assert.equal(parsePollingOverride({ SPEK_WATCH_POLLING: "1" }), true);
  assert.equal(parsePollingOverride({ SPEK_WATCH_POLLING: "true" }), true);
  assert.equal(parsePollingOverride({ SPEK_WATCH_POLLING: "off" }), false);
  assert.equal(parsePollingOverride({ SPEK_WATCH_POLLING: "0" }), false);
});

test("parsePollingOverride: 退回 CHOKIDAR_USEPOLLING；未設定回 null", () => {
  assert.equal(parsePollingOverride({ CHOKIDAR_USEPOLLING: "true" }), true);
  assert.equal(parsePollingOverride({}), null);
  assert.equal(parsePollingOverride({ SPEK_WATCH_POLLING: "maybe" }), null);
});

test("parsePollingOverride: SPEK_WATCH_POLLING 優先於 CHOKIDAR_USEPOLLING", () => {
  assert.equal(
    parsePollingOverride({ SPEK_WATCH_POLLING: "off", CHOKIDAR_USEPOLLING: "true" }),
    false,
  );
});

// --- hasRemoteEnvIndicator ---

test("hasRemoteEnvIndicator: 偵測常見 remote / container 環境變數", () => {
  assert.equal(hasRemoteEnvIndicator({ REMOTE_CONTAINERS: "true" }), true);
  assert.equal(hasRemoteEnvIndicator({ CODESPACES: "true" }), true);
  assert.equal(hasRemoteEnvIndicator({ WSL_DISTRO_NAME: "Ubuntu" }), true);
  assert.equal(hasRemoteEnvIndicator({}), false);
});

// --- decidePolling ---

test("decidePolling: 明確覆寫優先於一切", () => {
  assert.equal(
    decidePolling({ override: true, platform: "darwin", fsType: "ext4", remoteIndicator: false }),
    true,
  );
  assert.equal(
    decidePolling({ override: false, platform: "linux", fsType: "9p", remoteIndicator: true }),
    false,
  );
});

test("decidePolling: 非 Linux 一律原生事件（false）", () => {
  assert.equal(
    decidePolling({ override: null, platform: "win32", fsType: null, remoteIndicator: true }),
    false,
  );
  assert.equal(
    decidePolling({ override: null, platform: "darwin", fsType: null, remoteIndicator: true }),
    false,
  );
});

test("decidePolling: Linux 上非事件 fstype → polling", () => {
  assert.equal(
    decidePolling({ override: null, platform: "linux", fsType: "9p", remoteIndicator: false }),
    true,
  );
});

test("decidePolling: Linux 上原生 fstype → 不 polling（即使環境像 container）", () => {
  assert.equal(
    decidePolling({ override: null, platform: "linux", fsType: "overlay", remoteIndicator: true }),
    false,
  );
});

test("decidePolling: fstype 無法判定時用 remoteIndicator 保底", () => {
  assert.equal(
    decidePolling({ override: null, platform: "linux", fsType: null, remoteIndicator: true }),
    true,
  );
  assert.equal(
    decidePolling({ override: null, platform: "linux", fsType: null, remoteIndicator: false }),
    false,
  );
});

// --- pollingInterval ---

test("pollingInterval: 預設 1000ms；CHOKIDAR_INTERVAL 覆寫；無效值退回預設", () => {
  assert.equal(pollingInterval({}), 1000);
  assert.equal(pollingInterval({ CHOKIDAR_INTERVAL: "500" }), 500);
  assert.equal(pollingInterval({ CHOKIDAR_INTERVAL: "abc" }), 1000);
  assert.equal(pollingInterval({ CHOKIDAR_INTERVAL: "-5" }), 1000);
  assert.equal(pollingInterval({ CHOKIDAR_INTERVAL: "0" }), 1000);
});

// --- shouldUsePolling ---

test("shouldUsePolling: 明確覆寫短路，回傳覆寫值且與路徑無關", () => {
  const p = "/definitely/not/a/real/path/openspec";
  assert.equal(shouldUsePolling(p, { env: { SPEK_WATCH_POLLING: "on" } }), true);
  assert.equal(shouldUsePolling(p, { env: { SPEK_WATCH_POLLING: "off" } }), false);
  assert.equal(shouldUsePolling(p, { env: { CHOKIDAR_USEPOLLING: "1" } }), true);
  // 短路 bug 會讓無覆寫時直接回傳 null 覆寫值；斷言型別可捕捉，且不受平台 / 掛載影響
  assert.equal(typeof shouldUsePolling(p, { env: {} }), "boolean");
});

test("shouldUsePolling: 覆寫優先於 extraRemoteIndicator 保底", () => {
  const p = "/definitely/not/a/real/path/openspec";
  assert.equal(
    shouldUsePolling(p, { env: { SPEK_WATCH_POLLING: "off" }, extraRemoteIndicator: true }),
    false,
  );
});

// --- withAuthoritativeChokidarEnv ---

test("withAuthoritativeChokidarEnv: callback 執行期間 env 對齊到權威值", () => {
  const env: NodeJS.ProcessEnv = { CHOKIDAR_USEPOLLING: "true", CHOKIDAR_INTERVAL: "0" };
  let seenUse: string | undefined;
  let seenInterval: string | undefined;
  withAuthoritativeChokidarEnv(
    false,
    1000,
    () => {
      seenUse = env.CHOKIDAR_USEPOLLING;
      seenInterval = env.CHOKIDAR_INTERVAL;
    },
    env,
  );
  assert.equal(seenUse, "false");
  assert.equal(seenInterval, "1000");
});

test("withAuthoritativeChokidarEnv: usePolling=true 時 env 設為字串 \"true\"", () => {
  const env: NodeJS.ProcessEnv = { CHOKIDAR_USEPOLLING: "false" };
  let seenUse: string | undefined;
  withAuthoritativeChokidarEnv(
    true,
    250,
    () => {
      seenUse = env.CHOKIDAR_USEPOLLING;
    },
    env,
  );
  assert.equal(seenUse, "true");
});

test("withAuthoritativeChokidarEnv: 結束後還原原有 env 值", () => {
  const env: NodeJS.ProcessEnv = { CHOKIDAR_USEPOLLING: "true", CHOKIDAR_INTERVAL: "250" };
  withAuthoritativeChokidarEnv(true, 500, () => {}, env);
  assert.equal(env.CHOKIDAR_USEPOLLING, "true");
  assert.equal(env.CHOKIDAR_INTERVAL, "250");
});

test("withAuthoritativeChokidarEnv: 原本未設定時結束後刪除（不留 undefined 字串）", () => {
  const env: NodeJS.ProcessEnv = {};
  withAuthoritativeChokidarEnv(true, 1000, () => {}, env);
  assert.equal("CHOKIDAR_USEPOLLING" in env, false);
  assert.equal("CHOKIDAR_INTERVAL" in env, false);
});

test("withAuthoritativeChokidarEnv: callback 拋錯仍還原 env 並向外拋出", () => {
  const env: NodeJS.ProcessEnv = { CHOKIDAR_USEPOLLING: "false" };
  assert.throws(() =>
    withAuthoritativeChokidarEnv(
      true,
      1000,
      () => {
        throw new Error("boom");
      },
      env,
    ),
  );
  assert.equal(env.CHOKIDAR_USEPOLLING, "false");
  assert.equal("CHOKIDAR_INTERVAL" in env, false);
});

test("withAuthoritativeChokidarEnv: 回傳 callback 的結果", () => {
  const env: NodeJS.ProcessEnv = {};
  const result = withAuthoritativeChokidarEnv(true, 1000, () => "watcher", env);
  assert.equal(result, "watcher");
});
