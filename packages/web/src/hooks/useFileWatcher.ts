import { useEffect } from "react";
import { useRepo } from "../contexts/RepoContext";
import { useRefresh, useSetLiveStatus } from "../contexts/RefreshContext";
import { getAggregatePref } from "../utils/aggregatePref";

/**
 * 監聽 openspec 檔案變更，自動觸發 refresh，並回報 live-update 管道的狀態。
 * 依據執行環境自動選擇實作：
 * - Web：SSE EventSource 連接 /api/openspec/watch
 * - VS Code：監聽 postMessage fileChanged 事件
 * - IntelliJ：no-op（刷新由 plugin 注入的 spek:fileChanged event 送達）
 * - Demo：no-op
 */
export function useFileWatcher() {
  const { repoPath } = useRepo();
  const refresh = useRefresh();
  const setLiveStatus = useSetLiveStatus();

  useEffect(() => {
    const globals = window as unknown as Record<string, unknown>;

    // Demo 環境：沒有 watcher
    if (globals.__DEMO_DATA__) {
      setLiveStatus("unsupported");
      return;
    }

    // IntelliJ 環境：刷新由 plugin 以 JCEF 注入的 spek:fileChanged event 送達（IntellijApp 監聽），
    // 這裡不得開任何連線。特別是不能落到下面的 Web 分支：IntelliJ 內建 server 只服務 /api/spek/
    // 前綴，對 /api/openspec/watch 開 EventSource 必然 404，且 EventSource 會就此永遠重連。
    if (globals.__spekIntellij) {
      setLiveStatus("live");
      return;
    }

    // VS Code 環境：監聽 fileChanged message。
    // postMessage 管道沒有可觀測的失敗訊號，謊報 offline 比不報更糟，故恆為 live。
    if (globals.__vscodeApi) {
      setLiveStatus("live");
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "fileChanged") {
          refresh();
        }
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }

    // Web 環境：SSE EventSource。聚合開啟時後端會監看所有 worktree。
    if (!repoPath) return;

    const aggParam = getAggregatePref() ? "" : "&aggregate=false";
    const url = `/api/openspec/watch?dir=${encodeURIComponent(repoPath)}${aggParam}`;
    const source = new EventSource(url);

    source.onopen = () => {
      setLiveStatus("live");
    };

    source.onmessage = () => {
      refresh();
    };

    // EventSource 會自行重連，斷線期間 readyState 為 CONNECTING（重試中）或 CLOSED（放棄）。
    // 兩者都代表使用者看到的內容可能已經過時 —— 不出聲的話，watcher 就是靜默失效。
    source.onerror = () => {
      if (source.readyState !== EventSource.OPEN) {
        setLiveStatus("offline");
      }
    };

    return () => {
      source.close();
    };
  }, [repoPath, refresh, setLiveStatus]);
}
