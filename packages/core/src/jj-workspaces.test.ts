import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { worktreeKey, listWorkspaces } from "./worktrees.js";
import {
  parseJjWorkspaceList,
  listJjWorkspaces,
  jjCurrentChangeSlugs,
} from "./jj-workspaces.js";

// --- parseJjWorkspaceList（純函式） ---

test("parseJjWorkspaceList: parses default and added workspaces", () => {
  const out = [
    "default\t/repo/main\tksorsrrz",
    "feature\t/repo/feat\tabcd1234",
    "",
  ].join("\n");
  const wss = parseJjWorkspaceList(out);
  assert.equal(wss.length, 2);
  assert.equal(wss[0].isMain, true);
  assert.equal(wss[0].branch, "default");
  assert.equal(wss[0].vcs, "jj");
  assert.equal(wss[1].branch, "feature");
  assert.equal(wss[1].head, "abcd1234");
  assert.equal(wss[1].isMain, false);
});

test("parseJjWorkspaceList: empty change id yields null head", () => {
  const wss = parseJjWorkspaceList("default\t/repo/main\t\n");
  assert.equal(wss[0].head, null);
});

test("parseJjWorkspaceList: sorts default to the front", () => {
  // jj 依 name 字母排序輸出，default 不一定在前
  const out = ["feature\t/repo/feat\tabcd\n", "default\t/repo/main\tffff\n"].join(
    "",
  );
  const wss = parseJjWorkspaceList(out);
  assert.equal(wss[0].isMain, true);
  assert.equal(wss[0].branch, "default");
});

test("parseJjWorkspaceList: skips malformed lines without a tab", () => {
  const out = ["garbage-no-tab", "default\t/repo/main\tffff", ""].join("\n");
  const wss = parseJjWorkspaceList(out);
  assert.equal(wss.length, 1);
  assert.equal(wss[0].branch, "default");
});

test("parseJjWorkspaceList: key matches worktreeKey of resolved path", () => {
  const wss = parseJjWorkspaceList("default\t/repo/main\tffff\n");
  assert.equal(wss[0].key, worktreeKey("/repo/main"));
});

// --- listJjWorkspaces / listWorkspaces / jjCurrentChangeSlugs（與真實 jj/git 整合） ---

function jjAvailable(): boolean {
  try {
    execFileSync("jj", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
const HAS_JJ = jjAvailable();
const jjSkip = HAS_JJ ? false : "jj not installed";

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
  });
}

function jj(cwd: string, ...args: string[]): void {
  execFileSync("jj", args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, JJ_CONFIG: "/dev/null" },
  });
}

// 建立 colocated git+jj repo（main 同時是 git main worktree 與 jj default workspace）
function initColocated(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  jj(dir, "git", "init", "--colocate");
  return dir;
}

// git / jj 都會回傳解析過 symlink 的實體路徑（macOS：/var → /private/var），
// path.resolve 不解 symlink，故比對時一律以 realpath 為準。
function rp(p: string): string {
  return fs.realpathSync(p);
}

test("listJjWorkspaces: lists the default workspace in a colocated repo", { skip: jjSkip }, async () => {
  const repo = initColocated("spek-jj-default-");
  const wss = await listJjWorkspaces(repo);
  assert.ok(wss.length >= 1);
  assert.equal(wss[0].isMain, true);
  assert.equal(wss[0].branch, "default");
  assert.equal(wss[0].vcs, "jj");
  assert.equal(wss[0].path, rp(repo));
});

test("listJjWorkspaces: includes an added workspace", { skip: jjSkip }, async () => {
  const repo = initColocated("spek-jj-added-");
  const ws2 = repo + "-ws2";
  jj(repo, "workspace", "add", "--name", "feature", ws2);
  const wss = await listJjWorkspaces(repo);
  assert.equal(wss.length, 2);
  assert.ok(wss.some((w) => w.path === rp(ws2) && w.vcs === "jj"));
});

test("listJjWorkspaces: returns empty array for a non-jj directory", { skip: jjSkip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spek-nonjj-"));
  assert.deepEqual(await listJjWorkspaces(dir), []);
});

test("listWorkspaces: dedupes the colocated main, keeping the git entry", { skip: jjSkip }, async () => {
  const repo = initColocated("spek-ws-dedup-");
  const merged = await listWorkspaces(repo);
  const mainEntries = merged.filter((w) => w.path === rp(repo));
  assert.equal(mainEntries.length, 1);
  assert.equal(mainEntries[0].vcs, "git"); // git 勝，保留 branch
  assert.equal(mainEntries[0].branch, "main");
});

test("listWorkspaces: surfaces a jj-only workspace alongside the git main", { skip: jjSkip }, async () => {
  const repo = initColocated("spek-ws-merge-");
  const ws2 = repo + "-jw";
  jj(repo, "workspace", "add", "--name", "feature", ws2);
  const merged = await listWorkspaces(repo);
  assert.equal(merged[0].isMain, true); // main 置頂
  assert.ok(merged.some((w) => w.path === rp(ws2) && w.vcs === "jj"));
});

test("listWorkspaces: includeJj=false returns git worktrees only", { skip: jjSkip }, async () => {
  const repo = initColocated("spek-ws-nojj-");
  const ws2 = repo + "-jw";
  jj(repo, "workspace", "add", "--name", "feature", ws2);
  const merged = await listWorkspaces(repo, { includeJj: false });
  assert.ok(merged.every((w) => w.vcs === "git"));
  assert.ok(!merged.some((w) => w.path === rp(ws2)));
});

test("jjCurrentChangeSlugs: detects the change edited in the working copy", { skip: jjSkip }, async () => {
  const repo = initColocated("spek-jj-current-");
  const change = path.join(repo, "openspec", "changes", "add-foo");
  fs.mkdirSync(change, { recursive: true });
  fs.writeFileSync(path.join(change, "proposal.md"), "## Why\n");
  jj(repo, "status"); // 觸發 working copy 快照
  const slugs = await jjCurrentChangeSlugs(repo);
  assert.ok(slugs.has("add-foo"));
});

test("jjCurrentChangeSlugs: returns empty set for a non-jj directory", { skip: jjSkip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spek-jj-nocur-"));
  assert.equal((await jjCurrentChangeSlugs(dir)).size, 0);
});
