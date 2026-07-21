import { useState } from "react";
import { Link } from "react-router-dom";
import type { ChangeInfo } from "@spekjs/core";
import { useChanges } from "../hooks/useOpenSpec";
import { TaskProgress } from "../components/TaskProgress";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { formatLifecycleListRow, todayIso } from "../utils/lifecycle";
import { getAggregatePref, setAggregatePref } from "../utils/aggregatePref";
import { getJjWorkspacePref, setJjWorkspacePref } from "../utils/jjWorkspacePref";
import { levelFromPrefs, prefsFromLevel, type AggLevel } from "../utils/aggregationLevel";
import { WorktreeBadge } from "../components/WorktreeBadge";
import { SchemaBadge } from "../components/SchemaBadge";
import { changeKey, changeTo } from "../utils/changeLink";

function changeMetaDisplay(c: ChangeInfo, today: string): { text: string; tooltip: string } | null {
  const lifecycle = formatLifecycleListRow(c, today);
  const tooltipParts: string[] = [];
  if (c.createdDate) tooltipParts.push(`Created: ${c.createdDate}`);
  if (c.archivedDate) tooltipParts.push(`Archived: ${c.archivedDate}`);
  if (c.timestamp) tooltipParts.push(`First commit: ${c.timestamp}`);
  if (lifecycle) {
    return { text: lifecycle, tooltip: tooltipParts.join("\n") };
  }
  if (c.timestamp) {
    return { text: formatRelativeTime(c.timestamp), tooltip: tooltipParts.join("\n") || c.timestamp };
  }
  if (c.date) {
    return { text: c.date, tooltip: c.date };
  }
  return null;
}

function ChangeRow({ c, today, accent, showSource }: {
  c: ChangeInfo;
  today: string;
  accent: boolean;
  showSource: boolean;
}) {
  const meta = changeMetaDisplay(c, today);
  return (
    <Link
      to={changeTo(c)}
      className={`block bg-bg-secondary border border-border rounded p-4 hover:border-accent transition-colors${
        accent ? " border-l-4 border-l-accent" : ""
      }`}
    >
      <div className={`flex items-center justify-between gap-4${accent ? " mb-2" : ""}`}>
        <span className="flex items-center gap-2 min-w-0">
          <span className={`truncate ${accent ? "text-text-primary font-medium" : "text-text-primary"}`}>
            {c.description}
          </span>
          {showSource && c.source && <WorktreeBadge source={c.source} />}
          {c.isCurrent && (
            <span
              className="shrink-0 text-[11px] text-accent border border-accent/40 rounded px-1.5 py-0.5"
              title="目前 jj working copy (@) 正在編輯這個 change"
            >
              editing
            </span>
          )}
          {c.conflictsWith && (
            <span
              className="shrink-0 text-[11px] text-amber-400 border border-amber-400/40 rounded px-1.5 py-0.5"
              title={`此 jj workspace 的版本與 ${c.conflictsWith} 的內容分歧`}
            >
              conflicts with {c.conflictsWith}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <SchemaBadge schema={c.schema} defaultSchema={c.defaultSchema} />
          {meta && (
            <span
              className="text-text-muted text-xs whitespace-nowrap tracking-wide [word-spacing:0.15em]"
              title={meta.tooltip}
            >
              {meta.text}
            </span>
          )}
        </span>
      </div>
      {accent && c.taskStats && (
        <TaskProgress completed={c.taskStats.completed} total={c.taskStats.total} />
      )}
    </Link>
  );
}

// VS Code webview 由 `spek.aggregateJjWorkspaces` 設定（extension host 讀取）控制 jj 納入，
// 故在 VS Code 隱藏這個 Web 專用的 localStorage 開關，避免與設定衝突（兩個真相來源會互相打架）。
const isVsCodeWebview =
  typeof window !== "undefined" &&
  !!(window as unknown as Record<string, unknown>).__vscodeApi;

// 網頁版聚合範圍的 tri-state 選項（off / worktrees / worktrees+jj）。
const AGG_LEVELS: { value: AggLevel; text: string; title: string }[] = [
  { value: "off", text: "Current dir", title: "Show only the current directory's changes" },
  { value: "worktrees", text: "Worktrees", title: "Aggregate across all git worktrees" },
  {
    value: "worktrees-jj",
    text: "Worktrees + jj",
    title: "Aggregate git worktrees and jj workspaces (experimental)",
  },
];

export function ChangeList() {
  const [aggregate, setAggregate] = useState(getAggregatePref());
  const [includeJj, setIncludeJj] = useState(getJjWorkspacePref());
  const { data, loading, error } = useChanges(aggregate, includeJj);

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  const active = data?.active ?? [];
  const archived = data?.archived ?? [];
  const worktrees = data?.worktrees ?? [];
  const showSource = !!data?.aggregated && worktrees.length > 1;
  // jj workspace 存在（或目前關閉著、需可重新開啟）時才顯示 jj 開關
  const hasJj = worktrees.some((w) => w.vcs === "jj");
  const defaultSchema = data?.defaultSchema;
  const today = todayIso();

  // 網頁版：以 tri-state 收斂 aggregate + jj 兩個相依旗標，從結構杜絕「aggregate off + jj on」。
  // 有多個 worktree、偵測到 jj、或 jj 目前關著（可 opt-in）時顯示。
  const level = levelFromPrefs(aggregate, includeJj);
  const setLevel = (next: AggLevel) => {
    const p = prefsFromLevel(next);
    setAggregate(p.aggregate);
    setAggregatePref(p.aggregate);
    setIncludeJj(p.includeJj);
    setJjWorkspacePref(p.includeJj);
  };
  const showAggControl = !isVsCodeWebview && (worktrees.length > 1 || hasJj || !includeJj);

  // VS Code webview：jj 由 `spek.aggregateJjWorkspaces` 設定控制（handler 忽略 includeJj），
  // 故只保留 aggregate 勾選框。
  const handleToggle = () => {
    const next = !aggregate;
    setAggregate(next);
    setAggregatePref(next);
  };

  const header = (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Changes</h1>
        <div className="flex items-center gap-4">
          {showAggControl && (
            <div
              role="group"
              aria-label="Aggregation scope"
              className="inline-flex items-center gap-0.5 rounded border border-border bg-bg-tertiary p-0.5 text-[11px]"
            >
              {AGG_LEVELS.map((opt) => {
                const active = level === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setLevel(opt.value)}
                    title={opt.title}
                    className={
                      "rounded px-1.5 py-0.5 transition-colors " +
                      (active
                        ? "bg-bg-secondary text-accent font-medium"
                        : "text-text-muted hover:text-text-secondary")
                    }
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
          )}
          {isVsCodeWebview && worktrees.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aggregate}
                onChange={handleToggle}
                className="accent-accent"
              />
              Aggregate {worktrees.length} worktrees
            </label>
          )}
        </div>
      </div>
      {defaultSchema && (
        <p className="mt-1 text-text-muted text-sm" title="Repo default OpenSpec schema">
          Default schema: <span className="text-text-secondary">{defaultSchema}</span>
        </p>
      )}
    </div>
  );

  if (active.length === 0 && archived.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-text-muted">No changes found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      {active.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Active</h2>
          <div className="space-y-2">
            {active.map((c) => (
              <ChangeRow key={changeKey(c)} c={c} today={today} accent showSource={showSource} />
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Archived</h2>
          <div className="space-y-2">
            {archived.map((c) => (
              <ChangeRow key={changeKey(c)} c={c} today={today} accent={false} showSource={showSource} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
