import type { ChangeInfo } from "@spekjs/core";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CSS_VARS } from "../theme.js";
import { todayIso } from "../date.js";
import type { Lane } from "./grouping.js";
import { dateRange, generateTicks, padDomain, scaleTime } from "./scale.js";
import { TimelineAxis } from "./TimelineAxis.js";
import { TimelineBar, type BarHoverPayload } from "./TimelineBar.js";
import { TimelineTooltip } from "./TimelineTooltip.js";

/**
 * 時間軸的尺寸常數。
 *
 * `labelColWidth + minChartAreaWidth` 就是這張圖的**最小可用寬度**（預設 200 + 720 = 920px）。
 * 低於它就一定會出現水平捲軸 —— 這不是 bug，是 Gantt 的本質：時間軸壓縮到一定程度，所有 bar
 * 都會擠成一條線。
 *
 * 之所以做成可設定：下游宿主可能有較窄的容器。**但預設值刻意等同抽出前的寫死值**，
 * 所以什麼都不傳 = 行為完全不變。
 */
export interface TimelineMetrics {
  axisHeight: number;
  rowHeight: number;
  sectionHeight: number;
  barHeight: number;
  labelColWidth: number;
  minChartAreaWidth: number;
  rightPadding: number;
  paddingDays: number;
}

const DEFAULT_METRICS: TimelineMetrics = {
  axisHeight: 36,
  rowHeight: 28,
  sectionHeight: 26,
  barHeight: 12,
  labelColWidth: 200,
  minChartAreaWidth: 720,
  rightPadding: 24,
  paddingDays: 3,
};

const MS_PER_DAY = 86400000;

export interface ChangeTimelineProps {
  lanes: Lane[];
  groupByTopic: boolean;
  /** 使用者觸發一個 change（點 bar 或左欄的 label）。**元件不導航** —— 它只回報選擇。 */
  onSelectChange?: (change: ChangeInfo) => void;
  /**
   * 左欄 label 旁的附加標記。
   *
   * 抽出前這裡寫死了 web 的 `WorktreeBadge`，而它依賴 `ChangeInfo.source` —— 那個欄位**只有聚合
   * 掃描才會填**。非聚合的宿主（例如下游的 Electron app）永遠是 `undefined`。與其在套件裡塞一個
   * 只有一個宿主用得到的元件，不如讓宿主自己注入。
   */
  renderBadge?: (change: ChangeInfo) => React.ReactNode;
  metrics?: Partial<TimelineMetrics>;
}

interface RowMeta {
  kind: "section" | "item";
  laneIndex: number;
  itemIndex?: number;
}

function buildRows(lanes: Lane[], groupByTopic: boolean): RowMeta[] {
  const rows: RowMeta[] = [];
  lanes.forEach((lane, laneIndex) => {
    if (groupByTopic) {
      rows.push({ kind: "section", laneIndex });
    }
    lane.items.forEach((_, itemIndex) => {
      rows.push({ kind: "item", laneIndex, itemIndex });
    });
  });
  return rows;
}

function isoToUtcMs(iso: string): number {
  return Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
}

/**
 * change 生命週期的 Gantt 時間軸。
 *
 * **它與 `SpecGraph` 是兩個不同的視覺化**：這裡是時間（每個 change 一條橫條，自 `createdDate`
 * 到 `archivedDate`；active 的延伸到今天並帶箭頭），關聯結構是 Graph 的事。
 *
 * lane 由 `buildLanes()` 產生（純函式，宿主自己呼叫）—— 這樣宿主可以先套用自己的 filter。
 */
