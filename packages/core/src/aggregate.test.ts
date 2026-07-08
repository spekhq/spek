import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { scanOpenSpecAggregated, buildGraphDataAggregated } from "./scanner.js";

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, {
    cwd,
    stdio: "pipe",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
  });
}

function writeFile(p: string, content: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function commitAll(dir: string, msg: string): void {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", msg);
}

function initRepo(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
  return dir;
}

function addActiveChange(repoDir: string, slug: string, specTopic?: string): void {
  const base = path.join(repoDir, "openspec", "changes", slug);
  writeFile(path.join(base, "proposal.md"), "## Why\ndemo\n");
  if (specTopic) {
    writeFile(path.join(base, "specs", specTopic, "spec.md"), "## ADDED Requirements\n");
  }
}

// 主 repo（branch main）含 1 spec + 1 archived change；worktree A 帶 add-a（含 delta spec）；
// worktree B 帶 add-b（無 spec）。A、B 皆繼承主 repo 的 archived change。
function makeAggRepo(): string {
  const repo = initRepo("spek-agg-");
  writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
  writeFile(
    path.join(repo, "openspec", "changes", "archive", "2026-01-01-old", "proposal.md"),
    "## Why\n",
  );
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  addActiveChange(wtA, "add-a", "alpha");
  commitAll(wtA, "change a");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);
  addActiveChange(wtB, "add-b");
  commitAll(wtB, "change b");
  return repo;
}

test("scanOpenSpecAggregated: aggregates active changes across worktrees with source", async () => {
  const repo = makeAggRepo();
  const r = await scanOpenSpecAggregated(repo);
  assert.equal(r.aggregated, true);
  assert.equal(r.worktrees.length, 3);
  assert.deepEqual(r.activeChanges.map((c) => c.slug).sort(), ["add-a", "add-b"]);
  for (const c of r.activeChanges) {
    assert.ok(c.source, "every aggregated active change carries a source");
  }
  // specs 取主 worktree
  assert.deepEqual(r.specs.map((s) => s.topic), ["alpha"]);
});

test("scanOpenSpecAggregated: deduplicates archived changes by slug", async () => {
  const repo = makeAggRepo();
  const r = await scanOpenSpecAggregated(repo);
  // 2026-01-01-old 存在於主 repo 與兩個 worktree（繼承），去重後只剩一筆
  assert.equal(r.archivedChanges.filter((c) => c.slug === "2026-01-01-old").length, 1);
});

test("scanOpenSpecAggregated: same active slug in two worktrees kept separately", async () => {
  const repo = initRepo("spek-agg-dup-");
  writeFile(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  addActiveChange(wtA, "shared");
  commitAll(wtA, "a");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);
  addActiveChange(wtB, "shared");
  commitAll(wtB, "b");

  const r = await scanOpenSpecAggregated(repo);
  const shared = r.activeChanges.filter((c) => c.slug === "shared");
  assert.equal(shared.length, 2);
  assert.notEqual(shared[0].source?.key, shared[1].source?.key);
});

test("scanOpenSpecAggregated: carries the main worktree's defaultSchema", async () => {
  // config.yaml 於建立 worktree 前 commit，故各 worktree 皆繼承同一份；聚合結果的
  // defaultSchema 取主 worktree（見 scanner），供 list badge 的隱藏基準。
  const repo = initRepo("spek-agg-schema-");
  writeFile(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  addActiveChange(wtA, "add-a");
  commitAll(wtA, "a");
  const r = await scanOpenSpecAggregated(repo);
  assert.equal(r.aggregated, true);
  assert.equal(r.defaultSchema, "spec-driven");
});

test("scanOpenSpecAggregated: single worktree falls back without source", async () => {
  const repo = initRepo("spek-agg-single-");
  addActiveChange(repo, "only-one");
  commitAll(repo, "init");
  const r = await scanOpenSpecAggregated(repo);
  assert.equal(r.aggregated, false);
  assert.equal(r.activeChanges.length, 1);
  assert.equal(r.activeChanges[0].source, undefined);
});

test("scanOpenSpecAggregated: aggregate=false scans only the given directory", async () => {
  const repo = makeAggRepo();
  const r = await scanOpenSpecAggregated(repo, { aggregate: false });
  assert.equal(r.aggregated, false);
  // 主 worktree 在 branch main，active changes 都在其他 worktree 的分支上
  assert.equal(r.activeChanges.length, 0);
});

test("buildGraphDataAggregated: namespaces change node ids by worktree", async () => {
  const repo = makeAggRepo();
  const g = await buildGraphDataAggregated(repo);
  const changeNodes = g.nodes.filter((n) => n.type === "change");
  // add-a 有 delta spec → 成為節點；add-b 無 spec → 不列入
  assert.equal(changeNodes.length, 1);
  assert.match(changeNodes[0].id, /^change:[0-9a-f]{8}:add-a$/);
  assert.ok(changeNodes[0].source);
  assert.ok(g.nodes.some((n) => n.id === "spec:alpha"));
});
