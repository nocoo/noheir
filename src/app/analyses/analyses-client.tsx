import { Badge, Button, Field, Input, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { buildAnalysisFilters } from "@/domain/analyses";
import type { Analysis, ApiEnvelope } from "@/domain/api-contract";
import { AnalysisEditor } from "./analysis-editor";

export function AnalysesClient({
  result,
  currentRevision,
  loading = false,
}: {
  result: ApiEnvelope<Analysis[]>;
  currentRevision: number;
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [draft, setDraft] = useState({
    q: params.get("q") ?? "",
    currency: params.get("currency") ?? "",
    startDate: params.get("startDate") ?? "",
    endDate: params.get("endDate") ?? "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const current = new URLSearchParams(query);
    setDraft({
      q: current.get("q") ?? "",
      currency: current.get("currency") ?? "",
      startDate: current.get("startDate") ?? "",
      endDate: current.get("endDate") ?? "",
    });
  }, [query]);
  const next = buildAnalysisFilters(params);
  if (result.meta.nextCursor) next.set("cursor", result.meta.nextCursor);
  return (
    <div className="space-y-4" aria-busy={loading}>
      <PageHeader
        title="分析报告"
        description="保存、查看与核对财务报告及其来源证据。"
        actions={
          <Button onClick={() => setCreating(true)} disabled={creating}>
            新建报告
          </Button>
        }
        filters={
          <form
            onSubmit={(event) => {
              event.preventDefault();
              try {
                setParams(buildAnalysisFilters(params, draft));
                setError("");
              } catch {
                setError("请检查筛选日期与币种。");
              }
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <Field label="搜索标题" htmlFor="reports-q">
              <Input
                id="reports-q"
                value={draft.q}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
              />
            </Field>
            <Field label="币种" htmlFor="reports-currency">
              <Select
                value={draft.currency || "all"}
                onValueChange={(value) =>
                  setDraft({ ...draft, currency: value === "all" ? "" : value })
                }
              >
                <SelectTrigger id="reports-currency" className="min-w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["all", "CNY", "USD", "HKD"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === "all" ? "全部" : value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="期间起点" htmlFor="reports-start">
              <Input
                id="reports-start"
                type="date"
                value={draft.startDate}
                onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
              />
            </Field>
            <Field label="期间终点" htmlFor="reports-end">
              <Input
                id="reports-end"
                type="date"
                value={draft.endDate}
                onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
              />
            </Field>
            <Button type="submit" variant="outline" disabled={loading}>
              筛选
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setParams({});
                setError("");
              }}
            >
              重置
            </Button>
          </form>
        }
      />
      {error && (
        <p role="alert" className="text-basalt-destructive text-sm">
          {error}
        </p>
      )}
      {creating && (
        <AnalysisEditor
          currentRevision={currentRevision}
          onCancel={() => setCreating(false)}
          onSaved={(id) => navigate(`/analyses/${encodeURIComponent(id)}`)}
        />
      )}
      <LayerCard>
        <LayerCard.Header>
          <span>本页 {result.meta.returned ?? result.data.length} 份报告</span>
          {loading && <span role="status">加载中…</span>}
        </LayerCard.Header>
        <LayerCard.Body>
          {result.data.length === 0 ? (
            <p className="text-basalt-muted-foreground text-sm">
              暂无匹配报告。调整筛选条件或创建第一份报告。
            </p>
          ) : (
            <ul className="space-y-3">
              {result.data.map((report) => (
                <li key={report.id} className="rounded-md bg-basalt-secondary p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      className="font-medium text-basalt-primary hover:underline"
                      to={`/analyses/${encodeURIComponent(report.id)}`}
                    >
                      {report.title}
                    </Link>
                    <Badge variant="secondary">{report.currencies.join(" / ")}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-basalt-muted-foreground">
                    {report.periodStart} – {report.periodEnd} · 来源修订 {report.dataRevision} ·
                    版本 {report.version}
                  </p>
                  <p className="mt-1 text-xs text-basalt-muted-foreground">
                    {report.createdBy.kind === "human"
                      ? "用户提交"
                      : `API 密钥 ${report.createdBy.keyId}`}{" "}
                    · 更新 {report.updatedAt}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {result.meta.hasMore && result.meta.nextCursor && (
            <div className="mt-3 flex justify-end">
              <Button variant="outline" asChild>
                <Link to={`/analyses?${next}`}>下一页</Link>
              </Button>
            </div>
          )}
        </LayerCard.Body>
      </LayerCard>
    </div>
  );
}
