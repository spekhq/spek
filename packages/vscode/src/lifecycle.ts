// VS Code sidebar 生命週期顯示工具（與 web 端 lifecycle.ts 等價的輕量版）

function parseDateOnly(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function daysBetween(a: string, b: string): number {
  const da = parseDateOnly(a);
  const db = parseDateOnly(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface LifecycleSource {
  createdDate: string | null;
  archivedDate: string | null;
  status: "active" | "archived";
}

// TreeItem description 的生命週期 hint，createdDate 為 null 時回 undefined（不顯示）
export function formatTreeItemDescription(info: LifecycleSource): string | undefined {
  if (!info.createdDate) return undefined;
  if (info.status === "archived" && info.archivedDate) {
    const span = daysBetween(info.createdDate, info.archivedDate);
    return `→ archived (${span}d)`;
  }
  const ageDays = Math.max(0, daysBetween(info.createdDate, todayIso()));
  return `(${ageDays}d)`;
}
