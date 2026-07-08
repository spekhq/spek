// schema 名稱一律以同一種 pill 呈現，讓 change badge 與 repo 預設 schema 的視覺一致。
const PILL_CLASS =
  "shrink-0 inline-flex items-center rounded border border-border bg-bg-tertiary px-1.5 py-0.5 text-[11px] font-medium text-text-secondary";

// 純呈現用的 schema pill：永遠顯示傳入的 schema 名稱（無隱藏邏輯）。
// 供 SchemaBadge（帶隱藏規則）與 specs 頁的 repo 預設 schema 標示共用，確保 UI 一致。
export function SchemaPill({ schema, title }: { schema: string; title?: string }) {
  return (
    <span className={PILL_CLASS} title={title ?? `Schema: ${schema}`}>
      {schema}
    </span>
  );
}

// change 的 schema 徽章。為降低雜訊，schema 未知或與 repo 預設 schema 相同時不顯示，
// 只有在 change 使用了與預設不同的 schema 時才凸顯出來。此規則在所有呈現 change 的畫面
// （change detail、changes 列表、dashboard）統一套用。
export function SchemaBadge({
  schema,
  defaultSchema,
}: {
  schema: string | null | undefined;
  defaultSchema: string | null | undefined;
}) {
  if (!schema || schema === defaultSchema) return null;
  return <SchemaPill schema={schema} />;
}
