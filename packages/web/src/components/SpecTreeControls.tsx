interface SpecTreeControlsProps {
  /** Whether the unfiltered tree has any folder to fold. Without one there is nothing to control. */
  hasFolders: boolean;
  /** A filter opens every folder it keeps, so the controls are inert while it applies. */
  filtering: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

// FoldControls' tokens, but hover only when enabled and a visible disabled state — FoldControls is
// never disabled. `disabled:` is the one opacity prefix the contrast check admits (WCAG 1.4.3).
const BUTTON =
  "text-xs px-2 py-0.5 rounded border transition-colors border-border text-text-muted enabled:hover:text-accent enabled:hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Expand all / Collapse all for the Specs page's folder tree. Plain actions, unlike FoldControls'
 * pressed modes: the tree has no resting state to return to.
 */
export function SpecTreeControls({ hasFolders, filtering, onExpandAll, onCollapseAll }: SpecTreeControlsProps) {
  if (!hasFolders) return null;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onExpandAll} disabled={filtering} className={BUTTON}>
        Expand all
      </button>
      <button type="button" onClick={onCollapseAll} disabled={filtering} className={BUTTON}>
        Collapse all
      </button>
    </div>
  );
}
