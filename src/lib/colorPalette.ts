/**
 * Unified Color Palette System
 *
 * 统一的20色色板系统，用于所有图表和可视化组件
 * Unified 20-color palette system for all charts and visualizations
 */

// ============================================================================
// UNIFIED 20-COLOR PALETTE (Tailwind 500 shades)
// ============================================================================
export const UNIFIED_PALETTE = {
  // --- Warm Colors (暖色系) ---
  red: '#ef4444',        // Red-500
  orange: '#f97316',     // Orange-500
  amber: '#f59e0b',      // Amber-500
  yellow: '#eab308',     // Yellow-500
  rose: '#e11d48',       // Rose-600 (expense color)

  // --- Cool Colors (冷色系) ---
  cyan: '#06b6d4',       // Cyan-500
  sky: '#0ea5e9',        // Sky-500
  blue: '#3b82f6',       // Blue-500
  indigo: '#6366f1',     // Indigo-500
  violet: '#8b5cf6',     // Violet-500
  purple: '#a855f7',     // Purple-500
  fuchsia: '#d946ef',    // Fuchsia-500
  pink: '#ec4899',       // Pink-500

  // --- Nature Colors (自然色系) ---
  lime: '#84cc16',       // Lime-500
  green: '#22c55e',      // Green-500
  emerald: '#10b981',    // Emerald-600 (income color)
  teal: '#14b8a6',       // Teal-500

  // --- Neutral Colors (中性色系) ---
  slate: '#64748b',      // Slate-500
  gray: '#6b7280',       // Gray-500
  zinc: '#71717a',       // Zinc-500
  stone: '#78716c',      // Stone-500
} as const;

// Color array for indexed access (18 colors + income/expense)
export const PALETTE_ARRAY = [
  UNIFIED_PALETTE.slate,
  UNIFIED_PALETTE.red,
  UNIFIED_PALETTE.orange,
  UNIFIED_PALETTE.amber,
  UNIFIED_PALETTE.yellow,
  UNIFIED_PALETTE.lime,
  UNIFIED_PALETTE.green,
  UNIFIED_PALETTE.emerald,
  UNIFIED_PALETTE.teal,
  UNIFIED_PALETTE.cyan,
  UNIFIED_PALETTE.sky,
  UNIFIED_PALETTE.blue,
  UNIFIED_PALETTE.indigo,
  UNIFIED_PALETTE.violet,
  UNIFIED_PALETTE.purple,
  UNIFIED_PALETTE.fuchsia,
  UNIFIED_PALETTE.pink,
  UNIFIED_PALETTE.rose,
  '#059669',  // Emerald-600 (income variant)
  '#e11d48',  // Rose-600 (expense variant)
] as const;

// ============================================================================
// INCOME/EXPENSE COLORS
// ============================================================================
export const INCOME_COLOR = '#059669';  // Emerald-600
export const EXPENSE_COLOR = '#e11d48';  // Rose-600

// ============================================================================
// ASET-SPECIFIC COLORS (Capital Dashboard)
// ============================================================================
export const STRATEGY_COLORS = {
  '远期理财': UNIFIED_PALETTE.blue,
  '美元资产': UNIFIED_PALETTE.violet,
  '36存单': UNIFIED_PALETTE.cyan,
  '长期理财': UNIFIED_PALETTE.emerald,
  '短期理财': UNIFIED_PALETTE.amber,
  '中期理财': UNIFIED_PALETTE.orange,
  '进攻计划': UNIFIED_PALETTE.red,
  '麻麻理财': UNIFIED_PALETTE.pink,
} as const;

export const CURRENCY_COLORS = {
  CNY: UNIFIED_PALETTE.red,
  USD: UNIFIED_PALETTE.blue,
  HKD: UNIFIED_PALETTE.amber,
} as const;

export const STATUS_COLORS = {
  '已成立': UNIFIED_PALETTE.emerald,
  '计划中': UNIFIED_PALETTE.gray,      // 灰色 - 尚未开始
  '筹集中': UNIFIED_PALETTE.yellow,    // 黄色 - 资金逐步到位
  '已归档': UNIFIED_PALETTE.slate,     // 深灰色 - 完全消灭
} as const;

