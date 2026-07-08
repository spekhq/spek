// change 的 schema 徽章：以 pill 呈現 schema 名稱。為降低雜訊，schema 未知或與 repo 預設 schema
// 相同時不顯示，只有 change 使用了與預設不同的 schema 時才凸顯。此規則在所有呈現 change 的畫面
// （change detail、changes 列表、dashboard）統一套用。repo 預設 schema 本身在 Changes 頁改以
// 純文字標示（非 pill），讓「pill = 非預設 schema」的語意在各處一致。
export function SchemaBadge({
  schema,
  defaultSchema,
}: {
  schema: string | null | undefined;
  defaultSchema: string | null | undefined;
}) {
  if (!schema || schema === defaultSchema) return null;
  return (
    <span
      className="shrink-0 inline-flex items-center rounded border border-border bg-bg-tertiary px-1.5 py-0.5 text-[11px] font-medium text-text-secondary"
      title={`Schema: ${schema}`}
    >
      {schema}
    </span>
  );
}
