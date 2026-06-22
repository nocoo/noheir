"use client";

// FrequencyPicker — controlled multi-field picker for a recurring
// expense rule's recurrence shape. Spec: docs/002-recurring-expense-calendar.md.
//
// The picker owns four logically-coupled fields:
//   frequency:    "daily" | "weekly" | "monthly" | "yearly"
//   interval:     integer ≥ 1 (every N units of the frequency)
//   dayOfMonth:   1..31 (used by monthly / yearly)
//   monthOfYear:  1..12 (used by yearly only)
//   weekday:      0..6 (used by weekly only; 0 = Sunday)
//
// Switching frequency CLEARS unrelated fields (e.g. switching from
// weekly → monthly nulls `weekday` and asks for `dayOfMonth`) so a
// stale value never sneaks past the Zod superRefine in
// recurringExpenseInputSchema. The schema is the canonical contract;
// this picker is the UX that helps users satisfy it.
//
// Frequency selection uses a WAI-ARIA radiogroup (same pattern as
// ColorTokenPicker) — 4 visible buttons, exactly one focusable,
// arrow-key navigation. Conditional fields render inline below and
// are wired to Input components consistent with the rest of Noheir.

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export interface FrequencyValue {
  frequency: Frequency;
  /** Every N units of the chosen frequency. ≥ 1. */
  interval: number;
  /** 1..31 — used by monthly + yearly. */
  dayOfMonth: number | null;
  /** 1..12 — used by yearly only. */
  monthOfYear: number | null;
  /** 0..6 (Sunday..Saturday) — used by weekly only. */
  weekday: number | null;
}

export interface FrequencyPickerErrors {
  interval?: string;
  dayOfMonth?: string;
  monthOfYear?: string;
  weekday?: string;
}

export interface FrequencyPickerProps {
  value: FrequencyValue;
  onChange: (next: FrequencyValue) => void;
  disabled?: boolean;
  errors?: FrequencyPickerErrors;
  /** Prefix for generated input ids — defaults to `freq`. Useful when
   *  the form has multiple pickers on the same page. */
  idPrefix?: string;
  className?: string;
}

const FREQ_LABEL: Record<Frequency, string> = {
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年",
};

const FREQ_UNIT: Record<Frequency, string> = {
  daily: "天",
  weekly: "周",
  monthly: "月",
  yearly: "年",
};

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** Apply a frequency change while wiping fields that don't apply.
 *  Exported for unit tests; pure function. */
export function applyFrequencyChange(
  prev: FrequencyValue,
  next: Frequency,
): FrequencyValue {
  if (prev.frequency === next) return prev;
  // Keep interval (semantically meaningful in every mode).
  const base: FrequencyValue = {
    frequency: next,
    interval: prev.interval,
    dayOfMonth: null,
    monthOfYear: null,
    weekday: null,
  };
  // Preserve fields that still apply in the new mode, so users who flip
  // back and forth don't lose their input.
  if (next === "monthly" || next === "yearly") {
    base.dayOfMonth = prev.dayOfMonth;
  }
  if (next === "yearly") {
    base.monthOfYear = prev.monthOfYear;
  }
  if (next === "weekly") {
    base.weekday = prev.weekday;
  }
  return base;
}

function arrowToIndex(
  current: number,
  key: string,
  count: number,
): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Parse a number input value into an integer in a domain range,
 *  or null if the field is empty / unparseable / out of range.
 *  Returning null (instead of clamping) lets the caller distinguish
 *  "user hasn't filled this" from "user typed a valid value" — the
 *  form layer treats null as missing and surfaces a required-field
 *  error rather than silently storing 1. */
function parseIntInRange(
  raw: string,
  min: number,
  max: number,
): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const trunc = Math.trunc(n);
  if (trunc < min || trunc > max) return null;
  return trunc;
}

