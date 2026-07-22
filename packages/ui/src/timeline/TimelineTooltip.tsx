import type { ChangeInfo } from "@spekjs/core";
import { daysBetween, formatShortDate, todayIso } from "../date.js";

interface TimelineTooltipProps {
  change: ChangeInfo;
  topics: string[];
  clientX: number;
  clientY: number;
  showTopics: boolean;
}

// 視窗 fixed 定位的 tooltip。caller 傳入游標座標即可。
export function TimelineTooltip({
  change,
  topics,
  clientX,
  clientY,
  showTopics,
}: TimelineTooltipProps) {
  const today = todayIso();
  const isArchived = change.status === "archived" && change.archivedDate;
  const span = isArchived
    ? daysBetween(change.createdDate ?? today, change.archivedDate as string)
    : daysBetween(change.createdDate ?? today, today);
  const spanLabel = span < 1 ? "<1 day" : `${span} day${span === 1 ? "" : "s"}`;

  // 偏移避免遮住游標；超出右邊界時翻轉到游標左側
  const PAD = 12;
  const ESTIMATED_W = 280;
  const flipLeft = clientX + PAD + ESTIMATED_W > window.innerWidth;
  const left = flipLeft ? clientX - PAD - ESTIMATED_W : clientX + PAD;
  const top = clientY + PAD;

  return (
    <div role="tooltip" className="spekui-tooltip" style={{ left, top, maxWidth: ESTIMATED_W }}>
      <div className="spekui-tooltip-head">
        <span
          className={`spekui-tooltip-status ${
            isArchived ? "spekui-tooltip-status--archived" : "spekui-tooltip-status--active"
          }`}
        >
          {isArchived ? "archived" : "active"}
        </span>
        <span className="spekui-tooltip-slug">{change.slug}</span>
      </div>

      {change.description !== change.slug && (
        <div className="spekui-tooltip-desc">{change.description}</div>
      )}

      <div className="spekui-tooltip-rows">
        {change.createdDate && (
          <div>
            Created ·{" "}
            <span className="spekui-tooltip-value">{formatShortDate(change.createdDate)}</span>{" "}
            ({change.createdDate})
          </div>
        )}
        {isArchived && change.archivedDate && (
          <div>
            Archived ·{" "}
            <span className="spekui-tooltip-value">{formatShortDate(change.archivedDate)}</span>{" "}
            ({change.archivedDate})
          </div>
        )}
        <div>
          Duration · <span className="spekui-tooltip-value">{spanLabel}</span>
          {!isArchived && <span className="spekui-tooltip-ongoing"> (ongoing)</span>}
        </div>
        {showTopics && topics.length > 0 && (
          <div className="spekui-tooltip-topics">
            <div className="spekui-tooltip-topics-label">Topics</div>
            <div className="spekui-tooltip-chips">
              {topics.map((t) => (
                <span key={t} className="spekui-tooltip-chip">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
