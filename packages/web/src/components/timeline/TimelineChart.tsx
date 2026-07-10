import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dateRange, generateTicks, padDomain, scaleTime } from "./scale";
import type { Lane } from "./grouping";
import { TimelineAxis } from "./TimelineAxis";
import { TimelineBar, type BarHoverPayload } from "./TimelineBar";
import { TimelineTooltip } from "./TimelineTooltip";
import { todayIso } from "../../utils/lifecycle";
import { changeTo } from "../../utils/changeLink";
import { WorktreeBadge } from "../WorktreeBadge";
import type { ChangeInfo } from "@spekjs/core";

interface TimelineChartProps {
  lanes: Lane[];
  groupByTopic: boolean;
}

const AXIS_HEIGHT = 36;
const ROW_HEIGHT = 28;
const SECTION_HEIGHT = 26;
const BAR_HEIGHT = 12;
const LABEL_COL_WIDTH = 200;
const MIN_CHART_AREA_WIDTH = 720;
const RIGHT_PADDING = 24;
const PADDING_DAYS = 3;
const MS_PER_DAY = 86400000;

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
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

export function TimelineChart({ lanes, groupByTopic }: TimelineChartProps) {
  const navigate = useNavigate();
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
    let y = AXIS_HEIGHT;
    return rows.map((r) => {
      const top = y;
      y += r.kind === "section" ? SECTION_HEIGHT : ROW_HEIGHT;
      return top;
    });
  }, [rows]);

  const totalHeight =
    rowYs.length > 0
      ? rowYs[rowYs.length - 1] +
        (rows[rows.length - 1].kind === "section" ? SECTION_HEIGHT : ROW_HEIGHT)
      : AXIS_HEIGHT;

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
    return padDomain(r.min, r.max, PADDING_DAYS);
  }, [allDates]);

  const chartAreaWidth = Math.max(MIN_CHART_AREA_WIDTH, containerWidth - LABEL_COL_WIDTH);
  const innerWidth = chartAreaWidth - RIGHT_PADDING;

  const scale = useMemo(
    () => (domain ? scaleTime(domain.min, domain.max, 0, innerWidth) : null),
    [domain, innerWidth],
  );
  const ticks = useMemo(() => (domain ? generateTicks(domain.min, domain.max) : { major: [], minor: [] }), [domain]);
  const spanDays = useMemo(
    () => (domain ? Math.max(1, Math.round((isoToUtcMs(domain.max) - isoToUtcMs(domain.min)) / MS_PER_DAY)) : 0),
    [domain],
  );

  const handleClick = (c: ChangeInfo) => navigate(changeTo(c));

  return (
    <div
      ref={containerRef}
      className="relative border border-border rounded bg-bg-secondary overflow-hidden"
    >
      {!domain ? (
        <div className="p-6 text-text-muted text-sm">No timeline data to render.</div>
      ) : (
        <div className="flex">
          {/* Label column */}
          <div
            className="shrink-0 border-r border-border bg-bg-secondary"
            style={{ width: LABEL_COL_WIDTH }}
          >
            <div style={{ height: AXIS_HEIGHT }} />
            {rows.map((r, ri) => {
              if (r.kind === "section") {
                const lane = lanes[r.laneIndex];
                const label = lane.topic === "" ? "(no topic)" : lane.topic;
                return (
                  <div
                    key={`label-section-${ri}`}
                    className="px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-end pb-1"
                    style={{ height: SECTION_HEIGHT }}
                    title={label ?? ""}
                  >
                    <span className="truncate">{label}</span>
                  </div>
                );
              }
              const item = lanes[r.laneIndex].items[r.itemIndex!];
              return (
                <button
                  key={`label-item-${ri}`}
                  onClick={() => handleClick(item.change)}
                  className="w-full text-left px-3 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary cursor-pointer flex items-center gap-1.5"
                  style={{ height: ROW_HEIGHT }}
                  title={item.change.description}
                >
                  <span className="truncate">{item.change.slug}</span>
                  {item.change.source && <WorktreeBadge source={item.change.source} />}
                </button>
              );
            })}
          </div>

          {/* Chart area */}
          <div className="flex-1 overflow-x-auto">
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
                  axisHeight={AXIS_HEIGHT}
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
                        y1={rowYs[ri] + SECTION_HEIGHT - 1}
                        y2={rowYs[ri] + SECTION_HEIGHT - 1}
                        stroke="var(--color-border)"
                        strokeOpacity={0.6}
                      />
                    );
                  }
                  const item = lanes[r.laneIndex].items[r.itemIndex!];
                  const barY = rowYs[ri] + (ROW_HEIGHT - BAR_HEIGHT) / 2;
                  return (
                    <TimelineBar
                      key={`bar-${r.laneIndex}-${r.itemIndex}-${item.change.slug}`}
                      change={item.change}
                      topics={item.topics}
                      scale={scale}
                      today={today}
                      y={barY}
                      barHeight={BAR_HEIGHT}
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
