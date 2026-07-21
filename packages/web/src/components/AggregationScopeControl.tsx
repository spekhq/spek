import { useAggregationScope } from "../contexts/AggregationScopeContext";
import { scopeControlView, type AggLevel } from "../utils/aggregationLevel";

const AGG_LEVELS: { value: AggLevel; text: string; title: string }[] = [
  { value: "off", text: "Current dir", title: "Show only the current directory's changes" },
  { value: "worktrees", text: "Worktrees", title: "Aggregate across all git worktrees" },
  {
    value: "worktrees-jj",
    text: "Worktrees + jj",
    title: "Aggregate git worktrees and jj workspaces (experimental)",
  },
];

// Global aggregation-scope control (lives in the header, in both the Web app and the VS Code webview).
// The three states are mutually exclusive, which makes "aggregate off + jj on" unrepresentable.
export function AggregationScopeControl({ isMobile }: { isMobile: boolean }) {
  const { level, setLevel, worktrees, hasJj } = useAggregationScope();

  const { visible, showJjOption } = scopeControlView(worktrees.length, hasJj);
  if (!visible) return null;

  // The jj option is offered only when a jj workspace is detected; otherwise it degrades to two states.
  const options = showJjOption ? AGG_LEVELS : AGG_LEVELS.filter((o) => o.value !== "worktrees-jj");

  if (isMobile) {
    return (
      <select
        aria-label="Aggregation scope"
        value={level}
        onChange={(e) => setLevel(e.target.value as AggLevel)}
        className="rounded border border-border bg-bg-tertiary text-text-secondary text-[11px] px-1.5 py-1 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      role="group"
      aria-label="Aggregation scope"
      className="inline-flex items-center gap-0.5 rounded border border-border bg-bg-tertiary p-0.5 text-[11px]"
    >
      {options.map((opt) => {
        const active = level === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setLevel(opt.value)}
            title={opt.title}
            className={
              "rounded px-1.5 py-0.5 transition-colors cursor-pointer " +
              (active
                ? "bg-bg-secondary text-accent font-medium"
                : "text-text-muted hover:text-text-secondary")
            }
          >
            {opt.text}
          </button>
        );
      })}
    </div>
  );
}
