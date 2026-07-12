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

test("scanOpenSpecAggregated: same active slug in two worktrees dedupes to the most recently modified copy", async () => {
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
  // B 的 proposal.md 給予明確較新的 mtime，模擬 B 才是目前正在編輯此 change 的 worktree
  const past = new Date("2020-01-01T00:00:00Z");
  const future = new Date("2030-01-01T00:00:00Z");
  fs.utimesSync(path.join(wtA, "openspec", "changes", "shared", "proposal.md"), past, past);
  fs.utimesSync(path.join(wtB, "openspec", "changes", "shared", "proposal.md"), future, future);

  const r = await scanOpenSpecAggregated(repo);
  const shared = r.activeChanges.filter((c) => c.slug === "shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].source?.branch, "wb");
});

test("scanOpenSpecAggregated: worktree copy of an active change shadows main's copy", async () => {
  const repo = initRepo("spek-agg-shadow-");
  addActiveChange(repo, "shared");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);

  const r = await scanOpenSpecAggregated(repo);
  const shared = r.activeChanges.filter((c) => c.slug === "shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].source?.isMain, false);
  assert.equal(shared[0].source?.branch, "wa");
});

test("scanOpenSpecAggregated: active change absent from every worktree stays on main", async () => {
  // wtA 先分岔，之後才在主 repo 新增 main-only → wtA 的樹裡根本沒有這個 change 目錄
  const repo = initRepo("spek-agg-main-only-");
  writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  addActiveChange(wtA, "other");
  commitAll(wtA, "a");
  addActiveChange(repo, "main-only");
  commitAll(repo, "main change after fork");

  const r = await scanOpenSpecAggregated(repo);
  const mainOnly = r.activeChanges.filter((c) => c.slug === "main-only");
  assert.equal(mainOnly.length, 1);
  assert.equal(mainOnly[0].source?.isMain, true);
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

test("scanOpenSpecAggregated: each change carries its own worktree's defaultSchema", async () => {
  // 主 worktree 預設 spec-driven；worktree B 的 config.yaml 分歧為 agent-driven。
  // B 的 change 未宣告自己的 schema → 繼承 B 的預設；其 defaultSchema 必須是 B 的（agent-driven），
  // 而非主 worktree 的（spec-driven），否則 list badge 會對錯基準而誤顯示。
  // wtB 先分岔，main-change 之後才加到主 repo，兩個 change 才不會因 dedup 而合併成一筆。
  const repo = initRepo("spek-agg-divergent-");
  writeFile(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  commitAll(repo, "init");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);
  writeFile(path.join(wtB, "openspec", "config.yaml"), "schema: agent-driven\n");
  addActiveChange(wtB, "b-change");
  commitAll(wtB, "b diverge");
  addActiveChange(repo, "main-change");
  commitAll(repo, "main change after fork");

  const r = await scanOpenSpecAggregated(repo);
  const bChange = r.activeChanges.find((c) => c.slug === "b-change");
  const mainChange = r.activeChanges.find((c) => c.slug === "main-change");
  assert.ok(bChange);
  assert.ok(mainChange);
  // B 的 change：schema 與 defaultSchema 都是 B 的 agent-driven → badge 應隱藏（無誤報）
  assert.equal(bChange.schema, "agent-driven");
  assert.equal(bChange.defaultSchema, "agent-driven");
  // 主 worktree 的 change：defaultSchema 為 spec-driven
  assert.equal(mainChange.defaultSchema, "spec-driven");
  // 聚合結果的 header defaultSchema 仍取主 worktree
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

test("buildGraphDataAggregated: deduplicates active change nodes shared with main", async () => {
  // add-foo 存在於主 repo（先 commit）與 wtA（分岔後繼承）→ 應合併成一個節點，來源為 wtA
  const repo = initRepo("spek-agg-graph-dedup-");
  writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
  addActiveChange(repo, "add-foo", "alpha");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);

  const g = await buildGraphDataAggregated(repo);
  const changeNodes = g.nodes.filter((n) => n.type === "change");
  assert.equal(changeNodes.length, 1);
  assert.equal(changeNodes[0].source?.isMain, false);

  const changeEdges = g.edges.filter((e) => e.source === changeNodes[0].id);
  assert.equal(changeEdges.length, 1);
  const specNode = g.nodes.find((n) => n.id === "spec:alpha");
  assert.ok(specNode);
  assert.equal(specNode.historyCount, 1);
});
