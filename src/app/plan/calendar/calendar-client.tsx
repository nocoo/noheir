"use client";

// CalendarClient — composes the entire /plan/calendar surface.
// Spec: docs/002-recurring-expense-calendar.md § Calendar page.
//
// Responsibilities:
//   - Month navigation (prev / this month / next), tracked in client state
//   - Selected day for the day-detail popover
//   - Create / edit dialog for recurring expenses (uses RecurringExpenseForm)
//   - Top-bar layout: heading + "新建" button
//   - Summary cards (when month, next 30d, next 12mo) above the calendar
//   - Calendar grid + day-detail popover side
//   - Rule list below (status-aware menus delegate to the right Server Action)
//
// Architecture:
//   - Pure Client Component. Only imports the Phase 3 presentation
//     components + Server Actions. Never touches Worker client / DB.
//   - Server Component parent (page.tsx) loads rules + categories +
//     today's ISO and passes them in. After any mutating Server Action
//     the action calls `revalidatePath("/plan")`, so a fresh request
//     re-hydrates the props (no stale local state).

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PlanCalendar,
  aggregateOccurrences,
  type PlanCalendarCategory,
} from "@/components/plan/plan-calendar";
import { PlanSummaryCards } from "@/components/plan/plan-summary-cards";
import { DayDetailPopover } from "@/components/plan/day-detail-popover";
import { RuleList, type RuleListCategory } from "@/components/plan/rule-list";
import {
  RecurringExpenseForm,
  type RecurringExpenseFormInitial,
} from "@/components/plan/recurring-expense-form";
import { formatIso, parseIso } from "@/lib/recurring-expense/occurrences";
import type { RecurrenceRule } from "@/lib/recurring-expense/rule-types";

export interface CalendarClientCategory {
  id: string;
  name: string;
  colorToken: string;
  sortOrder: number;
}

export interface CalendarClientProps {
  rules: RecurrenceRule[];
  categories: CalendarClientCategory[];
  todayIso: string;
}

function monthStartFromIso(iso: string): string {
  const { year, month } = parseIso(iso);
  return formatIso({ year, month, day: 1 });
}

function addMonthsToIso(iso: string, delta: number): string {
  const { year, month } = parseIso(iso);
  const total = year * 12 + (month - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  return formatIso({ year: ny, month: nm + 1, day: 1 });
}

/** Pure: build a RecurringExpenseFormInitial from a rule, converting
 *  cents → yuan for the form's amount input. Exported for tests. */
export function ruleToFormInitial(rule: RecurrenceRule): RecurringExpenseFormInitial {
  return {
    id: rule.id,
    name: rule.name,
    amount: rule.amountCents / 100,
    categoryId: rule.categoryId,
    account: rule.account,
    frequency: rule.frequency,
    interval: rule.interval,
    dayOfMonth: rule.dayOfMonth,
    monthOfYear: rule.monthOfYear,
    weekday: rule.weekday,
    startDate: rule.startDate,
    endDate: rule.endDate,
    note: rule.note,
  };
}

export function CalendarClient({
  rules,
  categories,
  todayIso,
}: CalendarClientProps): React.ReactElement {
  const router = useRouter();
  // Default the visible month to whichever month "today" lives in.
  const [viewMonth, setViewMonth] = React.useState<string>(() => monthStartFromIso(todayIso));
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Reusable categoryMaps. Building once per render is fine — categories
  // are bounded by UI (per-user, typically <20).
  const calendarCategoryMap = React.useMemo<Map<string, PlanCalendarCategory>>(
    () =>
      new Map(categories.map((c) => [c.id, { id: c.id, name: c.name, colorToken: c.colorToken }])),
    [categories],
  );
  const ruleListCategoryMap = React.useMemo<Map<string, RuleListCategory>>(
    () =>
      new Map(categories.map((c) => [c.id, { id: c.id, name: c.name, colorToken: c.colorToken }])),
    [categories],
  );

  // Pre-compute occurrence map for the visible 6-week window so both the
  // PlanCalendar (dot rendering) and the DayDetailPopover (list) share it.
  // PlanCalendar would also build this internally; we hoist it so the
  // popover doesn't have to recompute when the user picks a day.
  const occurrenceMap = React.useMemo(() => {
    const start = parseIso(viewMonth);
    const startCellNum = (() => {
      const dow = new Date(Date.UTC(start.year, start.month - 1, 1)).getUTCDay();
      const { day: _drop, ...rest } = start;
      void _drop;
      return { ...rest, dow };
    })();
    // 42-cell Sunday-start grid → fromIso = monthStart - startWeekday
    const fromIso = formatIso(adjustDay(start, -startCellNum.dow));
    const toIso = formatIso(adjustDay(start, 42 - startCellNum.dow - 1));
    return aggregateOccurrences(rules, fromIso, toIso);
  }, [rules, viewMonth]);

  const editingRule = React.useMemo(
    () => (editingId ? (rules.find((r) => r.id === editingId) ?? null) : null),
    [editingId, rules],
  );

  const rulesByName = React.useMemo(
    () => [...rules].sort((a, b) => a.name.localeCompare(b.name, "zh")),
    [rules],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">资金计划日历</h1>
          <p className="text-sm text-muted-foreground">管理家庭周期支出，可视化未来现金流</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="open-create-rule">
          <Plus className="size-4" />
          新建周期支出
        </Button>
      </div>

      <PlanSummaryCards rules={rules} viewMonth={viewMonth} todayIso={todayIso} />

      <div className="rounded-md border border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="上一月"
            onClick={() => setViewMonth((v) => addMonthsToIso(v, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setViewMonth(monthStartFromIso(todayIso))}
          >
            今天
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="下一月"
            onClick={() => setViewMonth((v) => addMonthsToIso(v, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <PlanCalendar
          viewMonth={viewMonth}
          rules={rules}
          categoryMap={calendarCategoryMap}
          todayIso={todayIso}
          selectedDay={selectedDay}
          onSelectDay={(iso) => setSelectedDay(iso)}
          onOpenRule={(id) => setEditingId(id)}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">所有规则</h2>
        <RuleList
          rules={rulesByName}
          categoryMap={ruleListCategoryMap}
          todayIso={todayIso}
          onEditRule={(id) => setEditingId(id)}
          onActionSuccess={() => router.refresh()}
        />
      </div>

      <DayDetailPopover
        open={selectedDay !== null}
        isoDate={selectedDay}
        occurrencesByDay={occurrenceMap}
        categoryMap={calendarCategoryMap}
        onClose={() => setSelectedDay(null)}
        onOpenRule={(id) => {
          setSelectedDay(null);
          setEditingId(id);
        }}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建周期支出</DialogTitle>
          </DialogHeader>
          <RecurringExpenseForm
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            onSuccess={() => {
              setCreateOpen(false);
              router.refresh();
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editingRule !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑周期支出</DialogTitle>
          </DialogHeader>
          {editingRule ? (
            <RecurringExpenseForm
              initial={ruleToFormInitial(editingRule)}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              onSuccess={() => {
                setEditingId(null);
                router.refresh();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── helpers (no Date math leaks outside) ────────────────────────────

function adjustDay(
  ymd: { year: number; month: number; day: number },
  deltaDays: number,
): { year: number; month: number; day: number } {
  // Cheap day shift via UTC; only used for the calendar window edges.
  const base = Date.UTC(ymd.year, ymd.month - 1, ymd.day);
  const shifted = new Date(base + deltaDays * 86400_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}
