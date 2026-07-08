import { useState } from "react";
import { Link } from "react-router-dom";
import type { ChangeInfo } from "@spek/core";
import { useChanges } from "../hooks/useOpenSpec";
import { TaskProgress } from "../components/TaskProgress";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { formatLifecycleListRow, todayIso } from "../utils/lifecycle";
import { getAggregatePref, setAggregatePref } from "../utils/aggregatePref";
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

function ChangeRow({ c, today, accent, showSource, defaultSchema }: {
  c: ChangeInfo;
  today: string;
  accent: boolean;
  showSource: boolean;
  defaultSchema: string | null | undefined;
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
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <SchemaBadge schema={c.schema} defaultSchema={defaultSchema} />
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

export function ChangeList() {
  const [aggregate, setAggregate] = useState(getAggregatePref());
  const { data, loading, error } = useChanges(aggregate);

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  const active = data?.active ?? [];
  const archived = data?.archived ?? [];
  const worktrees = data?.worktrees ?? [];
  const showSource = !!data?.aggregated && worktrees.length > 1;
  const defaultSchema = data?.defaultSchema;
  const today = todayIso();

  const handleToggle = () => {
    const next = !aggregate;
    setAggregate(next);
    setAggregatePref(next);
  };

  const header = (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Changes</h1>
        {worktrees.length > 1 && (
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
              <ChangeRow key={changeKey(c)} c={c} today={today} accent showSource={showSource} defaultSchema={defaultSchema} />
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Archived</h2>
          <div className="space-y-2">
            {archived.map((c) => (
              <ChangeRow key={changeKey(c)} c={c} today={today} accent={false} showSource={showSource} defaultSchema={defaultSchema} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
