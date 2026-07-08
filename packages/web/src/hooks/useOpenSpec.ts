import { useState, useEffect, useCallback, useRef } from "react";
import { useRepo } from "../contexts/RepoContext";
import { useApiAdapter } from "../api/ApiAdapterContext";
import { useRefreshKey } from "../contexts/RefreshContext";
import { getAggregatePref } from "../utils/aggregatePref";
import type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  SpecVersionContent,
  HistoryEntry as SpecHistoryEntry,
  ChangeInfo,
  ChangesData,
  ChangeDetail,
  ParsedTasks,
  TaskSection,
  TaskItem,
  BrowseEntry,
  BrowseData,
  DetectData,
  GraphData,
} from "@spek/core";

// Re-export types for existing consumers
export type {
  OverviewData,
  SpecInfo,
  SpecDetail,
  SpecVersionContent,
  ChangeInfo,
  ChangesData,
  ChangeDetail,
  ParsedTasks,
  TaskSection,
  TaskItem,
  BrowseEntry,
  BrowseData,
  DetectData,
};
export type { HistoryEntry as SpecHistoryEntry } from "@spek/core";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsyncData<T>(
  fetcher: (() => Promise<T>) | null,
  deps: unknown[],
): FetchState<T> {
  const refreshKey = useRefreshKey();
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: !!fetcher,
    error: null,
  });
  const isRefresh = useRef(false);
  const prevRefreshKey = useRef(refreshKey);

  useEffect(() => {
    // 判斷是否為 refreshKey 觸發的 re-fetch
    const refreshTriggered = prevRefreshKey.current !== refreshKey;
    prevRefreshKey.current = refreshKey;

    if (!fetcher) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;

    const doFetch = () => {
      // refreshKey 觸發時保留既有 data，不顯示 loading flash
      if (!refreshTriggered) {
        setState({ data: null, loading: true, error: null });
      }

      fetcher()
        .then((data) => {
          if (!cancelled) setState({ data, loading: false, error: null });
        })
        .catch((err) => {
          if (!cancelled)
            setState((prev) => ({
              data: refreshTriggered ? prev.data : null,
              loading: false,
              error: refreshTriggered && prev.data ? null : err.message,
            }));
        });
    };

    // refreshKey 觸發時加 debounce 300ms
    if (refreshTriggered) {
      const timer = setTimeout(doFetch, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    doFetch();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey]);

  return state;
}

// --- OpenSpec API hooks ---

export function useOverview(aggregate?: boolean): FetchState<OverviewData> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const agg = aggregate ?? getAggregatePref();
  return useAsyncData(
    repoPath ? () => adapter.getOverview(agg) : null,
    [repoPath, agg],
  );
}

// repo 預設 schema 是 repo 級、極少變動的靜態值，不該每次進頁面都重打 API 造成閃爍。
// 以 repoPath 為 key 做跨導覽的模組層快取，並記住抓取當下的 refreshKey generation。
interface DefaultSchemaCacheEntry {
  refreshKey: number;
  value: string | null;
}
const defaultSchemaCache = new Map<string, DefaultSchemaCacheEntry>();

// 純函式：決定目前快取是否仍新鮮（同 repo 且與快取時的 refreshKey generation 相同）。
// refreshKey 只要偵測到任何檔案變更就會遞增，故只要 config.yaml（或任何檔案）變過，
// 下次進頁面就會 miss 而重抓 —— 即使變更發生時 Specs 頁未掛載也能自癒。匯出供測試。
export function resolveCachedDefaultSchema(
  cache: Map<string, DefaultSchemaCacheEntry>,
  repoPath: string,
  refreshKey: number,
): { fresh: true; value: string | null } | { fresh: false } {
  const hit = cache.get(repoPath);
  if (hit && hit.refreshKey === refreshKey) return { fresh: true, value: hit.value };
  return { fresh: false };
}

export function useDefaultSchema(): string | null {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const refreshKey = useRefreshKey();
  const [value, setValue] = useState<string | null>(() => {
    if (!repoPath) return null;
    const c = resolveCachedDefaultSchema(defaultSchemaCache, repoPath, refreshKey);
    return c.fresh ? c.value : null;
  });

  useEffect(() => {
    if (!repoPath) {
      setValue(null);
      return;
    }
    const cached = resolveCachedDefaultSchema(defaultSchemaCache, repoPath, refreshKey);
    if (cached.fresh) {
      setValue(cached.value);
      return;
    }

    let cancelled = false;
    // repo 預設 schema 與 worktree 聚合無關，用非聚合 overview（較輕）即可
    adapter
      .getOverview(false)
      .then((overview) => {
        if (cancelled) return;
        const ds = overview.defaultSchema ?? null;
        defaultSchemaCache.set(repoPath, { refreshKey, value: ds });
        setValue(ds);
      })
      .catch(() => {
        // 靜態標示：抓取失敗就維持現值（不顯示錯誤）
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, refreshKey, adapter]);

  return value;
}

export function useSpecs(): FetchState<SpecInfo[]> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath ? () => adapter.getSpecs() : null,
    [repoPath],
  );
}

export function useSpec(topic: string): FetchState<SpecDetail> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath && topic ? () => adapter.getSpec(topic) : null,
    [repoPath, topic],
  );
}

export function useSpecAtChange(topic: string, slug: string): FetchState<SpecVersionContent> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath && topic && slug ? () => adapter.getSpecAtChange(topic, slug) : null,
    [repoPath, topic, slug],
  );
}

export function useChanges(aggregate?: boolean): FetchState<ChangesData> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const agg = aggregate ?? getAggregatePref();
  return useAsyncData(
    repoPath ? () => adapter.getChanges(agg) : null,
    [repoPath, agg],
  );
}

export function useChange(slug: string, wt?: string): FetchState<ChangeDetail> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  return useAsyncData(
    repoPath && slug ? () => adapter.getChange(slug, wt) : null,
    [repoPath, slug, wt],
  );
}

// --- Resync hook ---

export function useResync(): { resync: () => Promise<void>; loading: boolean } {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const [loading, setLoading] = useState(false);

  const resync = useCallback(async () => {
    if (!repoPath || loading) return;
    setLoading(true);
    try {
      await adapter.resync();
    } finally {
      setLoading(false);
    }
  }, [repoPath, loading, adapter]);

  return { resync, loading };
}

// --- Graph data hook ---

export function useGraphData(aggregate?: boolean): FetchState<GraphData> {
  const { repoPath } = useRepo();
  const adapter = useApiAdapter();
  const agg = aggregate ?? getAggregatePref();
  return useAsyncData(
    repoPath ? () => adapter.getGraphData(agg) : null,
    [repoPath, agg],
  );
}

// --- Filesystem API hooks ---

export function useBrowse(dirPath: string): FetchState<BrowseData> {
  const adapter = useApiAdapter();
  return useAsyncData(
    dirPath ? () => adapter.browse(dirPath) : null,
    [dirPath],
  );
}

export function useDetect(dirPath: string): FetchState<DetectData> {
  const adapter = useApiAdapter();
  return useAsyncData(
    dirPath ? () => adapter.detect(dirPath) : null,
    [dirPath],
  );
}
