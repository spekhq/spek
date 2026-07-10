import type { ChangeInfo } from "@spekjs/core";
import { daysBetween, formatShortDate, todayIso } from "../../utils/lifecycle";

interface TimelineTooltipProps {
  change: ChangeInfo;
  topics: string[];
  clientX: number;
  clientY: number;
  showTopics: boolean;
}

// 視窗 fixed 定位的 tooltip。caller 傳入游標座標即可。
export function TimelineTooltip({ change, topics, clientX, clientY, showTopics }: TimelineTooltipProps) {
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
    <div
      role="tooltip"
      className="fixed z-50 pointer-events-none bg-bg-secondary border border-border rounded shadow-lg p-3 text-xs"
      style={{ left, top, maxWidth: ESTIMATED_W }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            isArchived
              ? "bg-text-muted/20 text-text-secondary"
              : "bg-accent/20 text-accent"
          }`}
        >
          {isArchived ? "archived" : "active"}
        </span>
        <span className="text-text-primary font-mono truncate">{change.slug}</span>
      </div>
      {change.description !== change.slug && (
        <div className="text-text-secondary mb-1.5 line-clamp-2">{change.description}</div>
      )}
      <div className="text-text-muted space-y-0.5">
        {change.createdDate && (
          <div>
            Created · <span className="text-text-secondary">{formatShortDate(change.createdDate)}</span>
            {" "}({change.createdDate})
          </div>
        )}
        {isArchived && change.archivedDate && (
          <div>
            Archived · <span className="text-text-secondary">{formatShortDate(change.archivedDate)}</span>
            {" "}({change.archivedDate})
          </div>
        )}
        <div>
          Duration · <span className="text-text-secondary">{spanLabel}</span>
          {!isArchived && <span className="text-text-muted/80"> (ongoing)</span>}
        </div>
        {showTopics && topics.length > 0 && (
          <div className="pt-1 mt-1 border-t border-border">
            <div className="text-text-muted mb-0.5">Topics</div>
            <div className="flex flex-wrap gap-1">
              {topics.map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary">
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
