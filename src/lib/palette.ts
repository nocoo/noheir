/**
 * Centralized chart / visualization color palette.
 *
 * All values reference CSS custom properties defined in globals.css.
 * Use these constants everywhere instead of hardcoded HSL strings.
 *
 * Two consumption patterns:
 *   1. DOM/SVG (Recharts, inline styles) → use `CHART_COLORS[n]`
 *      These return `hsl(var(--chart-N))` which the browser resolves.
 *   2. Canvas (ECharts) → use `resolveColor("chart-1")` at render time.
 *      This reads the computed value from the DOM so ECharts gets a real color.
 */

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
  if (
    typeof document === "undefined" ||
    typeof getComputedStyle === "undefined"
  )
    return "#888";
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

// ── 24 sequential chart colors ──

export const chart = {
  sky: v("chart-1"), // Sky (= primary)
  teal: v("chart-2"),
  jade: v("chart-3"),
  green: v("chart-4"),
  lime: v("chart-5"),
  amber: v("chart-6"),
  orange: v("chart-7"),
  vermilion: v("chart-8"),
  red: v("chart-9"),
  rose: v("chart-10"),
  magenta: v("chart-11"),
  orchid: v("chart-12"),
  purple: v("chart-13"),
  indigo: v("chart-14"),
  cobalt: v("chart-15"),
  steel: v("chart-16"),
  cadet: v("chart-17"),
  seafoam: v("chart-18"),
  olive: v("chart-19"),
  gold: v("chart-20"),
  tangerine: v("chart-21"),
  crimson: v("chart-22"),
  gray: v("chart-23"),
  blue: v("chart-24"),
} as const;

/** Chart color name type */
export type ChartColorName = keyof typeof chart;

/** Ordered array of CSS variable chart colors — use for pie / bar charts. */
export const CHART_COLORS = Object.values(chart);

/** CSS variable names (without --) matching CHART_COLORS order — for withAlpha(). */
export const CHART_TOKENS = Array.from(
  { length: 24 },
  (_, i) => `chart-${i + 1}`,
) as readonly string[];

/**
 * Resolve all 24 chart colors at once for ECharts.
 * Call this inside a component body / useEffect so it picks up the current theme.
 */
export function resolveChartColors(): string[] {
  return resolveColors(CHART_TOKENS);
}

/** Get resolved color by chart index (wraps around 24 colors). For ECharts. */
export function resolveChartColor(index: number): string {
  return resolveColor(`chart-${(index % 24) + 1}`);
}

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

// ── Domain color maps (asset management) ──

/** Investment strategy → chart token mapping */
export const STRATEGY_TOKEN_MAP: Record<string, string> = {
  远期理财: "chart-24", // blue
  美元资产: "chart-13", // purple
  "36存单": "chart-2", // teal
  长期理财: "chart-3", // jade
  短期理财: "chart-6", // amber
  中期理财: "chart-7", // orange
  进攻计划: "chart-9", // red
  麻麻理财: "chart-10", // rose
};

/** Tactics → chart token mapping */
export const TACTICS_TOKEN_MAP: Record<string, string> = {
  养老年金: "chart-24", // blue
  个人养老金: "chart-14", // indigo
  定期存款: "chart-2", // teal
  理财产品: "chart-3", // jade
  现金产品: "chart-5", // lime
  债券基金: "chart-15", // cobalt
  偏股基金: "chart-9", // red
  稳健理财: "chart-4", // green
  增额寿险: "chart-12", // orchid
  货币基金: "chart-18", // seafoam
};

/** Currency → chart token mapping */
export const CURRENCY_TOKEN_MAP: Record<string, string> = {
  CNY: "chart-9", // red
  USD: "chart-24", // blue
  HKD: "chart-6", // amber
};

/** Unit status → chart token mapping */
export const STATUS_TOKEN_MAP: Record<string, string> = {
  已成立: "chart-3", // jade (green)
  计划中: "chart-24", // blue
  筹集中: "chart-6", // amber
  已归档: "chart-16", // steel (gray, intentional for archived)
};

