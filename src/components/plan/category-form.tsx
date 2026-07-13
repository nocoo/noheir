"use client";

// CategoryForm — create / edit form for an expense category.
// Spec: docs/002-recurring-expense-calendar.md § Categories
//
// Fields:
//   name        required, 1..50
//   colorToken  required, one of CHART_TOKENS (24 chart colors)
//   sortOrder   integer ≥ 0, defaults to 0
//
// Contract:
// - Client Component. Only calls Server Actions. No direct
//   imports from `api-helpers`, the worker client, or the DB.
// - Validation runs at the Server Action layer (Zod). On error
//   the action returns `{ success: false, error }` which we
//   surface as a sonner toast AND as inline form messages so
//   keyboard users don't have to chase a transient popover.
// - On success the parent `onSuccess` callback runs after the
//   sonner toast so the parent can close a dialog / navigate.

import * as React from "react";
import { toast } from "sonner";
import {
  createExpenseCategory,
  updateExpenseCategory,
} from "@/app/actions/expense-category-actions";
import { ColorTokenPicker } from "@/components/plan/color-token-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHART_TOKENS } from "@/lib/palette";

export interface CategoryFormInitial {
  id?: string;
  name?: string;
  colorToken?: string;
  sortOrder?: number;
}

export interface CategoryFormProps {
  /** Provide an `id` (and the rest) for edit mode. Omit entirely for create. */
  initial?: CategoryFormInitial;
  /** Called after a successful create/update, AFTER the toast fires.
   *  Parent typically uses this to close a dialog or reset the form. */
  onSuccess?: (result: { id?: string }) => void;
  onCancel?: () => void;
  /** Override the default first color when creating. Defaults to chart-1. */
  defaultColorToken?: string;
}

const DEFAULT_TOKEN = "chart-1";

interface FieldErrors {
  name?: string;
  colorToken?: string;
}

export function CategoryForm({
  initial,
  onSuccess,
  onCancel,
  defaultColorToken = DEFAULT_TOKEN,
}: CategoryFormProps): React.ReactElement {
  const isEdit = Boolean(initial?.id);

  const [name, setName] = React.useState<string>(initial?.name ?? "");
  const initialColor =
    initial?.colorToken && CHART_TOKENS.includes(initial.colorToken)
      ? initial.colorToken
      : defaultColorToken;
  const [colorToken, setColorToken] = React.useState<string>(initialColor);
  const [sortOrder, setSortOrder] = React.useState<number>(initial?.sortOrder ?? 0);

  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = "请填写分类名";
    else if (trimmed.length > 50) next.name = "分类名不能超过 50 字";
    if (!CHART_TOKENS.includes(colorToken)) next.colorToken = "请选择颜色";
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

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        colorToken,
        sortOrder,
      };
      const result =
        isEdit && initial?.id
          ? await updateExpenseCategory(initial.id, payload)
          : await createExpenseCategory(payload);

      if (result.success) {
        toast.success(isEdit ? "分类已更新" : "分类已创建");
        if (onSuccess) {
          const id = isEdit ? initial?.id : (result.data as { id: string }).id;
          onSuccess(id ? { id } : {});
        }
      } else {
        toast.error(result.error);
        // Surface as inline error too. If the worker said "分类名已存在"
        // we can attribute it to the name field.
        if (result.error.includes("分类名")) {
          setErrors({ name: result.error });
        } else {
          setErrors({ name: result.error });
        }
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
      aria-label={isEdit ? "编辑分类" : "新建分类"}
    >
      <div className="space-y-2">
        <Label htmlFor="category-name">分类名</Label>
        <Input
          id="category-name"
          name="name"
          type="text"
          maxLength={50}
          value={name}
          disabled={isPending}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "category-name-error" : undefined}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：房贷"
          // Form opens in a dialog; auto-focusing the only text input is the
          // expected UX so the user can type immediately.
          autoFocus
        />
        {errors.name ? (
          <p id="category-name-error" role="alert" className="text-sm text-destructive">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label id="category-color-label">颜色</Label>
        <ColorTokenPicker
          value={colorToken}
          onChange={(token) => {
            setColorToken(token);
            if (errors.colorToken) {
              setErrors((prev) => {
                const { colorToken: _drop, ...rest } = prev;
                void _drop;
                return rest;
              });
            }
          }}
          disabled={isPending}
          label="选择分类颜色"
        />
        {errors.colorToken ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.colorToken}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-sort">排序</Label>
        <Input
          id="category-sort"
          name="sortOrder"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={sortOrder.toString()}
          disabled={isPending}
          onChange={(e) => {
            const n = Number(e.target.value);
            setSortOrder(Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0);
          }}
          className="w-24"
        />
      </div>

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
