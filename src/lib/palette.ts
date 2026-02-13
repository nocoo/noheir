// Centralized chart / visualization color palette.
// All values reference CSS custom properties defined in index.css.
// Use these constants everywhere instead of hardcoded HSL strings.
//
// NOTE: The legacy `colorPalette.ts` (hex-based) still exists for backward
// compatibility. New code should import from this file instead.

/** Helper — wraps a CSS custom property name for inline style usage. */
const v = (token: string) => `hsl(var(--${token}))`;

/**
 * Returns a CSS color string with alpha from a CSS custom property.
 * Usage: `withAlpha("chart-1", 0.12)` → `hsl(var(--chart-1) / 0.12)`
 */
export const withAlpha = (token: string, alpha: number) =>
  `hsl(var(--${token}) / ${alpha})`;

// ── 24 sequential chart colors ──

export const chart = {
  sky:       v("chart-1"),   // Sky (= primary)
  teal:      v("chart-2"),
  jade:      v("chart-3"),
  green:     v("chart-4"),
  lime:      v("chart-5"),
  amber:     v("chart-6"),
  orange:    v("chart-7"),
  vermilion: v("chart-8"),
  red:       v("chart-9"),
  rose:      v("chart-10"),
  magenta:   v("chart-11"),
  orchid:    v("chart-12"),
  purple:    v("chart-13"),
  indigo:    v("chart-14"),
  cobalt:    v("chart-15"),
  steel:     v("chart-16"),
  cadet:     v("chart-17"),
  seafoam:   v("chart-18"),
  olive:     v("chart-19"),
  gold:      v("chart-20"),
  tangerine: v("chart-21"),
  crimson:   v("chart-22"),
  gray:      v("chart-23"),
  blue:      v("chart-24"),
} as const;

/** Ordered array — use for pie / donut / bar where you need N colors by index. */
export const CHART_COLORS = Object.values(chart);

/** CSS variable names (without --) matching CHART_COLORS order — for withAlpha(). */
export const CHART_TOKENS = Array.from(
  { length: 24 },
  (_, i) => `chart-${i + 1}`,
) as readonly string[];

// ── Semantic aliases ──

export const chartAxis = v("chart-axis");
export const chartMuted = v("chart-muted");

/** Positive / income / inflow */
export const chartIncome = v("income");

/** Negative / expense / outflow */
export const chartExpense = v("expense");

/** Primary chart accent (most-used single color) */
export const chartPrimary = chart.sky;

/** Balance / net — distinct from both income and expense */
export const chartBalance = chart.teal;

// ── Heatmap scales (4 intensities × 4 hues) ──

export const heatmap = {
  green: [v("heatmap-green-1"), v("heatmap-green-2"), v("heatmap-green-3"), v("heatmap-green-4")] as const,
  red:   [v("heatmap-red-1"),   v("heatmap-red-2"),   v("heatmap-red-3"),   v("heatmap-red-4")]   as const,
  blue:  [v("heatmap-blue-1"),  v("heatmap-blue-2"),  v("heatmap-blue-3"),  v("heatmap-blue-4")]  as const,
  orange:[v("heatmap-orange-1"),v("heatmap-orange-2"),v("heatmap-orange-3"),v("heatmap-orange-4")] as const,
} as const;
