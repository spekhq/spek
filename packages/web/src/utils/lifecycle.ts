// 生命週期顯示工具：基於 .openspec.yaml 的 createdDate 與 archive folder name 推導的 archivedDate

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseDateOnly(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  // 用 UTC 構造避免本地時區造成隔日跳動
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function daysBetween(a: string, b: string): number {
  const da = parseDateOnly(a);
  const db = parseDateOnly(b);
  if (!da || !db) return 0;
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / 86400000);
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatShortDate(iso: string): string {
  const d = parseDateOnly(iso);
  if (!d) return iso;
  return `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

interface LifecycleSource {
  createdDate: string | null;
  archivedDate: string | null;
  status: "active" | "archived";
}

// list row 主顯示文字。createdDate 為 null 時回 null，由 caller fallback。
export function formatLifecycleListRow(
  info: LifecycleSource,
  today: string,
): string | null {
  if (!info.createdDate) return null;
  const created = formatShortDate(info.createdDate);
  if (info.status === "archived" && info.archivedDate) {
    const archived = formatShortDate(info.archivedDate);
    const span = daysBetween(info.createdDate, info.archivedDate);
    return `${created} → ${archived} · ${span}d`;
  }
  const ageDays = Math.max(0, daysBetween(info.createdDate, today));
  return `${created} · ${ageDays}d`;
}

// detail header banner 文字。createdDate 為 null 時回 null，由 caller 不渲染。
export function formatLifecycleBanner(
  detail: LifecycleSource,
  today: string,
): string | null {
  if (!detail.createdDate) return null;
  if (detail.status === "archived" && detail.archivedDate) {
    const span = daysBetween(detail.createdDate, detail.archivedDate);
    const spanLabel = span < 1 ? "<1 day" : `${span} days`;
    return `Lifecycle ${spanLabel} · ${detail.createdDate} → ${detail.archivedDate}`;
  }
  const ageDays = Math.max(0, daysBetween(detail.createdDate, today));
  const ageLabel = ageDays < 1 ? "<1 day" : `${ageDays} days`;
  return `Active for ${ageLabel} · since ${detail.createdDate}`;
}
