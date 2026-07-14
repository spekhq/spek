/**
 * 手動刷新的忙碌狀態機 —— 與 React 無關的純邏輯，故可單獨測試。
 *
 * 存在的理由：按鈕的忙碌狀態必須撐到「重取的資料真正抵達」，而不是「resync 那個 POST 回來了」。
 * 兩者之間隔著 useAsyncData 的 debounce 與整個 fetch 往返；只涵蓋前者的話，spinner 會在資料落地
 * 之前就停 —— 一顆對「我做完了」說謊的按鈕，正是 issue #18 的成因。
 */

/** arm 之後等待第一個 fetch 開始的上限：useAsyncData 的 debounce（300ms）再加緩衝。 */
export const ARM_TIMEOUT_MS = 500;

export interface RefreshTrackerOptions {
  /** 忙碌狀態變動時回呼（React 端據此 setState） */
  onRefreshingChange: (refreshing: boolean) => void;
  /** arm 後等待第一個 fetch 開始的上限；測試可縮短 */
  armTimeoutMs?: number;
}

export interface RefreshTracker {
  /** 使用者按下 Refresh：arm 忙碌狀態。watcher 觸發的自動刷新不呼叫此方法。 */
  arm(): void;
  /** fetch 開始，回傳「這次 fetch 已結束」的回呼（重複呼叫無副作用） */
  beginFetch(): () => void;
  /** 目前是否處於手動刷新的忙碌狀態 */
  isRefreshing(): boolean;
  /** 卸載時清理計時器 */
  dispose(): void;
}

export function createRefreshTracker(options: RefreshTrackerOptions): RefreshTracker {
  const { onRefreshingChange, armTimeoutMs = ARM_TIMEOUT_MS } = options;

  // 世代：每次 arm +1。用來把「這次刷新引發的 fetch」與「刷新前就已在途的 fetch」分開 ——
  // 少了它，一個在按下 Refresh 前就開始、按下後才結束的 fetch 會把忙碌狀態提早解除。
  let generation = 0;
  let pending = 0;
  let sawFetch = false;
  let refreshing = false;
  let armTimer: ReturnType<typeof setTimeout> | null = null;

  const clearArmTimer = () => {
    if (armTimer !== null) {
      clearTimeout(armTimer);
      armTimer = null;
    }
  };

  const setRefreshing = (next: boolean) => {
    if (refreshing === next) return;
    refreshing = next;
    onRefreshingChange(next);
  };

  return {
    arm() {
      generation += 1;
      pending = 0;
      sawFetch = false;
      setRefreshing(true);

      clearArmTimer();
      armTimer = setTimeout(() => {
        armTimer = null;
        // 沒有任何 fetch 開始（例如當下沒有掛載取數 hook）—— 自行解除，不卡死
        if (!sawFetch) setRefreshing(false);
      }, armTimeoutMs);
    },

    beginFetch() {
      const gen = generation;
      pending += 1;
      sawFetch = true;

      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        // 上一個世代的 fetch（在這次手動刷新之前就已開始）不影響目前的忙碌狀態
        if (gen !== generation) return;

        pending = Math.max(0, pending - 1);
        if (pending === 0 && sawFetch) {
          clearArmTimer();
          setRefreshing(false);
        }
      };
    },

    isRefreshing() {
      return refreshing;
    },

    dispose() {
      clearArmTimer();
    },
  };
}

/**
 * 手動 Refresh 的核心不變式：**快取失效失敗不得阻擋重新取數**。
 *
 * resync 是 best-effort —— 宿主可能根本沒有這個端點（IntelliJ 曾經就沒有，回 404），或沒有任何
 * 快取需要失效。因此它的錯誤在此吞掉（不得逸出成 unhandled rejection），`refresh(true)` 一律執行。
 * 這個保證寫死在單一位置而非呼叫端拼裝，否則下一個呼叫者就會漏掉 —— 而那正是一個 404 足以讓整顆
 * 按鈕啞掉的原因。
 */
export async function runManualRefresh(
  resync: () => Promise<void>,
  refresh: (manual?: boolean) => void,
): Promise<void> {
  try {
    await resync();
  } catch {
    // 忽略：失效是 best-effort，重新取數不受其成敗左右
  } finally {
    refresh(true);
  }
}
