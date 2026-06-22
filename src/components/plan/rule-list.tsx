"use client";

// RuleList — interactive list of recurring expense rules (P3-C8).
// Spec: docs/002-recurring-expense-calendar.md § Rule list
//
// Each row shows:
//   - color chip (category's chart-N token, fallback muted)
//   - rule name
//   - category name + frequency description
//   - amount (¥yuan)
//   - status chip (active / paused / ended / expired — derived)
//   - action menu (3-dot): edit, pause/resume, end, delete
//
// Action menu items are gated by the derived display status so the
// UI matches the legal-transition matrix pinned by P2-C9:
//
//   active   → 编辑 · 暂停 · 结束 · 删除
//   paused   → 编辑 · 恢复 · 结束 · 删除
//   ended    → 编辑 · 删除                (status is terminal)
//   expired  → 编辑 · 结束 · 删除         (paused/resumed not meaningful)
//
// Architecture:
//   - Client Component. Calls only the P2 Server Actions
//     (pauseRecurringExpense / resumeRecurringExpense /
//     endRecurringExpense / deleteRecurringExpense). No
//     direct contact with the worker client or DB.
//   - Pure render — does not load data. Parent passes `rules`,
//     `categoryMap`, `todayIso`. Display status comes from
//     deriveDisplayStatus (P2-C4) so we don't duplicate the rule.

import * as React from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CHART_TOKENS } from "@/lib/palette";
import {
  describeFrequency,
  deriveDisplayStatus,
  formatAmountYuan,
} from "@/lib/recurring-expense/format";
import type {
  RecurrenceRule,
  RecurringExpenseDisplayStatus,
} from "@/lib/recurring-expense/rule-types";
import {
  endRecurringExpense,
  pauseRecurringExpense,
  resumeRecurringExpense,
} from "@/app/actions/recurring-expense-state-actions";
import { deleteRecurringExpense } from "@/app/actions/recurring-expense-actions";

export interface RuleListCategory {
  id: string;
  name: string;
  colorToken?: string;
}

export interface RuleListProps {
  rules: RecurrenceRule[];
  categoryMap: Map<string, RuleListCategory>;
  /** Used by deriveDisplayStatus to compute `expired`. */
  todayIso: string;
  /** Optional callback when the user picks "编辑" in the row menu —
   *  lets the parent open the edit form / navigate. */
  onEditRule?: (ruleId: string) => void;
  /** Fires after a state/delete Server Action succeeds. The parent
   *  page typically calls `router.refresh()` here so the visible list
   *  re-hydrates from the server. Failures do NOT fire this. */
  onActionSuccess?: () => void;
  className?: string;
}

const FALLBACK_COLOR = "hsl(var(--muted-foreground))";

function tokenColor(token: string | undefined): string {
  if (!token) return FALLBACK_COLOR;
  return CHART_TOKENS.includes(token) ? `hsl(var(--${token}))` : FALLBACK_COLOR;
}

const STATUS_LABEL: Record<RecurringExpenseDisplayStatus, string> = {
  active: "进行中",
  paused: "已暂停",
  ended: "已结束",
  expired: "已到期",
};

/** Build the status chip text. For ended / expired rules we append the
 *  relevant date (endedAt vs endDate) so the user can tell apart a
 *  manually-ended rule from one whose natural validity window expired,
 *  and which day either event happened. Spec § Rule list. */
function statusChipText(
  status: RecurringExpenseDisplayStatus,
  rule: Pick<RecurrenceRule, "endedAt" | "endDate">,
): string {
  if (status === "ended") {
    return rule.endedAt ? `${STATUS_LABEL.ended} · ${rule.endedAt}` : STATUS_LABEL.ended;
  }
  if (status === "expired") {
    return rule.endDate ? `${STATUS_LABEL.expired} · ${rule.endDate}` : STATUS_LABEL.expired;
  }
  return STATUS_LABEL[status];
}

const STATUS_VARIANT: Record<
  RecurringExpenseDisplayStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  paused: "secondary",
  ended: "outline",
  expired: "outline",
};

/** Which action menu items apply to a given display status. Exported
 *  so tests can pin the legal-transition matrix against the UI. */
export function menuItemsFor(
  status: RecurringExpenseDisplayStatus,
): Array<"edit" | "pause" | "resume" | "end" | "delete"> {
  switch (status) {
    case "active":
      return ["edit", "pause", "end", "delete"];
    case "paused":
      return ["edit", "resume", "end", "delete"];
    case "ended":
      return ["edit", "delete"];
    case "expired":
      // Still status=active in the DB so end is meaningful (transitions
      // to ended terminal); pause/resume are not exposed because the
      // rule is already past its endDate and pausing wouldn't help.
      return ["edit", "end", "delete"];
  }
}

