import { useMemo, useState } from "react";
import type { SpecInfo } from "@spekjs/core";
import { buildSpecTree } from "@spekjs/core/spec-topic";
import { useSpecs } from "../hooks/useOpenSpec";
import { useSpecTreeCollapsed, foldablePaths } from "../hooks/useSpecTreeCollapsed";
import { useRepo } from "../contexts/RepoContext";
import { SpecTree } from "../components/SpecTree";
import { SpecTreeControls } from "../components/SpecTreeControls";

export function SpecList() {
  const { data, loading, error } = useSpecs();

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-status-error">Error: {error}</p>;

  return <SpecListBody specs={data ?? []} />;
}

/**
 * Mounted only once the specs have arrived, so the collapsed-folder state is never read or pruned
 * against a list that is still loading.
 */
function SpecListBody({ specs }: { specs: SpecInfo[] }) {
  const { repoPath } = useRepo();
  const [filter, setFilter] = useState("");
  // From the unfiltered list: writes are pruned to it, and the controls must not vanish while typing.
  const foldable = useMemo(() => foldablePaths(buildSpecTree(specs)), [specs]);
  const { collapsed, toggle, collapseAll, expandAll } = useSpecTreeCollapsed(repoPath, foldable);
  const filtering = filter !== "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Specs</h1>
        <span className="text-text-muted text-sm">{specs.length} topics</span>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter specs..."
          className="flex-1 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <SpecTreeControls
          hasFolders={foldable.length > 0}
          filtering={filtering}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
      </div>

      <SpecTree specs={specs} filter={filter} collapsed={collapsed} onToggle={toggle} />
    </div>
  );
}
