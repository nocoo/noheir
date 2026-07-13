"use client";

// RecurringExpenseForm — create / edit form for recurring-expense rules.
// Spec: docs/002-recurring-expense-calendar.md § Recurring Expenses
//
// Fields (mirror recurringExpenseInputSchema / recurringExpenseUpdateSchema):
//   name         required, 1..200
//   amount       required, yuan (decimal); converted to amountCents in P2-C8
//   currency     "CNY" default (out of scope for now)
//   account      optional free text
//   categoryId   optional pick from the provided list
//   frequency*   handled by FrequencyPicker (P3-C2); see its docstring
//   startDate    required, ISO YYYY-MM-DD
//   endDate      optional, ISO YYYY-MM-DD, must be ≥ startDate
//   note         optional, up to 1000 chars
//
// status / endedAt are NEVER in this form — they live behind the
// pause/resume/end Server Actions (P2-C9) which P3-C8 list/menu
// surfaces.
//
// Architecture mirrors CategoryForm (P3-C3): pure Client Component,
// only talks to Server Actions, surfaces errors inline AND via
// sonner toast, uses React.useTransition for the pending state.

import * as React from "react";
import { toast } from "sonner";
import {
  createRecurringExpense,
  updateRecurringExpense,
} from "@/app/actions/recurring-expense-actions";
import {
  FrequencyPicker,
  type FrequencyPickerErrors,
  type FrequencyValue,
} from "@/components/plan/frequency-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CategoryOption {
  id: string;
  name: string;
}

export interface RecurringExpenseFormInitial {
  id?: string;
  name?: string;
  /** Yuan decimal; the form converts to cents only at the action call site. */
  amount?: number;
  categoryId?: string | null;
  account?: string | null;
  frequency?: FrequencyValue["frequency"];
  interval?: number;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  weekday?: number | null;
  startDate?: string;
  endDate?: string | null;
  note?: string | null;
}

export interface RecurringExpenseFormProps {
  initial?: RecurringExpenseFormInitial;
  categories: CategoryOption[];
  onSuccess?: (result: { id?: string }) => void;
  onCancel?: () => void;
}