export function ChangeTimeline({
  lanes,
  groupByTopic,
  onSelectChange,
  renderBadge,
  metrics: metricsOverride,
}: ChangeTimelineProps) {
  const metrics = { ...DEFAULT_METRICS, ...metricsOverride };
  const {
    axisHeight,
    rowHeight,
    sectionHeight,
    barHeight,
    labelColWidth,
    minChartAreaWidth,
    rightPadding,
    paddingDays,
  } = metrics;

  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<BarHoverPayload | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const today = todayIso();

  // 量測容器寬度，視窗 / sidebar 變化時重新計算
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const rows = useMemo(() => buildRows(lanes, groupByTopic), [lanes, groupByTopic]);

  const rowYs = useMemo(() => {
    let y = axisHeight;
    return rows.map((r) => {
      const top = y;
      y += r.kind === "section" ? sectionHeight : rowHeight;
      return top;
    });
  }, [rows, axisHeight, sectionHeight, rowHeight]);

  const totalHeight =
    rowYs.length > 0
      ? rowYs[rowYs.length - 1] +
        (rows[rows.length - 1].kind === "section" ? sectionHeight : rowHeight)
      : axisHeight;

  const allDates = useMemo(() => {
    const arr: (string | null)[] = [];
    for (const lane of lanes) {
      for (const item of lane.items) {
        arr.push(item.change.createdDate);
        arr.push(item.change.archivedDate);
      }
    }
    arr.push(today);
    return arr;
  }, [lanes, today]);

  const domain = useMemo(() => {
    const r = dateRange(allDates);
    if (!r) return null;
    return padDomain(r.min, r.max, paddingDays);
  }, [allDates, paddingDays]);

  const chartAreaWidth = Math.max(minChartAreaWidth, containerWidth - labelColWidth);
  const innerWidth = chartAreaWidth - rightPadding;

  const scale = useMemo(
    () => (domain ? scaleTime(domain.min, domain.max, 0, innerWidth) : null),
    [domain, innerWidth],
  );
  const ticks = useMemo(
    () => (domain ? generateTicks(domain.min, domain.max) : { major: [], minor: [] }),
    [domain],
  );
  const spanDays = useMemo(
    () =>
      domain
        ? Math.max(
            1,
            Math.round((isoToUtcMs(domain.max) - isoToUtcMs(domain.min)) / MS_PER_DAY),
          )
        : 0,
    [domain],
  );

  const handleClick = (c: ChangeInfo) => onSelectChange?.(c);

  return (
    <div ref={containerRef} className="spekui-timeline">
      {!domain ? (
        <div className="spekui-timeline-empty">No timeline data to render.</div>
      ) : (
        <div className="spekui-timeline-body">
          {/* Label column */}
          <div className="spekui-timeline-labels" style={{ width: labelColWidth }}>
            <div style={{ height: axisHeight }} />
            {rows.map((r, ri) => {
              if (r.kind === "section") {
                const lane = lanes[r.laneIndex];
                const label = lane.topic === "" ? "(no topic)" : lane.topic;
                return (
                  <div
                    key={`label-section-${ri}`}
                    className="spekui-timeline-section"
                    style={{ height: sectionHeight }}
                    title={label ?? ""}
                  >
                    <span className="spekui-truncate">{label}</span>
                  </div>
                );
              }
              const item = lanes[r.laneIndex].items[r.itemIndex!];
              return (
                <button
                  key={`label-item-${ri}`}
                  type="button"
                  onClick={() => handleClick(item.change)}
                  className="spekui-timeline-label"
                  style={{ height: rowHeight }}
                  title={item.change.description}
                >
                  <span className="spekui-truncate">{item.change.slug}</span>
                  {renderBadge?.(item.change)}
                </button>
              );
            })}
          </div>

          {/* Chart area */}
          <div className="spekui-timeline-chart">
            {scale && (
              <svg
                width={chartAreaWidth}
                height={totalHeight}
                role="img"
                aria-label="Change lifecycle timeline"
              >
                <TimelineAxis
                  ticks={ticks}
                  scale={scale}
                  spanDays={spanDays}
                  axisHeight={axisHeight}
                  chartHeight={totalHeight}
                  today={today}
                />
                {rows.map((r, ri) => {
                  if (r.kind === "section") {
                    return (
                      <line
                        key={`section-sep-${ri}`}
                        x1={0}
                        x2={innerWidth}
                        y1={rowYs[ri] + sectionHeight - 1}
                        y2={rowYs[ri] + sectionHeight - 1}
                        stroke={`var(${CSS_VARS.border})`}
                        strokeOpacity={0.6}
                      />
                    );
                  }
                  const item = lanes[r.laneIndex].items[r.itemIndex!];
                  const barY = rowYs[ri] + (rowHeight - barHeight) / 2;
                  return (
                    <TimelineBar
                      key={`bar-${r.laneIndex}-${r.itemIndex}-${item.change.slug}`}
                      change={item.change}
                      topics={item.topics}
                      scale={scale}
                      today={today}
                      y={barY}
                      barHeight={barHeight}
                      onHover={setHover}
                      onClick={handleClick}
                    />
                  );
                })}
              </svg>
            )}
          </div>
        </div>
      )}

      {hover && (
        <TimelineTooltip
          change={hover.change}
          topics={hover.topics}
          clientX={hover.clientX}
          clientY={hover.clientY}
          showTopics={groupByTopic || hover.topics.length > 1}
        />
      )}
    </div>
  );
}
