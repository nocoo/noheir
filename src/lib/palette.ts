// Centralized chart / visualization color palette.
// All values reference CSS custom properties defined in index.css.
// Use these constants everywhere instead of hardcoded HSL strings.
//
// Two consumption patterns:
//   1. DOM/SVG (Recharts, inline styles) → use `chart.*` or `chartIncome` etc.
//      These return `hsl(var(--chart-N))` which the browser resolves.
//   2. Canvas (ECharts) → use `resolveColor("chart-1")` at render time.
//      This reads the computed value from the DOM so ECharts gets a real color.

/** Helper — wraps a CSS custom property name for inline style usage. */
const v = (token: string) => `hsl(var(--${token}))`;

/**
 * Returns a CSS color string with alpha from a CSS custom property.
 * Usage: `withAlpha("chart-1", 0.12)` → `hsl(var(--chart-1) / 0.12)`
 */
export const withAlpha = (token: string, alpha: number) =>
  `hsl(var(--${token}) / ${alpha})`;

// ── CSS-variable resolver (for ECharts / canvas) ──

/**
 * Resolve a CSS custom property to a computed color string at runtime.
 * Required for canvas-based renderers (ECharts) that cannot read CSS variables.
 *
 * @param token - CSS variable name without `--`, e.g. `"chart-1"` or `"income"`
 * @returns Computed color string, e.g. `"hsl(200, 90%, 55%)"`, or fallback `"#888"`
 */
export function resolveColor(token: string): string {
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") return "#888";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  return raw ? `hsl(${raw})` : "#888";
}

/**
 * Resolve an array of CSS variable tokens to computed colors.
 * Convenience wrapper for ECharts color arrays.
 */
export function resolveColors(tokens: readonly string[]): string[] {
  return tokens.map(resolveColor);
}

/**
 * Resolve all 24 chart colors at once for ECharts.
 * Call this inside a component body / useEffect so it picks up the current theme.
 */
export function resolveChartColors(): string[] {
  return resolveColors(CHART_TOKENS);
}

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

/** Chart color name type */
export type ChartColorName = keyof typeof chart;

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

// ── Domain color maps (asset management) ──

/** Investment strategy → chart token mapping */
export const STRATEGY_TOKEN_MAP: Record<string, string> = {
  '远期理财': 'chart-24',  // blue
  '美元资产': 'chart-13',  // purple
  '36存单':   'chart-2',   // teal
  '长期理财': 'chart-3',   // jade
  '短期理财': 'chart-6',   // amber
  '中期理财': 'chart-7',   // orange
  '进攻计划': 'chart-9',   // red
  '麻麻理财': 'chart-10',  // rose
};

/** Currency → chart token mapping */
export const CURRENCY_TOKEN_MAP: Record<string, string> = {
  CNY: 'chart-9',   // red
  USD: 'chart-24',  // blue
  HKD: 'chart-6',   // amber
};

/** Unit status → chart token mapping */
export const STATUS_TOKEN_MAP: Record<string, string> = {
  '已成立': 'chart-3',   // jade
  '计划中': 'chart-23',  // gray
  '筹集中': 'chart-6',   // amber (was yellow)
  '已归档': 'chart-16',  // steel (was slate)
};

/** Maturity period → chart token mapping */
export const MATURITY_TOKEN_MAP: Record<string, string> = {
  '已到期':   'chart-9',   // red
  '7天内':    'chart-7',   // orange
  '30天内':   'chart-6',   // amber
  '90天内':   'chart-24',  // blue
  '90天以上': 'chart-3',   // jade
};

/** Account type → chart token mapping */
export const ACCOUNT_TYPE_TOKEN_MAP: Record<string, string> = {
  debit:        'chart-24',  // blue
  credit:       'chart-9',   // red
  prepaid:      'chart-13',  // purple
  financial:    'chart-3',   // jade
  unclassified: 'chart-23',  // gray
};

// ── Domain resolver helpers (for ECharts) ──

const DEFAULT_TOKEN = 'chart-23'; // gray fallback

export function resolveStrategyColor(strategy: string): string {
  return resolveColor(STRATEGY_TOKEN_MAP[strategy] ?? DEFAULT_TOKEN);
}

export function resolveCurrencyColor(currency: string): string {
  return resolveColor(CURRENCY_TOKEN_MAP[currency] ?? DEFAULT_TOKEN);
}

export function resolveStatusColor(status: string): string {
  return resolveColor(STATUS_TOKEN_MAP[status] ?? DEFAULT_TOKEN);
}

export function resolveMaturityColor(period: string): string {
  return resolveColor(MATURITY_TOKEN_MAP[period] ?? DEFAULT_TOKEN);
}

/** Get resolved color by chart index (wraps around 24 colors). For ECharts. */
export function resolveChartColor(index: number): string {
  return resolveColor(`chart-${(index % 24) + 1}`);
}
