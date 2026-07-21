import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseWorktreePorcelain, worktreeKey, listWorktrees } from "./worktrees.js";

// --- parseWorktreePorcelain（純函式） ---

test("parseWorktreePorcelain: parses main and linked worktrees", () => {
  const out = [
    "worktree /repo/main",
    "HEAD aaaa",
    "branch refs/heads/master",
    "",
    "worktree /repo/feature",
    "HEAD bbbb",
    "branch refs/heads/feat",
    "",
  ].join("\n");
  const wts = parseWorktreePorcelain(out);
  assert.equal(wts.length, 2);
  assert.equal(wts[0].isMain, true);
  assert.equal(wts[0].branch, "master");
  assert.equal(wts[1].isMain, false);
  assert.equal(wts[1].branch, "feat");
  assert.equal(wts[1].head, "bbbb");
});

test("parseWorktreePorcelain: detached HEAD yields null branch", () => {
  const out = [
    "worktree /repo/main",
    "HEAD aaaa",
    "branch refs/heads/master",
    "",
    "worktree /repo/detached",
    "HEAD cccc",
    "detached",
    "",
  ].join("\n");
  const wts = parseWorktreePorcelain(out);
  assert.equal(wts[1].branch, null);
});

test("parseWorktreePorcelain: bare worktree is flagged", () => {
  const wts = parseWorktreePorcelain(["worktree /repo/bare", "bare", ""].join("\n"));
  assert.equal(wts[0].isBare, true);
});

test("parseWorktreePorcelain: prunable worktree is skipped", () => {
  const out = [
    "worktree /repo/main",
    "HEAD aaaa",
    "branch refs/heads/master",
    "",
    "worktree /repo/gone",
    "HEAD dddd",
    "branch refs/heads/gone",
    "prunable gitdir file points to non-existent location",
    "",
  ].join("\n");
  const wts = parseWorktreePorcelain(out);
  assert.equal(wts.length, 1);
  assert.equal(wts[0].branch, "master");
});

// --- worktreeKey ---

test("worktreeKey: stable for the same path", () => {
  assert.equal(worktreeKey("/a/b/c"), worktreeKey("/a/b/c"));
});

test("worktreeKey: distinct for different paths", () => {
  assert.notEqual(worktreeKey("/a/b/c"), worktreeKey("/a/b/d"));
});

// --- listWorktrees（與真實 git 整合） ---

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
  });
}

function initRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spek-wt-test-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "README.md"), "hi\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "init");
  return dir;
}

test("listWorktrees: lists main and linked worktrees", async () => {
  const repo = initRepo();
  git(repo, "worktree", "add", "-q", "-b", "feature", repo + "-feature");
  const wts = await listWorktrees(repo);
  assert.equal(wts.length, 2);
  assert.equal(wts[0].isMain, true);
  assert.deepEqual(wts.map((w) => w.branch).sort(), ["feature", "main"]);
});

test("listWorktrees: returns every worktree when called from a linked worktree", async () => {
  const repo = initRepo();
  const linked = repo + "-feature";
  git(repo, "worktree", "add", "-q", "-b", "feature", linked);
  const wts = await listWorktrees(linked);
  assert.equal(wts.length, 2);
  assert.equal(wts[0].isMain, true);
  // git 回傳解析過 symlink 的實體路徑（macOS：/var → /private/var），故以 realpath 比對
  assert.equal(wts[0].path, fs.realpathSync(repo));
});

test("listWorktrees: returns empty array for a non-git directory", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spek-nongit-"));
  assert.deepEqual(await listWorktrees(dir), []);
});
