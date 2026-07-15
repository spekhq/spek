import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { scanOpenSpecAggregated, buildGraphDataAggregated, pickActiveWinners } from "./scanner.js";
import type { WorktreeInfo } from "./types.js";

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

// 在指定目錄（worktree）為某 change 寫入 tasks.md，completed/total 決定勾選數，供 taskStats 斷言。
function writeTasks(dir: string, slug: string, completed: number, total: number): void {
  const lines = Array.from({ length: total }, (_, i) => `- [${i < completed ? "x" : " "}] task ${i}`);
  writeFile(path.join(dir, "openspec", "changes", slug, "tasks.md"), `## Tasks\n${lines.join("\n")}\n`);
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

test("scanOpenSpecAggregated: when two worktrees both diverge on a slug, newest mtime wins the tiebreak", async () => {
  const repo = initRepo("spek-agg-dup-");
  writeFile(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  addActiveChange(wtA, "shared");
  writeTasks(wtA, "shared", 1, 2);
  commitAll(wtA, "a");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);
  addActiveChange(wtB, "shared");
  writeTasks(wtB, "shared", 2, 2);
  commitAll(wtB, "b");
  // 兩者皆確實分歧（各自 commit 了 shared）；tiebreak 才輪到 mtime。B 的副本給予明確較新的
  // mtime，模擬 B 才是目前正在編輯此 change 的 worktree。
  const past = new Date("2020-01-01T00:00:00Z");
  const future = new Date("2030-01-01T00:00:00Z");
  for (const f of ["proposal.md", "tasks.md"]) {
    fs.utimesSync(path.join(wtA, "openspec", "changes", "shared", f), past, past);
    fs.utimesSync(path.join(wtB, "openspec", "changes", "shared", f), future, future);
  }

  const r = await scanOpenSpecAggregated(repo);
  const shared = r.activeChanges.filter((c) => c.slug === "shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].source?.branch, "wb");
  assert.deepEqual(shared[0].taskStats, { total: 2, completed: 2 });
});

test("scanOpenSpecAggregated: a worktree that edits a change shadows main's copy of that slug", async () => {
  const repo = initRepo("spek-agg-shadow-");
  addActiveChange(repo, "shared");
  writeTasks(repo, "shared", 0, 2);
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  writeTasks(wtA, "shared", 2, 2); // wa 實際編輯（未提交分歧）

  const r = await scanOpenSpecAggregated(repo);
  const shared = r.activeChanges.filter((c) => c.slug === "shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].source?.isMain, false);
  assert.equal(shared[0].source?.branch, "wa");
  assert.deepEqual(shared[0].taskStats, { total: 2, completed: 2 });
});

test("scanOpenSpecAggregated: an idle fork created later does not roll back the editing worktree's progress", async () => {
  // main 有 change-a（基準 0/4）；wa 提交推進到 3/4；之後才建立 wb（繼承 0/4，從未編輯）。
  // wb 的 checkout mtime 較新，舊的 mtime 規則會讓 wb 勝出而回捲成 0/4；分歧選舉須讓 wa 以 3/4 勝出。
  const repo = initRepo("spek-agg-scenario1-");
  addActiveChange(repo, "change-a");
  writeTasks(repo, "change-a", 0, 4);
  commitAll(repo, "init change-a at 0/4");
  const wa = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wa);
  writeTasks(wa, "change-a", 3, 4);
  commitAll(wa, "advance change-a to 3/4");
  const wb = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wb);

  const r = await scanOpenSpecAggregated(repo);
  const changeA = r.activeChanges.filter((c) => c.slug === "change-a");
  assert.equal(changeA.length, 1);
  assert.equal(changeA[0].source?.branch, "wa");
  assert.deepEqual(changeA[0].taskStats, { total: 4, completed: 3 });
});

test("scanOpenSpecAggregated: main's uncommitted progress wins over an idle fork that inherited the baseline", async () => {
  // main 有 change-x（基準 0/4）；建立 wb 繼承 0/4；之後 main 把 change-x 編輯到 4/4 但未提交。
  // wb 繼承的副本 == main 的 HEAD、但 != main 工作區 → wb 未分歧 → main 以工作區的 4/4 勝出。
  const repo = initRepo("spek-agg-scenario2-");
  addActiveChange(repo, "change-x");
  writeTasks(repo, "change-x", 0, 4);
  commitAll(repo, "init change-x at 0/4");
  const wb = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wb);
  writeTasks(repo, "change-x", 4, 4); // main 編輯到 4/4，未提交

  const r = await scanOpenSpecAggregated(repo);
  const changeX = r.activeChanges.filter((c) => c.slug === "change-x");
  assert.equal(changeX.length, 1);
  assert.equal(changeX[0].source?.isMain, true);
  assert.deepEqual(changeX[0].taskStats, { total: 4, completed: 4 });
});

