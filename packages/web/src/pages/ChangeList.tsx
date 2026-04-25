import { Link } from "react-router-dom";
import type { ChangeInfo } from "@spek/core";
import { useChanges } from "../hooks/useOpenSpec";
import { TaskProgress } from "../components/TaskProgress";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { formatLifecycleListRow, todayIso } from "../utils/lifecycle";

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

export function ChangeList() {
  const { data, loading, error } = useChanges();

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  const active = data?.active ?? [];
  const archived = data?.archived ?? [];
  const today = todayIso();

  if (active.length === 0 && archived.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Changes</h1>
        <p className="text-text-muted">No changes found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Changes</h1>

      {/* Active */}
      {active.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Active</h2>
          <div className="space-y-2">
            {active.map((c) => {
              const meta = changeMetaDisplay(c, today);
              return (
                <Link
                  key={c.slug}
                  to={`/changes/${c.slug}`}
                  className="block bg-bg-secondary border border-border border-l-4 border-l-accent rounded p-4 hover:border-accent transition-colors"
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="text-text-primary font-medium truncate">{c.description}</span>
                    {meta && (
                      <span className="text-text-muted text-xs whitespace-nowrap shrink-0 tracking-wide [word-spacing:0.15em]" title={meta.tooltip}>
                        {meta.text}
                      </span>
                    )}
                  </div>
                  {c.taskStats && (
                    <TaskProgress completed={c.taskStats.completed} total={c.taskStats.total} />
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Archived</h2>
          <div className="space-y-2">
            {archived.map((c) => {
              const meta = changeMetaDisplay(c, today);
              return (
                <Link
                  key={c.slug}
                  to={`/changes/${c.slug}`}
                  className="block bg-bg-secondary border border-border rounded p-4 hover:border-accent transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-text-primary truncate">{c.description}</span>
                    {meta && (
                      <span className="text-text-muted text-xs whitespace-nowrap shrink-0 tracking-wide [word-spacing:0.15em]" title={meta.tooltip}>
                        {meta.text}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
