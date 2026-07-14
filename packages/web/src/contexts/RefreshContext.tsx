import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { createRefreshTracker, type RefreshTracker } from "./refreshTracker";

/**
 * live-update 管道的狀態：
 * - `live`        — 管道正常，或宿主的管道沒有可觀測的失敗訊號（VS Code / IntelliJ）
 * - `offline`     — 管道確實斷了，使用者看到的內容可能已經過時
 * - `unsupported` — 該環境本來就沒有 live update（Demo）
 */
export type LiveStatus = "live" | "offline" | "unsupported";

interface RefreshContextValue {
  refreshKey: number;
  /** `manual` 為真代表使用者按下 Refresh，會 arm 忙碌狀態；watcher 觸發的自動刷新不 arm */
  refresh: (manual?: boolean) => void;
  /** 手動刷新進行中：自 arm 起為真，直到重取的資料真正抵達 */
  refreshing: boolean;
  /** 由 useAsyncData 在 fetch 開始時呼叫，回傳「這次 fetch 已結束」的回呼 */
  beginFetch: () => () => void;
  liveStatus: LiveStatus;
  setLiveStatus: (status: LiveStatus) => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  refreshKey: 0,
  refresh: () => {},
  refreshing: false,
  beginFetch: () => () => {},
  liveStatus: "live",
  setLiveStatus: () => {},
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("live");

  // 忙碌狀態機本身是純邏輯（refreshTracker），這裡只負責把它的狀態變動接回 React
  const trackerRef = useRef<RefreshTracker | null>(null);
  if (trackerRef.current === null) {
    trackerRef.current = createRefreshTracker({ onRefreshingChange: setRefreshing });
  }
  const tracker = trackerRef.current;

  useEffect(() => () => tracker.dispose(), [tracker]);

  const refresh = useCallback(
    (manual = false) => {
      setRefreshKey((k) => k + 1);
      // 自動刷新（watcher 觸發）不 arm —— 憑空冒出的 spinner 是噪音，不是資訊
      if (manual) tracker.arm();
    },
    [tracker],
  );

  const beginFetch = useCallback(() => tracker.beginFetch(), [tracker]);

  return (
    <RefreshContext.Provider
      value={{ refreshKey, refresh, refreshing, beginFetch, liveStatus, setLiveStatus }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefreshKey(): number {
  return useContext(RefreshContext).refreshKey;
}

export function useRefresh(): (manual?: boolean) => void {
  return useContext(RefreshContext).refresh;
}

export function useRefreshing(): boolean {
  return useContext(RefreshContext).refreshing;
}

export function useBeginFetch(): () => () => void {
  return useContext(RefreshContext).beginFetch;
}

export function useLiveStatus(): LiveStatus {
  return useContext(RefreshContext).liveStatus;
}

export function useSetLiveStatus(): (status: LiveStatus) => void {
  return useContext(RefreshContext).setLiveStatus;
}
