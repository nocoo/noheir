import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Field,
  Input,
  LayerCard,
  Separator,
} from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import {
  ArrowLeftRight,
  BookOpen,
  CalendarClock,
  ChartNoAxesCombined,
  Check,
  Copy,
  FileJson2,
  FilePenLine,
  FileText,
  Fingerprint,
  History,
  KeyRound,
  Landmark,
  Layers3,
  type LucideIcon,
  MapPinned,
  PlugZap,
  Plus,
  ReceiptText,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Trash2,
  WalletCards,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { currentEnvironment } from "@/components/environment-runtime";
import type { ApiKeyInfo, ApiResource, ApiScope } from "@/domain/api-contract";
import { buildKeyInput, getKeyStatus, KEY_PRESETS, toggleScope } from "@/domain/settings/api-keys";
import { financeApi } from "@/lib/finance-api";

const statusLabels = { active: "有效", expired: "已过期", revoked: "已撤销" };
const iconTones = {
  blue: "bg-basalt-info-tint text-basalt-info",
  green: "bg-basalt-chart-3/20 text-basalt-foreground",
  amber: "bg-basalt-warning-tint text-basalt-warning",
  pink: "bg-basalt-chart-9/20 text-basalt-foreground",
};
const resourcePresentation = {
  transactions: ["收支", ReceiptText, "green"],
  transfers: ["转账", ArrowLeftRight, "blue"],
  products: ["产品", Landmark, "amber"],
  units: ["资金单位", Layers3, "blue"],
  "contribution-logs": ["资金记录", History, "pink"],
  "expense-categories": ["支出分类", Tags, "amber"],
  "recurring-expenses": ["周期支出", CalendarClock, "blue"],
  "account-classifications": ["账户分类", WalletCards, "green"],
  "balance-anchors": ["余额锚点", MapPinned, "blue"],
  "financial-preferences": ["财务假设", SlidersHorizontal, "amber"],
  analyses: ["分析报告", FileText, "pink"],
} as const satisfies Record<ApiResource, readonly [string, LucideIcon, keyof typeof iconTones]>;
const resourceGroups = [
  {
    title: "财务记录",
    icon: WalletCards,
    tone: "blue",
    resources: ["transactions", "transfers", "products", "units", "contribution-logs"],
  },
  {
    title: "规划与分析",
    icon: ChartNoAxesCombined,
    tone: "green",
    resources: [
      "expense-categories",
      "recurring-expenses",
      "account-classifications",
      "balance-anchors",
      "financial-preferences",
      "analyses",
    ],
  },
] as const;
const extraScopes = [
  ["units:commit", "执行资金操作", Layers3, "text-basalt-warning"],
  ["audit:read", "读取操作审计", ScanEye, "text-basalt-info"],
  ["data:replace", "替换账本（破坏性）", ShieldAlert, "text-basalt-danger"],
] as const;

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
        title={
          <span className="flex items-center gap-3">
            <span className="rounded-lg bg-basalt-warning-tint p-2 text-basalt-warning">
              <KeyRound aria-hidden="true" className="size-5" strokeWidth={1.5} />
            </span>
            API 密钥
          </span>
        }
        description="仅当前用户可管理。密钥只获得明确勾选的权限；不允许管理密钥或站点设置。"
      />
      {error && !revoke && (
        <p role="alert" className="text-basalt-destructive text-sm">
          {error}
        </p>
      )}
      {secret && (
        <LayerCard>
          <LayerCard.Header>
            <span className="flex items-center gap-2 text-basalt-warning">
              <ShieldAlert aria-hidden="true" className="size-4" strokeWidth={1.5} />
              请立即保存密钥：只显示一次
            </span>
          </LayerCard.Header>
          <LayerCard.Body className="space-y-3">
            <p className="text-basalt-muted-foreground text-sm">
              关闭或离开页面后无法再次查看。请勿将密钥放入网址、日志或共享报告。
            </p>
            <code className="block break-all select-all text-sm">{secret}</code>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy}>
                {copied ? (
                  <Check aria-hidden="true" strokeWidth={1.5} />
                ) : (
                  <Copy aria-hidden="true" strokeWidth={1.5} />
                )}
                {copied ? "已复制" : "复制密钥"}
              </Button>
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
        <LayerCard.Header>
          <span className="flex items-center gap-2">
            <PlugZap aria-hidden="true" className="size-4 text-basalt-info" strokeWidth={1.5} />
            连接方式
          </span>
        </LayerCard.Header>
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
              <p className="text-basalt-muted-foreground">
                本地密钥不用于生产；切换或重启实例后重新核对实例请求头。
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-4">
            <a
              className="inline-flex items-center gap-1.5 text-basalt-info underline underline-offset-4"
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileJson2 aria-hidden="true" className="size-4" strokeWidth={1.5} />
              OpenAPI 契约
            </a>
            <a
              className="inline-flex items-center gap-1.5 text-basalt-info underline underline-offset-4"
              href="/api/v1/instructions"
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen aria-hidden="true" className="size-4" strokeWidth={1.5} />
              使用说明
            </a>
          </div>
        </LayerCard.Body>
      </LayerCard>
      <LayerCard>
        <LayerCard.Header>
          <span className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-4 text-basalt-warning" strokeWidth={1.5} />
            创建密钥
          </span>
        </LayerCard.Header>
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
              <span className="text-basalt-muted-foreground text-sm">权限预设</span>
              {(
                [
                  ["analyst", "财务只读", ScanEye, "text-basalt-info"],
                  ["reports", "报告撰写", FilePenLine, "text-basalt-warning"],
                  ["bookkeeper", "日常记账", ReceiptText, "text-basalt-badge-teal"],
                ] as const
              ).map(([preset, title, Icon, color]) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || !!secret}
                  onClick={() => setScopes([...KEY_PRESETS[preset]])}
                >
                  <Icon aria-hidden="true" className={color} strokeWidth={1.5} />
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
            <fieldset disabled={busy || !!secret} className="space-y-4">
              <legend className="mb-3 text-sm font-medium">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-4 text-basalt-info"
                    strokeWidth={1.5}
                  />
                  明确授权（{scopes.length} 项）
                </span>
              </legend>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
                {resourceGroups.map((group, index) => (
                  <Fragment key={group.title}>
                    {index > 0 && <Separator orientation="vertical" className="hidden xl:block" />}
                    <LayerCard role="group" aria-label={group.title} className="min-w-0">
                      <LayerCard.Header className="items-center px-3">
                        <span className="flex items-center gap-2 font-medium text-basalt-foreground">
                          <span className={`rounded-md p-1.5 ${iconTones[group.tone]}`}>
                            <group.icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                          </span>
                          {group.title}
                        </span>
                        <Badge variant="outline">{group.resources.length} 类资源</Badge>
                      </LayerCard.Header>
                      <LayerCard.Body className="divide-y divide-basalt-border/60 px-3 py-1">
                        {group.resources.map((resource) => {
                          const [label, Icon, tone] = resourcePresentation[resource];
                          return (
                            <div
                              key={resource}
                              className="flex flex-wrap items-center justify-between gap-x-3 py-1 text-sm"
                            >
                              <span className="flex items-center gap-2 py-1">
                                <span className={`rounded-md p-1.5 ${iconTones[tone]}`}>
                                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                                </span>
                                {label}
                              </span>
                              <div className="flex gap-3">
                                {(
                                  [
                                    ["read", "读取", "text-basalt-info"],
                                    ["write", "写入", "text-basalt-warning"],
                                    ["delete", "删除", "text-basalt-danger"],
                                  ] as const
                                ).map(([action, title, color]) => {
                                  const scope: ApiScope = `${resource}:${action}`;
                                  return (
                                    <label
                                      key={scope}
                                      htmlFor={`key-scope-${scope}`}
                                      className={`flex min-h-11 items-center gap-1.5 ${color}`}
                                    >
                                      <Checkbox
                                        id={`key-scope-${scope}`}
                                        checked={scopes.includes(scope)}
                                        onCheckedChange={() =>
                                          setScopes((current) => toggleScope(current, scope))
                                        }
                                        aria-label={`${label}：${title}`}
                                      />
                                      {title}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </LayerCard.Body>
                    </LayerCard>
                  </Fragment>
                ))}
              </div>
              <fieldset aria-label="额外操作" className="space-y-2">
                <p className="text-xs font-medium text-basalt-muted-foreground">
                  额外操作 · 单独授权
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  {extraScopes.map(([scope, label, Icon, color]) => (
                    <LayerCard.Well key={scope} className="rounded-md px-3 py-0">
                      <label
                        htmlFor={`key-scope-${scope}`}
                        className="flex min-h-11 items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={`key-scope-${scope}`}
                          checked={scopes.includes(scope)}
                          onCheckedChange={() =>
                            setScopes((current) => toggleScope(current, scope))
                          }
                        />
                        <Icon
                          aria-hidden="true"
                          className={`size-4 shrink-0 ${color}`}
                          strokeWidth={1.5}
                        />
                        {label}
                      </label>
                    </LayerCard.Well>
                  ))}
                </div>
              </fieldset>
            </fieldset>
            {destructive && (
              <p className="flex items-start gap-2 text-basalt-danger text-sm">
                <ShieldAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                  strokeWidth={1.5}
                />
                已选择破坏性权限。删除和账本替换不可撤回，请仅向可信工具授予。
              </p>
            )}
            <p className="break-words text-xs text-basalt-muted-foreground">
              {scopes.join(", ") || "未选择权限"}
            </p>
            <Button type="submit" disabled={busy || !!secret}>
              <Plus aria-hidden="true" strokeWidth={1.5} />
              {busy ? "处理中…" : "创建密钥"}
            </Button>
          </form>
        </LayerCard.Body>
      </LayerCard>
      <LayerCard>
        <LayerCard.Header>
          <span className="flex items-center gap-2">
            <Fingerprint aria-hidden="true" className="size-4 text-basalt-info" strokeWidth={1.5} />
            已签发密钥（{keys.length}）
          </span>
        </LayerCard.Header>
        <LayerCard.Body>
          {keys.length === 0 ? (
            <p className="text-basalt-muted-foreground text-sm">
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
                        <KeyRound
                          aria-hidden="true"
                          className="size-4 text-basalt-warning"
                          strokeWidth={1.5}
                        />
                        <span className="font-medium">{key.label}</span>
                        <Badge
                          dot
                          variant={
                            status === "active"
                              ? "success"
                              : status === "expired"
                                ? "warning"
                                : "secondary"
                          }
                        >
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
                          <Trash2
                            aria-hidden="true"
                            className="text-basalt-danger"
                            strokeWidth={1.5}
                          />
                          撤销
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-basalt-muted-foreground">
                      签发 {key.createdAt} · 到期 {key.expiresAt} · 最近使用{" "}
                      {key.lastUsedAt ?? "从未"}
                      {key.revokedAt && ` · 撤销 ${key.revokedAt}`}
                    </p>
                    <p className="break-words text-xs text-basalt-muted-foreground">
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
              <span role="alert" className="block text-basalt-destructive">
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
