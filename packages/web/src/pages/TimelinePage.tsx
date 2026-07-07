import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useChanges, useGraphData } from "../hooks/useOpenSpec";
import type { ChangeInfo } from "@spek/core";
import { buildLanes, type Lane } from "../components/timeline/grouping";
import { TimelineChart } from "../components/timeline/TimelineChart";
import { changeKey, changeTo } from "../utils/changeLink";

function filterChanges(
  list: ChangeInfo[],
  hideActive: boolean,
  hideArchived: boolean,
): ChangeInfo[] {
  return list.filter((c) => {
    if (hideActive && c.status === "active") return false;
    if (hideArchived && c.status === "archived") return false;
    return true;
  });
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded border transition-colors cursor-pointer ${
        active
          ? "bg-accent/15 border-accent/40 text-accent"
          : "bg-bg-secondary border-border text-text-secondary hover:text-text-primary"
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

export function TimelinePage() {
  const { data, loading, error } = useChanges();
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [hideActive, setHideActive] = useState(false);
  const [hideArchived, setHideArchived] = useState(false);

  // 只在 group toggle 開啟時才 fetch graph
  const graphState = useGraphData();
  const graph = groupByTopic ? graphState.data : null;

  const allChanges = useMemo<ChangeInfo[]>(() => {
    if (!data) return [];
    return [...data.active, ...data.archived];
  }, [data]);

  const filtered = useMemo(
    () => filterChanges(allChanges, hideActive, hideArchived),
    [allChanges, hideActive, hideArchived],
  );

  const { lanes, unknownCreated } = useMemo(
    () => buildLanes(filtered, graph, groupByTopic),
    [filtered, graph, groupByTopic],
  );

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  const totalChanges = allChanges.length;
  const totalLaneItems = lanes.reduce<number>((acc: number, lane: Lane) => acc + lane.items.length, 0);
  const noTimelineData = totalLaneItems === 0;
  const everyChangeMissingDate =
    totalChanges > 0 && allChanges.every((c) => !c.createdDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timeline</h1>
        <p className="text-text-muted text-sm mt-1">
          Lifecycle of every change as a horizontal Gantt-style timeline.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterChip
          label={groupByTopic ? "Grouped by topic" : "Group by topic"}
          active={groupByTopic}
          onClick={() => setGroupByTopic((v) => !v)}
        />
        <div className="h-4 w-px bg-border" />
        <FilterChip
          label="Hide active"
          active={hideActive}
          onClick={() => setHideActive((v) => !v)}
        />
        <FilterChip
          label="Hide archived"
          active={hideArchived}
          onClick={() => setHideArchived((v) => !v)}
        />
      </div>

      {/* Empty states */}
      {totalChanges === 0 && (
        <div className="rounded border border-border bg-bg-secondary p-6 text-text-muted text-sm">
          No changes found in this repo.
        </div>
      )}

      {totalChanges > 0 && everyChangeMissingDate && (
        <div className="rounded border border-border bg-bg-secondary p-6 text-text-muted text-sm">
          No created dates are available for these changes, so there&apos;s nothing to place on the timeline.
        </div>
      )}

      {totalChanges > 0 && !everyChangeMissingDate && noTimelineData && (
        <div className="rounded border border-border bg-bg-secondary p-6 text-text-muted text-sm">
          No changes match the current filters.
        </div>
      )}

      {/* Chart */}
      {totalLaneItems > 0 && <TimelineChart lanes={lanes} groupByTopic={groupByTopic} />}

      {/* Unknown created */}
      {unknownCreated.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary mb-2">
            Unknown created ({unknownCreated.length})
          </h2>
          <ul className="space-y-1">
            {unknownCreated.map((c) => (
              <li key={changeKey(c)}>
                <Link
                  to={changeTo(c)}
                  className="text-xs text-text-muted hover:text-text-primary font-mono"
                  title={c.description}
                >
                  {c.slug}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
