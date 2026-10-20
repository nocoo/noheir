import { Button } from "@nocoo/basalt";

export function FinancialSnapshotNotice({
  changed,
  onReset,
}: {
  changed: boolean;
  onReset: () => void;
}) {
  if (!changed) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning p-3 text-sm"
    >
      <span>服务端数据已变化。当前草稿仍使用原始版本；请核对最新数据，不会自动覆盖。</span>
      <Button type="button" variant="outline" onClick={onReset}>
        载入最新数据（放弃草稿）
      </Button>
    </div>
  );
}
