import { Badge, Button, Checkbox, ConfirmDialog, Field, Input, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { useEffect, useState } from "react";
import { currentEnvironment } from "@/components/environment-runtime";
import { API_RESOURCES, API_SCOPES, type ApiKeyInfo, type ApiScope } from "@/domain/api-contract";
import { buildKeyInput, getKeyStatus, KEY_PRESETS, toggleScope } from "@/domain/settings/api-keys";
import { financeApi } from "@/lib/finance-api";

const statusLabels = { active: "有效", expired: "已过期", revoked: "已撤销" };
const resourceLabels: Record<(typeof API_RESOURCES)[number], string> = {
  transactions: "收支",
  transfers: "转账",
  products: "产品",
  units: "资金单位",
  "contribution-logs": "资金记录",
  "expense-categories": "支出分类",
  "recurring-expenses": "周期支出",
  "account-classifications": "账户分类",
  "balance-anchors": "余额锚点",
  "financial-preferences": "财务假设",
  analyses: "分析报告",
};

export function ApiKeysClient({ initialKeys }: { initialKeys: ApiKeyInfo[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("90");
  const [scopes, setScopes] = useState<ApiScope[]>([...KEY_PRESETS.analyst]);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revoke, setRevoke] = useState<ApiKeyInfo | null>(null);
  useEffect(() => setKeys(initialKeys), [initialKeys]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    let input: ReturnType<typeof buildKeyInput>;
    try {
      input = buildKeyInput(label, scopes, days);
    } catch {
      setError("请填写名称、选择至少一项权限，并设置 1–365 天有效期。");
      return;
    }
    setBusy(true);
    try {
      const { data } = await financeApi.createKey(input);
      const { token, ...info } = data;
      setKeys((current) => [info, ...current]);
      setSecret(token);
      setCopied(false);
      setLabel("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function confirmRevoke() {
    if (!revoke) return;
    setError("");
    setBusy(true);
    try {
      await financeApi.revokeKey(revoke.id);
      setKeys((current) =>
        current.map((key) =>
          key.id === revoke.id ? { ...key, revokedAt: new Date().toISOString() } : key,
        ),
      );
      setRevoke(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "撤销失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法复制，请手动保存密钥。");
    }
  }
  const environment = currentEnvironment();
  const destructive = scopes.some((scope) => scope.endsWith(":delete") || scope === "data:replace");
  return (
    <div className="space-y-4">
      <PageHeader
        title="API 密钥"
        description="仅当前用户可管理。密钥只获得明确勾选的权限；不允许管理密钥或站点设置。"
      />
      {error && !revoke && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {secret && (
        <LayerCard>
          <LayerCard.Header>请立即保存密钥：只显示一次</LayerCard.Header>
          <LayerCard.Body className="space-y-3">
            <p className="text-muted-foreground text-sm">
              关闭或离开页面后无法再次查看。请勿将密钥放入网址、日志或共享报告。
            </p>
            <code className="block break-all select-all text-sm">{secret}</code>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy}>{copied ? "已复制" : "复制密钥"}</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSecret(null);
                  setCopied(false);
                }}
              >
                我已保存，关闭密钥
              </Button>
            </div>
          </LayerCard.Body>
        </LayerCard>
      )}
      <LayerCard>
        <LayerCard.Header>连接方式</LayerCard.Header>
        <LayerCard.Body className="space-y-2 text-sm">
          <p>
            API 地址：<code className="break-all">{window.location.origin}/api/v1</code>
          </p>
          <p>
            请求头：<code>Authorization: Bearer &lt;你的密钥&gt;</code>
            。通过安全存储向工具提供密钥；此页面不会自动保存或传递。
          </p>
          {environment && (
            <>
              <p>当前为本地 {environment.mode} 环境。命令行还必须附带当前实例请求头：</p>
              <code className="block break-all">x-noheir-instance: {environment.id}</code>
              <p className="text-muted-foreground">
                本地密钥不用于生产；切换或重启实例后重新核对实例请求头。
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-4">
            <a
              className="text-primary underline"
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI 契约
            </a>
            <a
              className="text-primary underline"
              href="/api/v1/instructions"
              target="_blank"
              rel="noopener noreferrer"
            >
              使用说明
            </a>
          </div>
        </LayerCard.Body>
      </LayerCard>
      <LayerCard>
        <LayerCard.Header>创建密钥</LayerCard.Header>
        <LayerCard.Body>
          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="密钥名称" htmlFor="key-label">
                <Input
                  id="key-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  maxLength={100}
                  required
                  disabled={busy || !!secret}
                />
              </Field>
              <Field label="有效天数" htmlFor="key-days" hint="必填，1–365 天；到期必须重新签发。">
                <Input
                  id="key-days"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  required
                  disabled={busy || !!secret}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm">权限预设</span>
              {(
                [
                  ["analyst", "财务只读"],
                  ["reports", "报告撰写"],
                  ["bookkeeper", "日常记账"],
                ] as const
              ).map(([preset, title]) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || !!secret}
                  onClick={() => setScopes([...KEY_PRESETS[preset]])}
                >
                  {title}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy || !!secret}
                onClick={() => setScopes([])}
              >
                清空选择
              </Button>
            </div>
            <fieldset disabled={busy || !!secret} className="space-y-2">
              <legend className="mb-2 text-sm font-medium">明确授权（{scopes.length} 项）</legend>
              <div className="grid gap-2 md:grid-cols-2">
                {API_RESOURCES.map((resource) => (
                  <div
                    key={resource}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-basalt-secondary p-2 text-sm"
                  >
                    <span>{resourceLabels[resource]}</span>
                    <div className="flex gap-3">
                      {(
                        [
                          ["read", "读取"],
                          ["write", "写入"],
                          ["delete", "删除"],
                        ] as const
                      ).map(([action, title]) => {
                        const scope: ApiScope = `${resource}:${action}`;
                        return (
                          <label
                            key={scope}
                            htmlFor={`key-scope-${scope}`}
                            className="flex items-center gap-1.5"
                          >
                            <Checkbox
                              id={`key-scope-${scope}`}
                              checked={scopes.includes(scope)}
                              onCheckedChange={() =>
                                setScopes((current) => toggleScope(current, scope))
                              }
                              aria-label={`${resourceLabels[resource]}：${title}`}
                            />
                            {title}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                {API_SCOPES.filter(
                  (scope) =>
                    !API_RESOURCES.some(
                      (resource) => scope.startsWith(`${resource}:`) && scope !== "units:commit",
                    ),
                ).map((scope) => (
                  <label
                    key={scope}
                    htmlFor={`key-scope-${scope}`}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`key-scope-${scope}`}
                      checked={scopes.includes(scope)}
                      onCheckedChange={() => setScopes((current) => toggleScope(current, scope))}
                    />
                    {scope === "data:replace"
                      ? "替换账本（破坏性）"
                      : scope === "units:commit"
                        ? "执行资金操作"
                        : "读取操作审计"}
                  </label>
                ))}
              </div>
            </fieldset>
            {destructive && (
              <p className="text-destructive text-sm">
                已选择破坏性权限。删除和账本替换不可撤回，请仅向可信工具授予。
              </p>
            )}
            <p className="break-words text-xs text-muted-foreground">
              {scopes.join(", ") || "未选择权限"}
            </p>
            <Button type="submit" disabled={busy || !!secret}>
              {busy ? "处理中…" : "创建密钥"}
            </Button>
          </form>
        </LayerCard.Body>
      </LayerCard>
      <LayerCard>
        <LayerCard.Header>已签发密钥（{keys.length}）</LayerCard.Header>
        <LayerCard.Body>
          {keys.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              暂无密钥。创建后请仅授予当前任务所需的最小权限。
            </p>
          ) : (
            <ul className="space-y-3">
              {keys.map((key) => {
                const status = getKeyStatus(key);
                return (
                  <li key={key.id} className="space-y-2 rounded-md bg-basalt-secondary p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{key.label}</span>
                        <Badge variant={status === "active" ? "success" : "secondary"}>
                          {statusLabels[status]}
                        </Badge>
                        <code className="text-xs">{key.prefix}</code>
                      </div>
                      {status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`撤销 ${key.label}`}
                          onClick={() => {
                            setError("");
                            setRevoke(key);
                          }}
                        >
                          撤销
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      签发 {key.createdAt} · 到期 {key.expiresAt} · 最近使用{" "}
                      {key.lastUsedAt ?? "从未"}
                      {key.revokedAt && ` · 撤销 ${key.revokedAt}`}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {key.scopes.join(", ")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </LayerCard.Body>
      </LayerCard>
      <ConfirmDialog
        open={!!revoke}
        onOpenChange={(open) => {
          if (!open) setRevoke(null);
        }}
        title="撤销密钥？"
        description={
          <>
            {revoke?.label} 将立即失效，已有外部请求不会被撤回。
            {error && (
              <span role="alert" className="block text-destructive">
                {error}
              </span>
            )}
          </>
        }
        confirmLabel="确认撤销"
        cancelLabel="取消"
        variant="destructive"
        loading={busy}
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