/** Maturity period → chart token mapping */
export const MATURITY_TOKEN_MAP: Record<string, string> = {
  已到期: "chart-9", // red
  "7天内": "chart-7", // orange
  "30天内": "chart-6", // amber
  "90天内": "chart-24", // blue
  "90天以上": "chart-3", // jade
};

// Note: DEFAULT_TOKEN removed - we now use hashToChartToken for unknown values

// ── Vivid color indices (excluding gray/steel: 16, 23) ──
// Used for hash-based color assignment to ensure vibrant colors

const VIVID_COLOR_INDICES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 24,
] as const;

/**
 * Stable hash function (DJB2) for string to number.
 * Same input always produces same output.
 */
function stableHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Get a stable chart token for any string using hash.
 * Excludes gray/steel colors (16, 23) to ensure vibrant output.
 * Same input always produces same color.
 */
export function hashToChartToken(value: string): string {
  const hash = stableHash(value);
  const index = hash % VIVID_COLOR_INDICES.length;
  const colorNum = VIVID_COLOR_INDICES[index];
  return `chart-${colorNum}`;
}

/**
 * Get chart token for a strategy.
 * Uses predefined mapping if available, otherwise hash-based.
 */
export function getStrategyToken(strategy: string): string {
  return STRATEGY_TOKEN_MAP[strategy] ?? hashToChartToken(strategy);
}

/**
 * Get chart token for a tactics.
 * Uses predefined mapping if available, otherwise hash-based.
 */
export function getTacticsToken(tactics: string): string {
  return TACTICS_TOKEN_MAP[tactics] ?? hashToChartToken(tactics);
}

/**
 * Get chart token for a status.
 * Uses predefined mapping if available, otherwise hash-based.
 */
export function getStatusToken(status: string): string {
  return STATUS_TOKEN_MAP[status] ?? hashToChartToken(status);
}

/**
 * Get chart token for a currency.
 * Uses predefined mapping if available, otherwise hash-based.
 */
export function getCurrencyToken(currency: string): string {
  return CURRENCY_TOKEN_MAP[currency] ?? hashToChartToken(currency);
}

/**
 * Get chart token for a maturity period.
 * Uses predefined mapping if available, otherwise hash-based.
 */
export function getMaturityToken(period: string): string {
  return MATURITY_TOKEN_MAP[period] ?? hashToChartToken(period);
}

/** Get CSS-variable color string for a strategy (for SVG/Recharts). */
export function strategyColor(strategy: string): string {
  return v(getStrategyToken(strategy));
}

/** Get CSS-variable color string for a tactics (for SVG/Recharts). */
export function tacticsColor(tactics: string): string {
  return v(getTacticsToken(tactics));
}

/** Get CSS-variable color string for a currency (for SVG/Recharts). */
export function currencyColor(currency: string): string {
  return v(getCurrencyToken(currency));
}

/** Get CSS-variable color string for a unit status (for SVG/Recharts). */
export function statusColor(status: string): string {
  return v(getStatusToken(status));
}

/** Get CSS-variable color string for a maturity period (for SVG/Recharts). */
export function maturityColor(period: string): string {
  return v(getMaturityToken(period));
}

/** Resolve strategy color for ECharts. */
export function resolveStrategyColor(strategy: string): string {
  return resolveColor(getStrategyToken(strategy));
}

/** Resolve tactics color for ECharts. */
export function resolveTacticsColor(tactics: string): string {
  return resolveColor(getTacticsToken(tactics));
}

/** Resolve currency color for ECharts. */
export function resolveCurrencyColor(currency: string): string {
  return resolveColor(getCurrencyToken(currency));
}

/** Resolve status color for ECharts. */
export function resolveStatusColor(status: string): string {
  return resolveColor(getStatusToken(status));
}

/** Resolve maturity color for ECharts. */
export function resolveMaturityColor(period: string): string {
  return resolveColor(getMaturityToken(period));
}
