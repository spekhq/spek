import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { WorktreeInfo } from "@spekjs/core";
import { useRepo } from "./RepoContext";
import { useApiAdapter } from "../api/ApiAdapterContext";
import { useRefreshKey } from "./RefreshContext";
import { getAggregatePref } from "../utils/aggregatePref";
import { getJjWorkspacePref } from "../utils/jjWorkspacePref";
import { levelFromPrefs, prefsFromLevel, type AggLevel } from "../utils/aggregationLevel";

// Single source of truth for the app-wide aggregation scope. Collapses the two dependent preferences
// (aggregate + jj) into one tri-state level, and holds the detected worktree list so the header
// control can decide its visibility and whether to offer the jj option.
//
// The preference is read and written through the adapter (getAggregationPrefs / setAggregationPrefs),
// so the same context works for both hosts: on the Web it is backed by localStorage; in the VS Code
// webview it is backed by the VS Code settings.
interface AggregationScopeValue {
  level: AggLevel;
  setLevel: (level: AggLevel) => void;
  aggregate: boolean;
  includeJj: boolean;
  worktrees: WorktreeInfo[];
  hasJj: boolean;
}

const AggregationScopeContext = createContext<AggregationScopeValue | null>(null);

export function AggregationScopeProvider({ children }: { children: ReactNode }) {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const refreshKey = useRefreshKey();
  // Seed synchronously from localStorage so the Web app renders without a flash; the adapter
  // reconcile below corrects it for the VS Code host (where settings are the source of truth).
  const [aggregate, setAggregate] = useState(getAggregatePref());
  const [includeJj, setIncludeJj] = useState(getJjWorkspacePref());
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);

  const setLevel = useCallback(
    (next: AggLevel) => {
      const p = prefsFromLevel(next);
      setAggregate(p.aggregate); // optimistic
      setIncludeJj(p.includeJj);
      void adapter.setAggregationPrefs(p.aggregate, p.includeJj).catch(() => {});
    },
    [adapter],
  );

  // Reconcile the level from the host's source of truth on mount and on every refresh / live-reload
  // signal (so an external VS Code settings edit flows into the control).
  useEffect(() => {
    let cancelled = false;
    adapter
      .getAggregationPrefs()
      .then((p) => {
        if (!cancelled) {
          setAggregate(p.aggregate);
          setIncludeJj(p.includeJj);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adapter, refreshKey]);

  // Discover worktrees with jj enabled, so the control knows whether a jj option is available,
  // independent of the current scope. Re-fetch on repo change and on the refresh signal.
  useEffect(() => {
    if (!repoPath) {
      setWorktrees([]);
      return;
    }
    let cancelled = false;
    adapter
      .getWorktrees(true)
      .then((wts) => {
        if (!cancelled) setWorktrees(wts);
      })
      .catch(() => {
        if (!cancelled) setWorktrees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, adapter, refreshKey]);

  const level = levelFromPrefs(aggregate, includeJj);
  const hasJj = worktrees.some((w) => w.vcs === "jj");

  return (
    <AggregationScopeContext.Provider
      value={{ level, setLevel, aggregate, includeJj, worktrees, hasJj }}
    >
      {children}
    </AggregationScopeContext.Provider>
  );
}

export function useAggregationScope(): AggregationScopeValue {
  const ctx = useContext(AggregationScopeContext);
  if (!ctx) throw new Error("useAggregationScope must be used within AggregationScopeProvider");
  return ctx;
}
