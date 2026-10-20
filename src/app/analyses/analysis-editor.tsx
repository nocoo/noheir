import { Button, Checkbox, Field, Input, LayerCard } from "@nocoo/basalt";
import { useState } from "react";
import { ReportMarkdown } from "@/components/report-markdown";
import { Textarea } from "@/components/ui/textarea";
import { type AnalysisDraft, buildAnalysisInput, createAnalysisDraft } from "@/domain/analyses";
import type { Analysis } from "@/domain/api-contract";
import { financeApi } from "@/lib/finance-api";
import { getLocalDateString } from "@/lib/local-date";

export function AnalysisEditor({
  report,
  currentRevision,
  onSaved,
  onCancel,
}: {
  report?: Analysis;
  currentRevision: number;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [snapshot] = useState(report);
  const [draft, setDraft] = useState(() =>
    createAnalysisDraft(report, currentRevision, getLocalDateString()),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  function patch<K extends keyof AnalysisDraft>(key: K, value: AnalysisDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    let input: ReturnType<typeof buildAnalysisInput>;
    try {
      input = buildAnalysisInput(draft);
    } catch {
      setError("请检查标题、期间、币种、数据修订与证据 JSON；结束日期不能早于开始日期。");
      return;
    }
    setBusy(true);
    try {
      const result = snapshot
        ? await financeApi.updateAnalysis(snapshot.id, snapshot.version, input)
        : await financeApi.createAnalysis(input);
      onSaved(result.data.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <LayerCard>
      <LayerCard.Header>{report ? "编辑报告" : "新建报告"}</LayerCard.Header>
      <LayerCard.Body>
        <form onSubmit={save} className="space-y-3">
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <fieldset disabled={busy} className="space-y-3">
            <Field label="报告标题" htmlFor="report-title">
              <Input
                id="report-title"
                value={draft.title}
                onChange={(event) => patch("title", event.target.value)}
                required
                maxLength={200}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="期间开始" htmlFor="report-start">
                <Input
                  id="report-start"
                  type="date"
                  required
                  value={draft.periodStart}
                  onChange={(event) => patch("periodStart", event.target.value)}
                />
              </Field>
              <Field label="期间结束" htmlFor="report-end">
                <Input
                  id="report-end"
                  type="date"
                  required
                  value={draft.periodEnd}
                  onChange={(event) => patch("periodEnd", event.target.value)}
                />
              </Field>
              <Field
                label="来源数据修订"
                htmlFor="report-revision"
                hint={`当前财务修订 ${currentRevision}；此值是作者对所用数据的声明。`}
              >
                <Input
                  id="report-revision"
                  type="number"
                  required
                  min={0}
                  step={1}
                  value={draft.dataRevision}
                  onChange={(event) => patch("dataRevision", event.target.value)}
                />
              </Field>
            </div>
            <fieldset className="flex flex-wrap items-center gap-4 text-sm">
              <legend className="mb-1 font-medium">涉及币种</legend>
              {["CNY", "USD", "HKD"].map((currency) => (
                <label
                  key={currency}
                  htmlFor={`report-currency-${currency}`}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    id={`report-currency-${currency}`}
                    checked={draft.currencies.includes(currency)}
                    onCheckedChange={(checked) =>
                      patch(
                        "currencies",
                        checked
                          ? [...draft.currencies, currency]
                          : draft.currencies.filter((value) => value !== currency),
                      )
                    }
                  />
                  {currency}
                </label>
              ))}
            </fieldset>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">报告内容</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreview((value) => !value)}
              >
                {preview ? "继续编辑" : "预览 Markdown"}
              </Button>
            </div>
            {preview ? (
              <ReportMarkdown markdown={draft.markdown} />
            ) : (
              <Field
                label="Markdown 正文"
                htmlFor="report-markdown"
                hint="不执行 HTML，不加载图片；链接仅允许安全协议。"
              >
                <Textarea
                  id="report-markdown"
                  className="min-h-64 font-mono"
                  maxLength={100000}
                  value={draft.markdown}
                  onChange={(event) => patch("markdown", event.target.value)}
                />
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="外部标识"
                htmlFor="report-external"
                required={false}
                hint={
                  snapshot
                    ? "创建后不可更改，包括原先未提供标识的报告。"
                    : "用于外部系统去重，创建后不可更改。"
                }
              >
                <Input
                  id="report-external"
                  value={draft.externalId}
                  disabled={!!snapshot}
                  maxLength={200}
                  onChange={(event) => patch("externalId", event.target.value)}
                />
              </Field>
              <Field label="作者标签（未经验证）" htmlFor="report-author" required={false}>
                <Input
                  id="report-author"
                  value={draft.author}
                  maxLength={200}
                  onChange={(event) => patch("author", event.target.value)}
                />
              </Field>
              <Field label="模型标签（未经验证）" htmlFor="report-model" required={false}>
                <Input
                  id="report-model"
                  value={draft.model}
                  maxLength={200}
                  onChange={(event) => patch("model", event.target.value)}
                />
              </Field>
            </div>
            <Field
              label="证据 JSON"
              htmlFor="report-evidence"
              hint={
                '数组格式，例如 [{"resource":"transactions","ids":[],"dataRevision":1}]。服务端验证资源 ID 属于当前用户；外部写入还需要对应读取权限。正文、修订声明与描述标签不代表内容经过验证。'
              }
            >
              <Textarea
                id="report-evidence"
                className="min-h-24 font-mono"
                value={draft.evidence}
                onChange={(event) => patch("evidence", event.target.value)}
              />
            </Field>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              取消
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "保存中…" : "保存报告"}
            </Button>
          </div>
        </form>
      </LayerCard.Body>
    </LayerCard>
  );
}
