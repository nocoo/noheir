"use client";

// ColorTokenPicker — 24-token closed-set color picker for the
// 002-spec recurring expense calendar.
//
// Why a closed set: spec docs/002-recurring-expense-calendar.md keeps
// category colors restricted to the `chart-1`..`chart-24` palette so
// every visualization (calendar dots, list chips, summary cards)
// renders against the existing chart theme — light + dark variants,
// muted/vivid pairings — without one-off hex values diverging from
// the rest of Noheir.
//
// Closed set is also defended at the Zod layer (`categoryInputSchema`
// in src/lib/recurring-expense/rule-types.ts) and at the worker
// (createExpenseCategorySchema). This component is just the UI
// guarantee that users cannot enter anything off-palette.
//
// A11y: implemented as a WAI-ARIA radiogroup. Exactly one swatch
// is in the tab order at a time; arrow keys move BOTH focus and
// selection (the spec calls for keyboard-and-a11y test coverage,
// so the keyboard behavior is a contract pinned by tests).

import * as React from "react";
import { Check } from "lucide-react";
import { CHART_TOKENS } from "@/lib/palette";
import { cn } from "@/lib/utils";

/** Human-readable names matching the order of `CHART_TOKENS` (chart-1..24).
 *  Mirrors the "Sky / Teal / Jade / ..." comments in globals.css. Used
 *  for `aria-label` so screen readers say "Sky" rather than "chart-1". */
const TOKEN_NAMES: Readonly<Record<string, string>> = {
  "chart-1": "Sky",
  "chart-2": "Teal",
  "chart-3": "Jade",
  "chart-4": "Green",
  "chart-5": "Lime",
  "chart-6": "Amber",
  "chart-7": "Orange",
  "chart-8": "Vermilion",
  "chart-9": "Red",
  "chart-10": "Rose",
  "chart-11": "Magenta",
  "chart-12": "Orchid",
  "chart-13": "Purple",
  "chart-14": "Indigo",
  "chart-15": "Cobalt",
  "chart-16": "Steel",
  "chart-17": "Cadet",
  "chart-18": "Seafoam",
  "chart-19": "Olive",
  "chart-20": "Gold",
  "chart-21": "Tangerine",
  "chart-22": "Crimson",
  "chart-23": "Gray",
  "chart-24": "Blue",
};

export interface ColorTokenPickerProps {
  /** Currently selected token (`chart-1`..`chart-24`). `null` = nothing
   *  picked yet (only valid on a brand-new form; submit-time validation
   *  treats null as missing). */
  value: string | null;
  onChange: (token: string) => void;
  disabled?: boolean;
  /** ARIA-label for the entire radiogroup; defaults to "选择颜色". */
  label?: string;
  /** Override the rendered token list. Defaults to all 24 chart tokens.
   *  Tokens outside `CHART_TOKENS` are dropped — closed-set contract
   *  must hold regardless of the caller. */
  tokens?: readonly string[];
  className?: string;
  id?: string;
}

const ALLOWED = new Set<string>(CHART_TOKENS);

function nextIndex(current: number, key: string, count: number, columns: number): number | null {
  // Arrow keys move BOTH focus and selection (radiogroup pattern).
  // Wrap at boundaries so users don't get stuck at the edge.
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "ArrowDown": {
      const target = current + columns;
      return target < count ? target : current % columns;
    }
    case "ArrowUp": {
      const target = current - columns;
      if (target >= 0) return target;
      // Jump to the last row, same column (or last item if shorter).
      const col = current % columns;
      const lastRowStart = Math.floor((count - 1) / columns) * columns;
      return Math.min(lastRowStart + col, count - 1);
    }
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export function ColorTokenPicker({
  value,
  onChange,
  disabled = false,
  label = "选择颜色",
  tokens = CHART_TOKENS,
  className,
  id,
}: ColorTokenPickerProps): React.ReactElement {
  // Drop any caller-supplied token outside the closed set.
  const items = React.useMemo(() => tokens.filter((t) => ALLOWED.has(t)), [tokens]);

  // The swatch that owns the tab stop. Defaults to the current value's
  // index, or 0 if nothing selected. Updated as the user navigates so
  // arrow-key selection feels native.
  const selectedIndex = value ? items.indexOf(value) : -1;
  const [tabIndex, setTabIndex] = React.useState<number>(selectedIndex >= 0 ? selectedIndex : 0);

  // Keep tabIndex in sync when the controlled value changes from outside.
  React.useEffect(() => {
    if (selectedIndex >= 0) setTabIndex(selectedIndex);
  }, [selectedIndex]);

  const buttonRef = React.useRef<(HTMLButtonElement | null)[]>([]);

  const COLUMNS = 6;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (disabled) return;
    const next = nextIndex(idx, event.key, items.length, COLUMNS);
    if (next === null) return;
    event.preventDefault();
    setTabIndex(next);
    buttonRef.current[next]?.focus();
    const target = items[next];
    if (target) onChange(target);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      id={id}
      className={cn(
        "grid grid-cols-6 gap-2",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      {items.map((token, idx) => {
        const selected = token === value;
        const name = TOKEN_NAMES[token] ?? token;
        const isTabStop = idx === tabIndex;
        return (
          <button
            key={token}
            ref={(el) => {
              buttonRef.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            data-token={token}
            tabIndex={disabled ? -1 : isTabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setTabIndex(idx);
              onChange(token);
            }}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            style={{ backgroundColor: `hsl(var(--${token}))` }}
            className={cn(
              "size-8 rounded-md outline-none transition-all",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "hover:scale-110",
              selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
          >
            {selected ? (
              <Check
                aria-hidden="true"
                className="mx-auto size-4 text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.6)]"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
