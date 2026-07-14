import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { divergedSlugs } from "./divergence.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
  });
}

function writeFile(p: string, content: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function head(dir: string): string {
  return git(dir, "rev-parse", "HEAD").trim();
}

function initRepo(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  return dir;
}

function change(dir: string, slug: string, body = "## Why\ndemo\n"): void {
  writeFile(path.join(dir, "openspec", "changes", slug, "proposal.md"), body);
}

function commitAll(dir: string, msg: string): void {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", msg);
}

test("divergedSlugs: committed progress under a change dir diverges that slug", async () => {
  // main baseline carries `foo`; a linked worktree commits further progress on `foo`.
  const repo = initRepo("spek-div-committed-");
  change(repo, "foo");
  commitAll(repo, "init");
  const wt = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wt);
  change(wt, "foo", "## Why\nedited in wa\n");
  commitAll(wt, "advance foo");

  const diverged = await divergedSlugs(wt, head(wt), head(repo));
  assert.ok(diverged.has("foo"), "committed advance is detected as divergence");
});

test("divergedSlugs: uncommitted edit diverges; inherited-but-untouched does not", async () => {
  const repo = initRepo("spek-div-uncommitted-");
  change(repo, "foo");
  commitAll(repo, "init");
  const mainHead = head(repo);

  // wtEdit inherits foo, then edits it WITHOUT committing → uncommitted divergence.
  const wtEdit = repo + "-edit";
  git(repo, "worktree", "add", "-q", "-b", "wedit", wtEdit);
  fs.writeFileSync(path.join(wtEdit, "openspec", "changes", "foo", "proposal.md"), "## Why\ndirty\n");
  const edited = await divergedSlugs(wtEdit, head(wtEdit), mainHead);
  assert.ok(edited.has("foo"), "uncommitted edit under the change dir diverges the slug");

  // wtIdle inherits foo and never touches it → no divergence (heads equal, clean status).
  const wtIdle = repo + "-idle";
  git(repo, "worktree", "add", "-q", "-b", "widle", wtIdle);
  const idle = await divergedSlugs(wtIdle, head(wtIdle), mainHead);
  assert.equal(idle.size, 0, "an untouched inherited copy does not diverge");
});

test("divergedSlugs: a failing git command yields no divergence (resolve-empty-on-error)", async () => {
  // A real committed advance exists, but the diff is forced to fail via a bogus main head.
  // With a clean working tree, the union must resolve empty rather than throw.
  const repo = initRepo("spek-div-error-");
  change(repo, "foo");
  commitAll(repo, "init");
  const wt = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wt);
  change(wt, "foo", "## Why\nedited in wa\n");
  commitAll(wt, "advance foo");

  const diverged = await divergedSlugs(wt, head(wt), "0000000000000000000000000000000000000000");
  assert.equal(diverged.size, 0, "diff failure is swallowed and no slug is reported");
});
