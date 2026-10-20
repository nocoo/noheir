import { Badge, Button, ConfirmDialog, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { useState } from "react";
import { Link } from "react-router";
import { ReportMarkdown } from "@/components/report-markdown";
import { reportRevisionState } from "@/domain/analyses";
import type { Analysis } from "@/domain/api-contract";
import { financeApi } from "@/lib/finance-api";
import { AnalysisEditor } from "./analysis-editor";

const revisionLabels = {
  current: "来源修订与当前财务修订一致；不代表报告内容准确。",
  changed: "财务数据已变化，报告可能不再适用。",
  unverified: "无法验证来源修订，请核对作者提供的证据。",
};
export function AnalysisDetail({
  report,
  currentRevision,
  onDeleted,
  onSaved,
}: {
  report: Analysis;
  currentRevision: number;
  onDeleted: () => void;
  onSaved: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleteSnapshot, setDeleteSnapshot] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (!deleteSnapshot) return;
    setBusy(true);
    setError("");
    try {
      await financeApi.deleteAnalysis(deleteSnapshot.id, deleteSnapshot.version);
      setDeleteSnapshot(null);
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  const status = reportRevisionState(report.dataRevision, currentRevision);
  return (
    <div className="space-y-4">
      <PageHeader
        title={report.title}
        description={`${report.periodStart} – ${report.periodEnd} · ${report.currencies.join(" / ")}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/analyses">返回报告</Link>
            </Button>
            <Button variant="outline" onClick={() => setDeleteSnapshot(report)}>
              删除报告
            </Button>
            <Button onClick={() => setEditing((value) => !value)} disabled={editing}>
              编辑报告
            </Button>
          </>
        }
      />
      {editing ? (
        <AnalysisEditor
          report={report}
          currentRevision={currentRevision}
          onCancel={() => setEditing(false)}
          onSaved={(id) => {
            setEditing(false);
            onSaved(id);
          }}
        />
      ) : (
        <LayerCard>
          <LayerCard.Body>
            <ReportMarkdown markdown={report.markdown} />
          </LayerCard.Body>
        </LayerCard>
      )}
      <LayerCard>
        <LayerCard.Header>来源与证据</LayerCard.Header>
        <LayerCard.Body className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={status === "current" ? "secondary" : "warning"}>
              来源修订 {report.dataRevision} · 当前修订 {currentRevision}
            </Badge>
            <Badge variant="outline">报告版本 {report.version}</Badge>
          </div>
          <p>{revisionLabels[status]}</p>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">提交身份（服务端记录）</dt>
            <dd className="break-all">
              {report.createdBy.kind === "human" ? "用户" : `API 密钥 ${report.createdBy.keyId}`}
            </dd>
            <dt className="text-muted-foreground">创建 / 更新</dt>
            <dd>
              {report.createdAt} / {report.updatedAt}
            </dd>
            <dt className="text-muted-foreground">外部标识</dt>
            <dd>{report.externalId ?? "未提供"}</dd>
            <dt className="text-muted-foreground">描述标签（未经验证）</dt>
            <dd>
              {report.author ?? "未提供作者"} · {report.model ?? "未提供模型"}
            </dd>
          </dl>
          <p className="text-muted-foreground">
            证据资源 ID
            已在保存时由服务端核对归属；外部提交还需对应读取权限。这不验证正文结论、作者标签或修订声明，不构成产品操作指令或投资建议。
          </p>
          {report.evidence.length ? (
            <ul className="space-y-2">
              {Array.from(
                new Map(report.evidence.map((evidence) => [JSON.stringify(evidence), evidence])),
                ([key, evidence]) => (
                  <li key={key} className="rounded-md bg-basalt-secondary p-3">
                    <p>
                      {evidence.resource} · 数据修订 {evidence.dataRevision}
                    </p>
                    <p className="break-all text-muted-foreground">
                      {evidence.ids.length ? evidence.ids.join(", ") : "未提供记录标识"}
                    </p>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p className="text-muted-foreground">未提供结构化证据。</p>
          )}
        </LayerCard.Body>
      </LayerCard>
      <ConfirmDialog
        open={deleteSnapshot !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteSnapshot(null);
        }}
        title="删除报告？"
        description={
          <>
            此操作无法撤销，外部标识仍保留以阻止延迟请求重新创建。
            {error && (
              <span role="alert" className="block text-destructive">
                {error}
              </span>
            )}
          </>
        }
        confirmLabel="确认删除"
        cancelLabel="取消"
        variant="destructive"
        loading={busy}
        onConfirm={remove}
      />
    </div>
  );
}
