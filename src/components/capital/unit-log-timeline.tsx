"use client";

/**
 * Vertical history timeline for one capital unit (column 3 of the unit editor).
 *
 * Distinct from InvestmentTimeline, which is a forward-looking Gantt of the
 * product's lock/open cycles. This one renders what actually happened.
 *
 * Per-row pnl edits fire immediately rather than joining the staged commit set:
 * they amend history, they are not part of the pending change (docs/003 § 待确认 3).
 */

import { ArrowDownLeft, ArrowUpRight, Check, History, Settings2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateContributionLog } from "@/app/actions/contribution-log-actions";
import { SectionTitle } from "@/components/capital/unit-panel-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductBadge } from "@/components/ui/colored-badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContributionOperationType, DomainContributionLog } from "@/domain/types";
import { formatCurrencyFull } from "@/lib/chart-config";
import { cn } from "@/lib/utils";

const OPERATION_META: Record<
  ContributionOperationType,
  { label: string; icon: typeof ArrowDownLeft; dot: string; text: string }
> = {
  invest: {
    label: "投入",
    icon: ArrowDownLeft,
    dot: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
  },
  withdraw: {
    label: "取出",
    icon: ArrowUpRight,
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  adjust: {
    label: "调整",
    icon: Settings2,
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "手动",
  auto: "自动",
  import: "迁移",
  mcp: "AI 助手",
};

interface UnitLogTimelineProps {
  logs: DomainContributionLog[];
  loading: boolean;
  onRefresh: () => void;
  /** Cap applied server-side; surfaced so a truncated view says so. */
  limit?: number;
}

export function UnitLogTimeline({ logs, loading, onRefresh, limit = 500 }: UnitLogTimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPnl, setDraftPnl] = useState("");
  const [isPending, startTransition] = useTransition();

  const totalPnl = logs.reduce((sum, l) => sum + (l.pnl ?? 0), 0);

  const startEdit = (log: DomainContributionLog) => {
    setEditingId(log.id);
    setDraftPnl(log.pnl != null ? String(log.pnl) : "");
  };

  const savePnl = (log: DomainContributionLog) => {
    const trimmed = draftPnl.trim();
    if (trimmed !== "" && Number.isNaN(Number(trimmed))) {
      toast.error("请输入有效数字");
      return;
    }
    startTransition(async () => {
      const result = await updateContributionLog(log.id, {
        pnl: trimmed === "" ? null : Number(trimmed),
      });
      if (result.success) {
        toast.success("损益已更新");
        setEditingId(null);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <SectionTitle icon={<History className="size-3" />} label="历史记录" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle icon={<History className="size-3" />} label="历史记录" />
        {totalPnl !== 0 && (
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              totalPnl > 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            累计损益 {totalPnl > 0 ? "+" : ""}
            {formatCurrencyFull(totalPnl)}
          </span>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">暂无历史记录</p>
      ) : (
        <ul className="divide-border max-h-[420px] divide-y overflow-y-auto">
          {logs.map((log) => {
            const meta = OPERATION_META[log.operationType] ?? OPERATION_META.adjust;
            const Icon = meta.icon;
            const isEditing = editingId === log.id;

            return (
              <li key={log.id} className={cn("flex gap-3 py-2.5", log.isDeleted && "opacity-50")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", meta.dot)} />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("size-3 shrink-0", meta.text)} />
                    <span className="text-xs font-medium">{meta.label}</span>
                    <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                      {log.operationDate}
                    </span>
                    <Badge variant="outline" className="ml-auto shrink-0 text-[9px]">
                      {SOURCE_LABELS[log.source] ?? log.source}
                    </Badge>
                  </div>

                  {(log.productName ?? log.product?.name) && (
                    <ProductBadge
                      productName={log.productName ?? log.product?.name ?? ""}
                      category={log.product?.category}
                    />
                  )}

                  {log.note && (
                    <p className="text-muted-foreground whitespace-pre-line text-[10px]">
                      {log.note}
                    </p>
                  )}

                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={draftPnl}
                        onChange={(e) => setDraftPnl(e.target.value)}
                        placeholder="损益"
                        className="h-6 w-24 text-[10px]"
                        aria-label="损益"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => savePnl(log)}
                        disabled={isPending}
                        aria-label="保存损益"
                      >
                        <Check className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => setEditingId(null)}
                        disabled={isPending}
                        aria-label="取消"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(log)}
                      className="text-muted-foreground hover:text-foreground text-[10px] underline-offset-2 hover:underline"
                    >
                      {log.pnl != null ? (
                        <span
                          className={cn(
                            "font-mono tabular-nums",
                            log.pnl >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400",
                          )}
                        >
                          损益 {log.pnl > 0 ? "+" : ""}
                          {formatCurrencyFull(log.pnl)}
                        </span>
                      ) : (
                        "记录损益"
                      )}
                    </button>
                  )}
                </div>

                <span
                  className={cn(
                    "shrink-0 self-start font-mono text-xs tabular-nums",
                    log.amount > 0 ? "text-green-600 dark:text-green-400" : "",
                    log.amount < 0 ? "text-red-600 dark:text-red-400" : "",
                    log.amount === 0 ? "text-muted-foreground" : "",
                  )}
                >
                  {log.amount > 0 ? "+" : ""}
                  {formatCurrencyFull(log.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {logs.length >= limit && (
        <p className="text-muted-foreground text-center text-[10px]">仅显示最近 {limit} 条</p>
      )}
    </div>
  );
}
