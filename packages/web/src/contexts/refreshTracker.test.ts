import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRefreshTracker, runManualRefresh } from "./refreshTracker";

const ARM_TIMEOUT = 20;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeTracker() {
  const transitions: boolean[] = [];
  const tracker = createRefreshTracker({
    onRefreshingChange: (refreshing) => transitions.push(refreshing),
    armTimeoutMs: ARM_TIMEOUT,
  });
  return { tracker, transitions };
}

describe("createRefreshTracker", () => {
  it("arm 之後立刻進入忙碌狀態", () => {
    const { tracker, transitions } = makeTracker();

    tracker.arm();

    assert.equal(tracker.isRefreshing(), true);
    assert.deepEqual(transitions, [true]);
    tracker.dispose();
  });

  it("忙碌狀態撐到重取的資料抵達，而非 arm 後就解除", () => {
    const { tracker } = makeTracker();

    tracker.arm();
    const endFetch = tracker.beginFetch();
    assert.equal(tracker.isRefreshing(), true, "fetch 在途時仍應忙碌");

    endFetch();
    assert.equal(tracker.isRefreshing(), false, "資料抵達後才解除");
    tracker.dispose();
  });

  it("多個在途 fetch 全部結束才解除", () => {
    const { tracker } = makeTracker();

    tracker.arm();
    const endA = tracker.beginFetch();
    const endB = tracker.beginFetch();

    endA();
    assert.equal(tracker.isRefreshing(), true, "還有一個 fetch 在途");

    endB();
    assert.equal(tracker.isRefreshing(), false);
    tracker.dispose();
  });

  it("結束回呼重複呼叫不會提早解除", () => {
    const { tracker } = makeTracker();

    tracker.arm();
    const endA = tracker.beginFetch();
    const endB = tracker.beginFetch();

    endA();
    endA();
    assert.equal(tracker.isRefreshing(), true, "重複呼叫不得多扣一次在途數");

    endB();
    assert.equal(tracker.isRefreshing(), false);
    tracker.dispose();
  });

  it("arm 前就已在途的 fetch 結束時，不得解除這次刷新的忙碌狀態", () => {
    const { tracker } = makeTracker();

    // 使用者按 Refresh 之前，畫面上已經有一個 fetch 在飛
    const endStale = tracker.beginFetch();

    tracker.arm();
    endStale(); // 舊世代的 fetch 落地
    assert.equal(tracker.isRefreshing(), true, "舊 fetch 不算數，仍在等這次刷新的資料");

    const endFresh = tracker.beginFetch();
    endFresh();
    assert.equal(tracker.isRefreshing(), false);
    tracker.dispose();
  });

  it("arm 後無任何 fetch 開始時，忙碌狀態自行解除而不卡死", async () => {
    const { tracker } = makeTracker();

    tracker.arm();
    assert.equal(tracker.isRefreshing(), true);

    await sleep(ARM_TIMEOUT + 20);
    assert.equal(tracker.isRefreshing(), false, "沒有取數 hook 掛載時不得卡在忙碌");
    tracker.dispose();
  });

  it("已有 fetch 在途時，arm timeout 不得誤解除", async () => {
    const { tracker } = makeTracker();

    tracker.arm();
    const endFetch = tracker.beginFetch();

    await sleep(ARM_TIMEOUT + 20);
    assert.equal(tracker.isRefreshing(), true, "fetch 仍在途，逾時保護不該介入");

    endFetch();
    assert.equal(tracker.isRefreshing(), false);
    tracker.dispose();
  });

  it("未經 arm 的自動刷新不會進入忙碌狀態", () => {
    const { tracker, transitions } = makeTracker();

    // watcher 觸發的自動刷新不呼叫 arm()，只會有 fetch 進出
    const endFetch = tracker.beginFetch();
    assert.equal(tracker.isRefreshing(), false);
    endFetch();

    assert.equal(tracker.isRefreshing(), false);
    assert.deepEqual(transitions, [], "自動刷新期間不得冒出 spinner");
    tracker.dispose();
  });
});

describe("runManualRefresh", () => {
  it("resync 成功後重新取數", async () => {
    const calls: boolean[] = [];

    await runManualRefresh(
      async () => {},
      (manual) => calls.push(manual === true),
    );

    assert.deepEqual(calls, [true], "refresh 應以 manual 觸發");
  });

  it("resync 失敗（例如宿主沒有這個端點而回 404）仍然重新取數", async () => {
    const calls: boolean[] = [];

    await runManualRefresh(
      async () => {
        throw new Error("HTTP 404");
      },
      (manual) => calls.push(manual === true),
    );

    assert.deepEqual(calls, [true], "快取失效失敗不得阻擋重新取數");
  });

  it("resync 失敗時錯誤不得逸出成 unhandled rejection", async () => {
    await assert.doesNotReject(() =>
      runManualRefresh(
        async () => {
          throw new Error("HTTP 404");
        },
        () => {},
      ),
    );
  });

  it("refresh 只被觸發一次", async () => {
    let count = 0;

    await runManualRefresh(
      async () => {},
      () => {
        count += 1;
      },
    );

    assert.equal(count, 1);
  });
});