interface FieldErrors {
  name?: string;
  amount?: string;
  startDate?: string;
  endDate?: string;
  frequency?: FrequencyPickerErrors;
  form?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function initialFrequency(initial?: RecurringExpenseFormInitial): FrequencyValue {
  return {
    frequency: initial?.frequency ?? "monthly",
    interval: initial?.interval ?? 1,
    dayOfMonth: initial?.dayOfMonth ?? null,
    monthOfYear: initial?.monthOfYear ?? null,
    weekday: initial?.weekday ?? null,
  };
}

/** Empty string / non-numeric / ≤ 0 → null. */
function parseYuanOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function RecurringExpenseForm({
  initial,
  categories,
  onSuccess,
  onCancel,
}: RecurringExpenseFormProps): React.ReactElement {
  const isEdit = Boolean(initial?.id);

  const [name, setName] = React.useState<string>(initial?.name ?? "");
  const [amountText, setAmountText] = React.useState<string>(
    initial?.amount != null ? initial.amount.toString() : "",
  );
  const [categoryId, setCategoryId] = React.useState<string>(initial?.categoryId ?? "");
  const [account, setAccount] = React.useState<string>(initial?.account ?? "");
  const [freq, setFreq] = React.useState<FrequencyValue>(initialFrequency(initial));
  const [startDate, setStartDate] = React.useState<string>(initial?.startDate ?? "");
  const [endDate, setEndDate] = React.useState<string>(initial?.endDate ?? "");
  const [note, setNote] = React.useState<string>(initial?.note ?? "");

  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "请填写名称";
    else if (name.trim().length > 200) next.name = "名称不能超过 200 字";

    if (parseYuanOrNull(amountText) == null) next.amount = "请填写有效金额";

    if (!ISO_DATE_RE.test(startDate)) next.startDate = "请填写开始日期";

    if (endDate) {
      if (!ISO_DATE_RE.test(endDate)) next.endDate = "结束日期格式无效";
      else if (ISO_DATE_RE.test(startDate) && endDate < startDate)
        next.endDate = "结束日期不能早于开始日期";
    }

    const freqErrors: FrequencyPickerErrors = {};
    if (freq.interval < 1) freqErrors.interval = "至少为 1";
    if (freq.frequency === "weekly" && freq.weekday == null) freqErrors.weekday = "请选择周几";
    if (freq.frequency === "monthly" && freq.dayOfMonth == null) freqErrors.dayOfMonth = "请填写日";
    if (freq.frequency === "yearly") {
      if (freq.monthOfYear == null) freqErrors.monthOfYear = "请填写月份";
      if (freq.dayOfMonth == null) freqErrors.dayOfMonth = "请填写日";
    }
    if (Object.keys(freqErrors).length > 0) next.frequency = freqErrors;

    return next;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const amount = parseYuanOrNull(amountText);
    if (amount == null) return;

    startTransition(async () => {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        amount,
        frequency: freq.frequency,
        interval: freq.interval,
        startDate,
        categoryId: categoryId || null,
        account: account.trim() || null,
        endDate: endDate || null,
        note: note.trim() || null,
      };
      if (freq.frequency === "weekly") payload.weekday = freq.weekday;
      if (freq.frequency === "monthly") payload.dayOfMonth = freq.dayOfMonth;
      if (freq.frequency === "yearly") {
        payload.monthOfYear = freq.monthOfYear;
        payload.dayOfMonth = freq.dayOfMonth;
      }

      const result =
        isEdit && initial?.id
          ? await updateRecurringExpense(initial.id, payload)
          : await createRecurringExpense(payload);

      if (result.success) {
        toast.success(isEdit ? "已更新" : "已创建");
        if (onSuccess) {
          const id = isEdit ? initial?.id : (result.data as { id: string }).id;
          onSuccess(id ? { id } : {});
        }
      } else {
        toast.error(result.error);
        setErrors({ form: result.error });
      }
    });
  };

  const freqErrors = errors.frequency;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
      aria-label={isEdit ? "编辑周期支出" : "新建周期支出"}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rx-name">名称</Label>
          <Input
            id="rx-name"
            type="text"
            maxLength={200}
            value={name}
            disabled={isPending}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "rx-name-error" : undefined}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：Netflix"
            // Form opens in a dialog; auto-focusing the first input is the
            // expected UX so the user can type immediately.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          {errors.name ? (
            <p id="rx-name-error" role="alert" className="text-sm text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="rx-amount">金额 (元)</Label>
          <Input
            id="rx-amount"
            type="number"
            min={0.01}
            step={0.01}
            inputMode="decimal"
            value={amountText}
            disabled={isPending}
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={errors.amount ? "rx-amount-error" : undefined}
            onChange={(e) => setAmountText(e.target.value)}
            placeholder="0.00"
          />
          {errors.amount ? (
            <p id="rx-amount-error" role="alert" className="text-sm text-destructive">
              {errors.amount}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rx-category">分类</Label>
          <select
            id="rx-category"
            name="categoryId"
            value={categoryId}
            disabled={isPending}
            onChange={(e) => setCategoryId(e.target.value)}
            className="border-border bg-secondary ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">未分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rx-account">账户</Label>
          <Input
            id="rx-account"
            type="text"
            maxLength={100}
            value={account}
            disabled={isPending}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="可选"
          />
        </div>
      </div>

      <FrequencyPicker
        value={freq}
        onChange={setFreq}
        disabled={isPending}
        {...(freqErrors ? { errors: freqErrors } : {})}
        idPrefix="rx-freq"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rx-start">开始日期</Label>
          <Input
            id="rx-start"
            type="date"
            value={startDate}
            disabled={isPending}
            aria-invalid={errors.startDate ? true : undefined}
            aria-describedby={errors.startDate ? "rx-start-error" : undefined}
            onChange={(e) => setStartDate(e.target.value)}
          />
          {errors.startDate ? (
            <p id="rx-start-error" role="alert" className="text-sm text-destructive">
              {errors.startDate}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="rx-end">结束日期</Label>
          <Input
            id="rx-end"
            type="date"
            value={endDate}
            disabled={isPending}
            aria-invalid={errors.endDate ? true : undefined}
            aria-describedby={errors.endDate ? "rx-end-error" : undefined}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="可选"
          />
          {errors.endDate ? (
            <p id="rx-end-error" role="alert" className="text-sm text-destructive">
              {errors.endDate}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rx-note">备注</Label>
        <Textarea
          id="rx-note"
          maxLength={1000}
          value={note}
          disabled={isPending}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          placeholder="可选"
        />
      </div>

      {errors.form ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : isEdit ? "保存" : "创建"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
            取消
          </Button>
        ) : null}
      </div>
    </form>
  );
}