export const MATURITY_COLORS = {
  '已到期': UNIFIED_PALETTE.red,
  '7天内': UNIFIED_PALETTE.orange,
  '30天内': UNIFIED_PALETTE.amber,
  '90天内': UNIFIED_PALETTE.blue,
  '90天以上': UNIFIED_PALETTE.emerald,
} as const;

// ============================================================================
// CATEGORY COLORS (Transaction Categories)
// ============================================================================
export const CATEGORY_COLORS = {
  // Expense categories
  "日常吃喝": UNIFIED_PALETTE.rose,
  "幸福家庭": UNIFIED_PALETTE.orange,
  "小吞金兽": UNIFIED_PALETTE.amber,
  "生活品质": UNIFIED_PALETTE.yellow,
  "娱乐社交": UNIFIED_PALETTE.green,
  "公共交通": UNIFIED_PALETTE.sky,
  "交通工具": UNIFIED_PALETTE.blue,
  "生活缴费": UNIFIED_PALETTE.violet,
  "健康管理": UNIFIED_PALETTE.pink,
  "工作垫付": UNIFIED_PALETTE.teal,
  "大额支出": UNIFIED_PALETTE.purple,
  "系统支出": UNIFIED_PALETTE.slate,

  // Income categories
  "薪资收入": UNIFIED_PALETTE.green,
  "资助收入": UNIFIED_PALETTE.violet,
  "投资收入": UNIFIED_PALETTE.amber,
  "其他收入": UNIFIED_PALETTE.gray,
} as const;

// ============================================================================
// HEATMAP PALETTES (GitHub-style gradients)
// ============================================================================
export const HEATMAP_GREEN_PALETTE = [
  '#ebedf0',  // No data - light gray
  '#9be9a8',  // Low - light green
  '#40c463',  // Medium-Low
  '#30a14e',  // Medium-High
  '#216e39',  // High - dark green
] as const;

export const HEATMAP_RED_PALETTE = [
  '#ebedf0',  // No data - light gray
  '#ffc1cc',  // Low - light red
  '#ff8fab',  // Medium-Low
  '#f43f5e',  // Medium-High
  '#be123c',  // High - dark red
] as const;

// ============================================================================
// SANKEY/RICH PALETTE (for complex visualizations)
// ============================================================================
export const RICH_PALETTE = [
  UNIFIED_PALETTE.red,
  UNIFIED_PALETTE.orange,
  UNIFIED_PALETTE.yellow,
  UNIFIED_PALETTE.green,
  UNIFIED_PALETTE.cyan,
  UNIFIED_PALETTE.blue,
  UNIFIED_PALETTE.violet,
  UNIFIED_PALETTE.fuchsia,
  UNIFIED_PALETTE.rose,
  UNIFIED_PALETTE.pink,
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get color by index from unified palette
 * @param index - Color index (0-19)
 * @returns Hex color string
 */
export function getPaletteColor(index: number): string {
  return PALETTE_ARRAY[index % PALETTE_ARRAY.length];
}

/**
 * Get strategy color
 * @param strategy - Investment strategy name
 * @returns Hex color string
 */
export function getStrategyColor(strategy: string): string {
  return STRATEGY_COLORS[strategy as keyof typeof STRATEGY_COLORS] || UNIFIED_PALETTE.gray;
}

/**
 * Get category color
 * @param category - Category name
 * @returns Hex color string
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || UNIFIED_PALETTE.gray;
}

/**
 * Get currency color
 * @param currency - Currency code
 * @returns Hex color string
 */
export function getCurrencyColor(currency: string): string {
  return CURRENCY_COLORS[currency as keyof typeof CURRENCY_COLORS] || UNIFIED_PALETTE.gray;
}

/**
 * Get status color
 * @param status - Status name
 * @returns Hex color string
 */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || UNIFIED_PALETTE.gray;
}

/**
 * Get maturity color
 * @param period - Maturity period description
 * @returns Hex color string
 */
export function getMaturityColor(period: string): string {
  return MATURITY_COLORS[period as keyof typeof MATURITY_COLORS] || UNIFIED_PALETTE.gray;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type PaletteColor = keyof typeof UNIFIED_PALETTE;
export type InvestmentStrategy = keyof typeof STRATEGY_COLORS;
export type Currency = keyof typeof CURRENCY_COLORS;
export type UnitStatus = keyof typeof STATUS_COLORS;