test("scanOpenSpecAggregated: main's committed advance wins over an idle fork that inherited the baseline", async () => {
  // main 有 change-x（基準 0/4）；建立 wb 繼承 0/4；之後 main 把 change-x 推進到 4/4 並「提交」。
  // wb 只是繼承、從未編輯 → 不因 main 自己的提交而分歧（三點 diff 對照 merge-base）→ main 以 4/4 勝出。
  const repo = initRepo("spek-agg-main-committed-");
  addActiveChange(repo, "change-x");
  writeTasks(repo, "change-x", 0, 4);
  commitAll(repo, "init change-x at 0/4");
  const wb = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wb); // inherits 0/4
  writeTasks(repo, "change-x", 4, 4);
  commitAll(repo, "main advances change-x to 4/4"); // COMMITTED, mainHead now != wb's head

  const r = await scanOpenSpecAggregated(repo);
  const changeX = r.activeChanges.filter((c) => c.slug === "change-x");
  assert.equal(changeX.length, 1);
  assert.equal(changeX[0].source?.isMain, true);
  assert.deepEqual(changeX[0].taskStats, { total: 4, completed: 4 });
});

test("pickActiveWinners: a worktree whose divergence check fails does not shadow main", async () => {
  // 注入一個永遠回空集合的 divergence provider，模擬對該 worktree 的 git 指令失敗。
  // fork 持有 foo 但被判為未分歧 → main 保留 foo（不因 git 失敗而錯顯 fork 的繼承副本）。
  const mainWt: WorktreeInfo = { path: "/repo", branch: "main", head: "aaa", isMain: true, isBare: false, key: "m" };
  const fork: WorktreeInfo = { path: "/repo-x", branch: "wx", head: "bbb", isMain: false, isBare: false, key: "x" };
  const failing = async () => new Set<string>();

  const winners = await pickActiveWinners(
    [
      { wt: mainWt, slugs: ["foo"] },
      { wt: fork, slugs: ["foo"] },
    ],
    mainWt,
    failing,
  );
  assert.equal(winners.get("foo"), mainWt);
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
  writeTasks(repo, "main-only", 2, 3);
  commitAll(repo, "main change after fork");

  const r = await scanOpenSpecAggregated(repo);
  const mainOnly = r.activeChanges.filter((c) => c.slug === "main-only");
  assert.equal(mainOnly.length, 1);
  assert.equal(mainOnly[0].source?.isMain, true);
  assert.deepEqual(mainOnly[0].taskStats, { total: 3, completed: 2 });
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
  // 自然建立順序：main-change 先於 fork 提交，wtB 繼承但從未編輯 → 分歧選舉讓 main-change 留在 main、
  // b-change 歸 wtB，兩者不因 dedup 合併（不需舊 mtime 規則下「先分岔」的 fixture 繞法）。
  const repo = initRepo("spek-agg-divergent-");
  writeFile(path.join(repo, "openspec", "config.yaml"), "schema: spec-driven\n");
  addActiveChange(repo, "main-change");
  commitAll(repo, "init with main-change");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);
  writeFile(path.join(wtB, "openspec", "config.yaml"), "schema: agent-driven\n");
  addActiveChange(wtB, "b-change");
  commitAll(wtB, "b diverge");

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
  // add-foo 存在於主 repo（先 commit）與 wtA（分岔後繼承並實際編輯 → 分歧）→ 合併成一個節點，來源為 wtA
  const repo = initRepo("spek-agg-graph-dedup-");
  writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
  addActiveChange(repo, "add-foo", "alpha");
  commitAll(repo, "init");
  const wtA = repo + "-a";
  git(repo, "worktree", "add", "-q", "-b", "wa", wtA);
  writeFile(path.join(wtA, "openspec", "changes", "add-foo", "proposal.md"), "## Why\nedited in wa\n");

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

test("buildGraphDataAggregated: an inherited-but-untouched fork does not own the change node", async () => {
  // main 有 add-foo（含 delta spec）；wtB 分岔後繼承但從未編輯 → 節點歸 main，非 wtB；
  // 且與 list 路徑選出相同的勝出者（both via pickActiveWinners），historyCount 去重為 1。
  const repo = initRepo("spek-agg-graph-inherit-");
  writeFile(path.join(repo, "openspec", "specs", "alpha", "spec.md"), "## Requirements\n");
  addActiveChange(repo, "add-foo", "alpha");
  commitAll(repo, "init");
  const wtB = repo + "-b";
  git(repo, "worktree", "add", "-q", "-b", "wb", wtB);

  const g = await buildGraphDataAggregated(repo);
  const changeNodes = g.nodes.filter((n) => n.type === "change");
  assert.equal(changeNodes.length, 1);
  assert.equal(changeNodes[0].source?.isMain, true);
  const changeEdges = g.edges.filter((e) => e.source === changeNodes[0].id);
  assert.equal(changeEdges.length, 1);
  const specNode = g.nodes.find((n) => n.id === "spec:alpha");
  assert.equal(specNode?.historyCount, 1);
});