interface ActionResult {
  success: boolean;
  error?: string;
}

async function callAction(
  fn: () => Promise<ActionResult | { success: boolean; error?: string }>,
  successMsg: string,
  onSuccess?: () => void,
): Promise<void> {
  const result = await fn();
  if (result.success) {
    toast.success(successMsg);
    onSuccess?.();
  } else {
    toast.error(result.error ?? "操作失败");
  }
}

export function RuleList({
  rules,
  categoryMap,
  todayIso,
  onEditRule,
  onActionSuccess,
  className,
}: RuleListProps): React.ReactElement {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  if (rules.length === 0) {
    return (
      <div
        data-testid="rule-list-empty"
        className={cn(
          "flex flex-col items-center justify-center rounded-md border border-dashed border-border p-8 text-sm text-muted-foreground",
          className,
        )}
      >
        还没有周期支出。先创建一条吧。
      </div>
    );
  }

  return (
    <ul
      aria-label="周期支出"
      className={cn("divide-y divide-border rounded-md border border-border", className)}
    >
      {rules.map((rule) => {
        const status = deriveDisplayStatus(rule, todayIso);
        const cat = rule.categoryId ? categoryMap.get(rule.categoryId) : undefined;
        const color = tokenColor(cat?.colorToken);
        const isPending = pendingId === rule.id;
        const items = menuItemsFor(status);

        const handle = async (
          kind: "pause" | "resume" | "end" | "delete",
        ) => {
          setPendingId(rule.id);
          try {
            switch (kind) {
              case "pause":
                await callAction(
                  () => pauseRecurringExpense(rule.id),
                  "已暂停",
                  onActionSuccess,
                );
                break;
              case "resume":
                await callAction(
                  () => resumeRecurringExpense(rule.id),
                  "已恢复",
                  onActionSuccess,
                );
                break;
              case "end":
                await callAction(
                  () => endRecurringExpense(rule.id),
                  "已结束",
                  onActionSuccess,
                );
                break;
              case "delete":
                await callAction(
                  () => deleteRecurringExpense(rule.id),
                  "已删除",
                  onActionSuccess,
                );
                break;
            }
          } finally {
            setPendingId(null);
          }
        };

        return (
          <li
            key={rule.id}
            data-rule-id={rule.id}
            data-status={status}
            className={cn(
              "flex items-center gap-3 p-4",
              isPending && "opacity-50",
            )}
          >
            <span
              aria-hidden="true"
              data-testid={`rule-color-${rule.id}`}
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{rule.name}</p>
                <Badge
                  variant={STATUS_VARIANT[status]}
                  data-testid={`status-${rule.id}`}
                >
                  {statusChipText(status, rule)}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {describeFrequency(rule)}
                {cat ? ` · ${cat.name}` : ""}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {formatAmountYuan(rule.amountCents)}
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  aria-label={`${rule.name} 操作菜单`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {items.map((item, idx) => {
                  if (item === "edit") {
                    return (
                      <DropdownMenuItem
                        key="edit"
                        onSelect={() => onEditRule?.(rule.id)}
                        disabled={!onEditRule}
                      >
                        编辑
                      </DropdownMenuItem>
                    );
                  }
                  if (item === "pause") {
                    return (
                      <DropdownMenuItem
                        key="pause"
                        onSelect={() => {
                          void handle("pause");
                        }}
                      >
                        暂停
                      </DropdownMenuItem>
                    );
                  }
                  if (item === "resume") {
                    return (
                      <DropdownMenuItem
                        key="resume"
                        onSelect={() => {
                          void handle("resume");
                        }}
                      >
                        恢复
                      </DropdownMenuItem>
                    );
                  }
                  if (item === "end") {
                    return (
                      <DropdownMenuItem
                        key="end"
                        onSelect={() => {
                          void handle("end");
                        }}
                      >
                        结束
                      </DropdownMenuItem>
                    );
                  }
                  // delete
                  return (
                    <React.Fragment key="delete-wrap">
                      {idx > 0 ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        key="delete"
                        className="text-destructive focus:text-destructive"
                        onSelect={() => {
                          void handle("delete");
                        }}
                      >
                        删除
                      </DropdownMenuItem>
                    </React.Fragment>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        );
      })}
    </ul>
  );
}