/** Same as parseIntInRange but for interval, which has no upper bound
 *  in the domain and must coerce to ≥ 1 (never null) because the
 *  base shape's Zod default is 1 and there is no "no interval" state. */
function parseIntervalOrOne(raw: string): number {
  if (raw.trim() === "") return 1;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  const trunc = Math.trunc(n);
  return trunc >= 1 ? trunc : 1;
}

export function FrequencyPicker({
  value,
  onChange,
  disabled = false,
  errors,
  idPrefix = "freq",
  className,
}: FrequencyPickerProps): React.ReactElement {
  const buttonRef = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIdx = FREQUENCIES.indexOf(value.frequency);
  const [tabIdx, setTabIdx] = React.useState<number>(
    selectedIdx >= 0 ? selectedIdx : 0,
  );
  React.useEffect(() => {
    if (selectedIdx >= 0) setTabIdx(selectedIdx);
  }, [selectedIdx]);

  const setFrequency = (next: Frequency) => {
    onChange(applyFrequencyChange(value, next));
  };

  const handleKey = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (disabled) return;
    const target = arrowToIndex(idx, e.key, FREQUENCIES.length);
    if (target === null) return;
    e.preventDefault();
    setTabIdx(target);
    buttonRef.current[target]?.focus();
    const f = FREQUENCIES[target];
    if (f) setFrequency(f);
  };

  const intervalId = `${idPrefix}-interval`;
  const dayId = `${idPrefix}-day`;
  const monthId = `${idPrefix}-month`;
  const weekdayGroupId = `${idPrefix}-weekday-group`;

  // Interval input: we keep a local string so the user can transiently
  // clear the field (showing empty) without us snapping the underlying
  // value back to 1 mid-keystroke. The committed value still flows
  // through onChange — empty parses as 1 (the domain min) so a partially
  // typed state never produces an invalid value upstream.
  const [intervalText, setIntervalText] = React.useState<string>(
    value.interval.toString(),
  );
  // External value changes (e.g. parent reset) re-sync the text.
  React.useEffect(() => {
    setIntervalText(value.interval.toString());
  }, [value.interval]);

  // Weekday radiogroup roving tab stop. Defaults to the selected weekday
  // (or 0 = Sunday) and follows the user's arrow-key navigation. Same
  // contract as the frequency selector and ColorTokenPicker.
  const weekdayRef = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [weekdayTabIdx, setWeekdayTabIdx] = React.useState<number>(
    value.weekday ?? 0,
  );
  React.useEffect(() => {
    if (value.weekday != null) setWeekdayTabIdx(value.weekday);
  }, [value.weekday]);

  const handleWeekdayKey = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number,
  ) => {
    if (disabled) return;
    const target = arrowToIndex(idx, e.key, WEEKDAY_LABELS.length);
    if (target === null) return;
    e.preventDefault();
    setWeekdayTabIdx(target);
    weekdayRef.current[target]?.focus();
    onChange({ ...value, weekday: target });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Frequency selector */}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-radiogroup`}>频率</Label>
        <div
          id={`${idPrefix}-radiogroup`}
          role="radiogroup"
          aria-label="频率"
          aria-disabled={disabled || undefined}
          className={cn(
            "inline-flex rounded-md border border-border bg-secondary p-1 gap-1",
            disabled && "opacity-50 pointer-events-none",
          )}
        >
          {FREQUENCIES.map((f, idx) => {
            const selected = f === value.frequency;
            const isTabStop = idx === tabIdx;
            return (
              <button
                key={f}
                ref={(el) => {
                  buttonRef.current[idx] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={FREQ_LABEL[f]}
                data-frequency={f}
                tabIndex={disabled ? -1 : isTabStop ? 0 : -1}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  setTabIdx(idx);
                  setFrequency(f);
                }}
                onKeyDown={(e) => handleKey(e, idx)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {FREQ_LABEL[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interval — present in every mode */}
      <div className="space-y-2">
        <Label htmlFor={intervalId}>每隔</Label>
        <div className="flex items-center gap-2">
          <Input
            id={intervalId}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={intervalText}
            disabled={disabled}
            aria-invalid={errors?.interval ? true : undefined}
            aria-describedby={errors?.interval ? `${intervalId}-error` : undefined}
            onChange={(e) => {
              const raw = e.target.value;
              setIntervalText(raw);
              onChange({ ...value, interval: parseIntervalOrOne(raw) });
            }}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">
            {FREQ_UNIT[value.frequency]}
          </span>
        </div>
        {errors?.interval ? (
          <p id={`${intervalId}-error`} role="alert" className="text-sm text-destructive">
            {errors.interval}
          </p>
        ) : null}
      </div>

      {/* Conditional fields */}
      {value.frequency === "weekly" ? (
        <div className="space-y-2">
          <Label id={`${weekdayGroupId}-label`}>周几</Label>
          <div
            role="radiogroup"
            aria-labelledby={`${weekdayGroupId}-label`}
            aria-invalid={errors?.weekday ? true : undefined}
            aria-describedby={errors?.weekday ? `${weekdayGroupId}-error` : undefined}
            className="flex flex-wrap gap-2"
          >
            {WEEKDAY_LABELS.map((label, w) => {
              const selected = value.weekday === w;
              const isTabStop = w === weekdayTabIdx;
              return (
                <button
                  key={w}
                  ref={(el) => {
                    weekdayRef.current[w] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={label}
                  disabled={disabled}
                  tabIndex={disabled ? -1 : isTabStop ? 0 : -1}
                  data-weekday={w}
                  onClick={() => {
                    if (disabled) return;
                    setWeekdayTabIdx(w);
                    onChange({ ...value, weekday: w });
                  }}
                  onKeyDown={(e) => handleWeekdayKey(e, w)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-foreground bg-foreground/10"
                      : "border-border bg-secondary hover:bg-background",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {errors?.weekday ? (
            <p id={`${weekdayGroupId}-error`} role="alert" className="text-sm text-destructive">
              {errors.weekday}
            </p>
          ) : null}
        </div>
      ) : null}

      {value.frequency === "yearly" ? (
        <div className="space-y-2">
          <Label htmlFor={monthId}>月份</Label>
          <Input
            id={monthId}
            type="number"
            min={1}
            max={12}
            step={1}
            inputMode="numeric"
            value={value.monthOfYear?.toString() ?? ""}
            disabled={disabled}
            aria-invalid={errors?.monthOfYear ? true : undefined}
            aria-describedby={errors?.monthOfYear ? `${monthId}-error` : undefined}
            placeholder="1-12"
            onChange={(e) => {
              onChange({ ...value, monthOfYear: parseIntInRange(e.target.value, 1, 12) });
            }}
            className="w-24"
          />
          {errors?.monthOfYear ? (
            <p id={`${monthId}-error`} role="alert" className="text-sm text-destructive">
              {errors.monthOfYear}
            </p>
          ) : null}
        </div>
      ) : null}

      {value.frequency === "monthly" || value.frequency === "yearly" ? (
        <div className="space-y-2">
          <Label htmlFor={dayId}>日</Label>
          <Input
            id={dayId}
            type="number"
            min={1}
            max={31}
            step={1}
            inputMode="numeric"
            value={value.dayOfMonth?.toString() ?? ""}
            disabled={disabled}
            aria-invalid={errors?.dayOfMonth ? true : undefined}
            aria-describedby={errors?.dayOfMonth ? `${dayId}-error` : undefined}
            placeholder="1-31"
            onChange={(e) => {
              onChange({ ...value, dayOfMonth: parseIntInRange(e.target.value, 1, 31) });
            }}
            className="w-24"
          />
          {errors?.dayOfMonth ? (
            <p id={`${dayId}-error`} role="alert" className="text-sm text-destructive">
              {errors.dayOfMonth}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
